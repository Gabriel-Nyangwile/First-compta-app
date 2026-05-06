import prisma from '@/lib/prisma';
import { aggregatePeriodSummary } from './aggregatePeriod';

export function isPayrollPostedLikeStatus(status) {
  return status === 'POSTED' || status === 'SETTLED';
}

export async function syncPayrollPeriodSettlementStatus(periodId, companyId = null, db = prisma) {
  const period = await db.payrollPeriod.findFirst({
    where: { id: periodId, ...(companyId ? { companyId } : {}) },
    select: { id: true, companyId: true, status: true },
  });
  if (!period) {
    throw new Error('Payroll period not found');
  }

  if (!isPayrollPostedLikeStatus(period.status)) {
    return { status: period.status, changed: false, settlementStatus: 'UNSETTLED', remainingTotal: null };
  }

  const scopedCompanyId = companyId || period.companyId || null;
  const summary = await aggregatePeriodSummary(period.id, scopedCompanyId, db);
  const remainingTotal = summary?.liabilityTotals?.remainingTotal ?? 0;
  const targetStatus = remainingTotal <= 0.005 ? 'SETTLED' : 'POSTED';

  if (targetStatus !== period.status) {
    await db.payrollPeriod.update({
      where: { id: period.id, ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}) },
      data: { status: targetStatus },
    });
  }

  return {
    status: targetStatus,
    changed: targetStatus !== period.status,
    settlementStatus: summary?.period?.settlementStatus || 'UNSETTLED',
    remainingTotal,
  };
}
