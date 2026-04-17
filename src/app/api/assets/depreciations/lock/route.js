import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkPerm } from '@/lib/authz';
import { getRequestRole } from '@/lib/requestAuth';
import { requireCompanyId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const companyId = requireCompanyId(req);
  const role = await getRequestRole(req, { companyId });
  if (!checkPerm('lockDepreciation', role)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  try {
    const locks = await prisma.depreciationPeriodLock.findMany({
      where: { companyId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    return NextResponse.json({ ok: true, locks });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'List lock failed' }, { status: 500 });
  }
}

export async function POST(req) {
  const companyId = requireCompanyId(req);
  const role = await getRequestRole(req, { companyId });
  if (!checkPerm('lockDepreciation', role)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  try {
    const body = await req.json();
    const year = Number(body.year);
    const month = Number(body.month);
    const action = body.action || 'lock';
    if (!year || !month) return NextResponse.json({ ok: false, error: 'year/month requis' }, { status: 400 });

    if (action === 'lock') {
      const existing = await prisma.depreciationPeriodLock.findFirst({ where: { companyId, year, month } });
      let lock;
      if (existing) {
        lock = await prisma.depreciationPeriodLock.update({
          where: { id: existing.id, companyId },
          data: { note: body.note || null },
        });
      } else {
        lock = await prisma.depreciationPeriodLock.create({
          data: { companyId, year, month, note: body.note || null },
        });
      }
      return NextResponse.json({ ok: true, lock });
    }

    if (action === 'unlock') {
      const existing = await prisma.depreciationPeriodLock.findFirst({ where: { companyId, year, month } });
      if (existing) await prisma.depreciationPeriodLock.delete({ where: { id: existing.id, companyId } });
      return NextResponse.json({ ok: true, unlocked: true });
    }

    return NextResponse.json({ ok: false, error: 'action invalide' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Lock/unlock failed' }, { status: 500 });
  }
}
