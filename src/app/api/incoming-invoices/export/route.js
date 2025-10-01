import prisma from '@/lib/prisma';

export async function GET() {
  const invoices = await prisma.incomingInvoice.findMany({
    include: { supplier: true, moneyMovements: { select: { id: true, date: true, voucherRef: true }, orderBy: { date: 'asc' } } },
    orderBy: { receiptDate: 'desc' }
  });
  const header = ['entryNumber','supplier','receiptDate','dueDate','status','total','paid','outstanding','lastVoucherRef'];
  const rows = invoices.map(inv => {
    const paid = Number(inv.paidAmount || 0);
    const total = Number(inv.totalAmount || 0);
    const outstanding = total - paid;
    const last = inv.moneyMovements.length ? inv.moneyMovements[inv.moneyMovements.length - 1].voucherRef : '';
    let dynStatus = inv.status;
    if (total > 0 && paid > 0 && paid < total) dynStatus = 'PARTIAL';
    return [
      inv.entryNumber,
      inv.supplier?.name || '',
      inv.receiptDate?.toISOString().slice(0,10) || '',
      inv.dueDate?.toISOString().slice(0,10) || '',
      dynStatus,
      total.toFixed(2),
      paid.toFixed(2),
      outstanding.toFixed(2),
      last
    ];
  });
  const csv = [header.join(','), ...rows.map(r => r.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(','))].join('\n');
  return new Response(csv, { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="incoming-invoices-export.csv"' } });
}
