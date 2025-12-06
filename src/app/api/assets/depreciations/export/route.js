import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function parseYm(v) {
  if (!v) return null;
  const [y, m] = v.split('-').map(Number);
  if (!y || !m) return null;
  return { year: y, month: m };
}

function fitsFrom(line, from) {
  if (!from) return true;
  return line.year > from.year || (line.year === from.year && line.month >= from.month);
}

function fitsTo(line, to) {
  if (!to) return true;
  return line.year < to.year || (line.year === to.year && line.month <= to.month);
}

function toNumber(x) {
  return x?.toNumber?.() ?? Number(x ?? 0) ?? 0;
}

function toCsv(rows) {
  const header = [
    'assetRef',
    'assetLabel',
    'category',
    'year',
    'month',
    'amount',
    'status',
    'journalNumber',
  ];
  const lines = rows.map((r) => [
    r.assetRef,
    r.assetLabel,
    r.category,
    r.year,
    r.month,
    r.amount.toFixed(2),
    r.status,
    r.journalNumber || '',
  ]);
  return [header.join(','), ...lines.map((l) => l.join(','))].join('\n');
}

export async function GET(req) {
  const url = new URL(req.url);
  const from = parseYm(url.searchParams.get('from'));
  const to = parseYm(url.searchParams.get('to'));
  const format = (url.searchParams.get('format') || 'csv').toLowerCase();

  try {
    const lines = await prisma.depreciationLine.findMany({
      include: {
        asset: { include: { category: true } },
        journalEntry: true,
      },
      orderBy: [{ year: 'asc' }, { month: 'asc' }, { createdAt: 'asc' }],
      take: 2000,
    });

    const filtered = lines.filter((l) => fitsFrom(l, from) && fitsTo(l, to)).map((l) => ({
      assetRef: l.asset.ref,
      assetLabel: l.asset.label,
      category: l.asset.category?.code || '',
      year: l.year,
      month: l.month,
      amount: toNumber(l.amount),
      status: l.status,
      journalNumber: l.journalEntry?.number || '',
    }));

    if (format === 'csv') {
      const csv = toCsv(filtered);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="depreciations${from ? `_${from.year}-${from.month}` : ''}${to ? `_${to.year}-${to.month}` : ''}.csv"`,
        },
      });
    }

    return NextResponse.json({ ok: true, rows: filtered });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Export failed' }, { status: 500 });
  }
}
