import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { featureFlags } from '@/lib/features';

export const dynamic = 'force-dynamic';

function toNum(x) { return x?.toNumber?.() ?? Number(x ?? 0) ?? 0; }

export async function GET(req, { params }) {
  if (!featureFlags.payroll) return NextResponse.json({ error: 'Payroll disabled' }, { status: 403 });
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing period id' }, { status: 400 });
  const period = await prisma.payrollPeriod.findUnique({ where: { id } });
  if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 });
  if (period.status !== 'POSTED') return NextResponse.json({ error: `Period must be POSTED (status=${period.status})` }, { status: 409 });

  const url = new URL(req.url);
  const employeeFilter = url.searchParams.get('employeeId');
  const format = url.searchParams.get('format');

  const journals = await prisma.journalEntry.findMany({
    where: {
      sourceType: 'PAYROLL',
      sourceId: period.id,
      description: { contains: 'PAYSET-' },
    },
    orderBy: { date: 'desc' },
  });
  const jeIds = journals.map(j => j.id);
  const txs = jeIds.length
    ? await prisma.transaction.findMany({
        where: { journalEntryId: { in: jeIds } },
        include: { account: true },
      })
    : [];
  const txByJe = new Map();
  for (const t of txs) {
    if (!txByJe.has(t.journalEntryId)) txByJe.set(t.journalEntryId, []);
    txByJe.get(t.journalEntryId).push(t);
  }
  let settlements = journals.map(j => {
    const list = txByJe.get(j.id) || [];
    const debitTx = list.find(t => t.direction === 'DEBIT') || null;
    const creditTx = list.find(t => t.direction === 'CREDIT') || null;
    const debit = list.filter(t => t.direction === 'DEBIT').reduce((s,t)=> s + toNum(t.amount), 0);
    const credit = list.filter(t => t.direction === 'CREDIT').reduce((s,t)=> s + toNum(t.amount), 0);
    const refMatch = j.description?.match(/PAYSET-[0-9]+/i)?.[0] || null;
    const employeeMatch = j.description?.match(/employ[eé]\\s+([a-z0-9-]+)/i);
    const employeeId = employeeMatch ? employeeMatch[1] : null;
    return {
      journalId: j.id,
      journalNumber: j.number,
      date: j.date,
      voucherRef: refMatch,
      description: j.description,
      debit,
      credit,
      bankAccount: debitTx?.account?.number || null,
      wagesAccount: creditTx?.account?.number || null,
      employeeId,
    };
  });
  if (employeeFilter) {
    settlements = settlements.filter(s => s.employeeId === employeeFilter);
  }

  if (format === 'csv') {
    const headers = ['journalNumber','voucherRef','date','debit','credit','bankAccount','wagesAccount','employeeId','description'];
    const rows = settlements.map(s => [
      s.journalNumber,
      s.voucherRef || '',
      s.date ? new Date(s.date).toISOString().slice(0,10) : '',
      s.debit.toFixed(2),
      s.credit.toFixed(2),
      s.bankAccount || '',
      s.wagesAccount || '',
      s.employeeId || '',
      (s.description || '').replace(/"/g,'""')
    ]);
    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(v => `"${String(v)}"`).join(',')),
    ].join('\n');
    return new Response(csv, { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="settlements_${period.ref}.csv"` } });
  }

  return NextResponse.json({ ok: true, period: { id: period.id, ref: period.ref }, count: settlements.length, settlements });
}
