import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const locks = await prisma.depreciationPeriodLock.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    return NextResponse.json({ ok: true, locks });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'List lock failed' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const year = Number(body.year);
    const month = Number(body.month);
    const action = body.action || 'lock';
    if (!year || !month) return NextResponse.json({ ok: false, error: 'year/month requis' }, { status: 400 });
    if (action === 'lock') {
      const lock = await prisma.depreciationPeriodLock.upsert({
        where: { year_month: { year, month } },
        create: { year, month, note: body.note || null },
        update: { note: body.note || null },
      });
      return NextResponse.json({ ok: true, lock });
    }
    if (action === 'unlock') {
      await prisma.depreciationPeriodLock.delete({ where: { year_month: { year, month } } });
      return NextResponse.json({ ok: true, unlocked: true });
    }
    return NextResponse.json({ ok: false, error: 'action invalide' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Lock/unlock failed' }, { status: 500 });
  }
}

