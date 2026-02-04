import prisma from '@/lib/prisma';
import { requireCompanyId } from '@/lib/tenant';

export async function GET(request) {
  const companyId = requireCompanyId(request);
  const invoices = await prisma.invoice.findMany({
    where: { companyId },
    include: { client: true, moneyMovements: { select: { id: true, date: true, voucherRef: true, amount: true, direction: true }, orderBy: { date: 'asc' } } },
    orderBy: { issueDate: 'desc' }
  });
  const header = ['invoiceNumber','client','issueDate','dueDate','status','total','paid','outstanding','lastVoucherRef'];
  const rows = invoices.map(inv => {
    const paid = Number(inv.paidAmount || 0);
    const total = Number(inv.totalAmount || 0);
    const outstanding = total - paid;
    const last = inv.moneyMovements.length ? inv.moneyMovements[inv.moneyMovements.length - 1].voucherRef : '';
    let dynStatus = inv.status;
    if (total > 0 && paid > 0 && paid < total) dynStatus = 'PARTIAL';
    return [
      inv.invoiceNumber,
      inv.client?.name || '',
      inv.issueDate?.toISOString().slice(0,10) || '',
      inv.dueDate?.toISOString().slice(0,10) || '',
      dynStatus,
      total.toFixed(2),
      paid.toFixed(2),
      outstanding.toFixed(2),
      last
    ];
  });
  const csv = [header.join(','), ...rows.map(r => r.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(','))].join('\n');
  return new Response(csv, { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="invoices-export.csv"' } });
}
