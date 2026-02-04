import prisma from '@/lib/prisma';
import { requireCompanyId } from '@/lib/tenant';

export async function GET(req, { params }) {
  const companyId = requireCompanyId(req);
  const { id } = params;
  const entry = await prisma.journalEntry.findFirst({
    where: { id, companyId },
    include: { lines: { orderBy: { date: 'asc' }, include: { account: { select: { number: true, label: true } } } } }
  });
  if (!entry) return new Response('Not found', { status: 404 });
  let csv = 'journal_number;journal_date;line_index;account_number;account_label;description;debit;credit;kind\n';
  let idx = 1; let debit = 0; let credit = 0;
  for (const l of entry.lines) {
    const amt = Number(l.amount?.toNumber?.() ?? l.amount);
    const d = l.direction === 'DEBIT' ? amt : 0;
    const c = l.direction === 'CREDIT' ? amt : 0;
    debit += d; credit += c;
    csv += `${entry.number};${entry.date.toISOString().slice(0,10)};${idx};${l.account?.number || ''};${(l.account?.label||'').replace(/;/g, ',')};${(l.description||'').replace(/;/g, ',')};${d.toFixed(2)};${c.toFixed(2)};${l.kind}\n`;
    idx++;
  }
  csv += `TOTAL;;;;;;${debit.toFixed(2)};${credit.toFixed(2)};\n`;
  return new Response(csv, { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
}
