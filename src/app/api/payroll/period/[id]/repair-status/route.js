import { NextResponse } from 'next/server';

import prisma from '@/lib/prisma';
import { featureFlags } from '@/lib/features';
import { getCurrentPayrollJournal } from '@/lib/payroll/journals';
import { requireCompanyId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  if (!featureFlags.payroll) return NextResponse.json({ error: 'Payroll disabled' }, { status: 403 });
  const companyId = requireCompanyId(req);
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const period = await tx.payrollPeriod.findUnique({ where: { id, companyId } });
      if (!period) throw new Error('Period not found');
      if (period.status !== 'POSTED') throw new Error(`Repair allowed only for POSTED periods (status=${period.status})`);

      const baseJournal = await getCurrentPayrollJournal(tx, period.id, companyId, { id: true, number: true, description: true });
      if (baseJournal) throw new Error(`Base payroll journal already exists (${baseJournal.number})`);

      const payrollJournals = await tx.journalEntry.findMany({
        where: { sourceType: 'PAYROLL', sourceId: period.id, companyId },
        select: { id: true, number: true, description: true },
      });
      if (payrollJournals.length > 0) {
        throw new Error('Repair blocked: payroll journals exist on this period');
      }

      const updated = await tx.payrollPeriod.update({
        where: { id, companyId },
        data: { status: 'LOCKED', postedAt: null },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          entityType: 'PAYROLL_PERIOD',
          entityId: period.id,
          action: 'REPAIR_STATUS',
          data: {
            periodRef: period.ref,
            fromStatus: period.status,
            toStatus: updated.status,
            reason: 'POSTED period without payroll journal',
          },
        },
      });

      return { periodRef: updated.ref, newStatus: updated.status };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e?.message || 'Repair failed';
    const lower = msg.toLowerCase();
    const status = lower.includes('not found') ? 404 : lower.includes('allowed only') || lower.includes('blocked') || lower.includes('already exists') ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
