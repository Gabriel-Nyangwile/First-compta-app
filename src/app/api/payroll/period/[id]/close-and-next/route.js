import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkPerm } from '@/lib/authz';
import { featureFlags } from '@/lib/features';
import { getPayrollCurrencyContext } from '@/lib/payroll/context';
import { postPayrollPeriod } from '@/lib/payroll/postings';
import { isPayrollPostedLikeStatus } from '@/lib/payroll/status';
import { getRequestRole } from '@/lib/requestAuth';
import { nextSequence } from '@/lib/sequence';
import { requireCompanyId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

function toNumber(value) {
  return value?.toNumber?.() ?? Number(value ?? 0) ?? 0;
}

function nextPayrollMonth(month, year) {
  if (month >= 12) return { month: 1, year: year + 1 };
  return { month: month + 1, year };
}

function validatePeriodReady(period) {
  if (!period.payslips.length) {
    return 'Aucun bulletin à clôturer. Générez d’abord les bulletins de la période.';
  }
  const netTotal = period.payslips.reduce((sum, payslip) => sum + toNumber(payslip.netAmount), 0);
  if (!(netTotal > 0)) {
    return `Net total de paie <= 0 (${netTotal.toFixed(2)}). Vérifiez les salariés actifs, postes, barèmes et retenues avant clôture.`;
  }
  const fxRate = toNumber(period.fxRate);
  if (period.processingCurrency !== period.fiscalCurrency && !(fxRate > 0)) {
    return `Taux fiscal requis pour convertir ${period.processingCurrency} vers ${period.fiscalCurrency}. Saisissez le taux dans les saisies paie.`;
  }
  return null;
}

async function ensureNextPeriod(companyId, currentPeriod) {
  const next = nextPayrollMonth(currentPeriod.month, currentPeriod.year);
  const existing = await prisma.payrollPeriod.findFirst({
    where: { companyId, month: next.month, year: next.year },
    orderBy: { openedAt: 'desc' },
    select: { id: true, ref: true, month: true, year: true, status: true },
  });
  if (existing) return { period: existing, created: false };

  const ref = await nextSequence(prisma, 'PAYROLL_PERIOD', 'PP-', companyId);
  const currencyContext = await getPayrollCurrencyContext(companyId);
  const created = await prisma.payrollPeriod.create({
    data: {
      companyId,
      ref,
      month: next.month,
      year: next.year,
      status: 'OPEN',
      processingCurrency: currencyContext.processingCurrency,
      fiscalCurrency: currencyContext.fiscalCurrency,
      fxRate: currencyContext.processingCurrency === currencyContext.fiscalCurrency ? 1 : null,
    },
    select: { id: true, ref: true, month: true, year: true, status: true },
  });
  return { period: created, created: true };
}

export async function POST(req, { params }) {
  if (!featureFlags.payroll) return NextResponse.json({ error: 'Payroll disabled' }, { status: 403 });
  const companyId = requireCompanyId(req);
  const role = await getRequestRole(req, { companyId });
  if (!checkPerm("approvePayroll", role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  let period = await prisma.payrollPeriod.findUnique({
    where: { id, companyId },
    include: { payslips: { select: { id: true, netAmount: true } } },
  });
  if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 });

  const steps = [];

  if (period.status === 'OPEN') {
    const error = validatePeriodReady(period);
    if (error) return NextResponse.json({ error }, { status: 422 });
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.payrollPeriod.update({ where: { id, companyId }, data: { status: 'LOCKED', lockedAt: now } });
      await tx.payslip.updateMany({ where: { periodId: id, companyId }, data: { locked: true } });
    });
    steps.push('LOCKED');
    period = { ...period, status: 'LOCKED' };
  }

  if (period.status === 'LOCKED') {
    const error = validatePeriodReady(period);
    if (error) return NextResponse.json({ error }, { status: 422 });
    try {
      const posting = await postPayrollPeriod(id, companyId);
      steps.push('POSTED');
      period = { ...period, status: 'POSTED', postedAt: new Date() };
      const nextResult = await ensureNextPeriod(companyId, period);
      steps.push(nextResult.created ? 'NEXT_CREATED' : 'NEXT_EXISTS');
      return NextResponse.json({
        ok: true,
        period: { id: period.id, ref: period.ref, month: period.month, year: period.year, status: 'POSTED' },
        journal: {
          id: posting.journal.id,
          number: posting.journal.number,
          transactions: posting.transactions.length,
        },
        nextPeriod: nextResult.period,
        nextCreated: nextResult.created,
        steps,
      });
    } catch (e) {
      return NextResponse.json({
        error: `Période verrouillée, mais publication impossible: ${e.message || 'erreur inconnue'}. Corrigez le blocage ou déverrouillez la période.`,
        steps,
      }, { status: 500 });
    }
  }

  if (isPayrollPostedLikeStatus(period.status)) {
    const nextResult = await ensureNextPeriod(companyId, period);
    steps.push(nextResult.created ? 'NEXT_CREATED' : 'NEXT_EXISTS');
    return NextResponse.json({
      ok: true,
      period: { id: period.id, ref: period.ref, month: period.month, year: period.year, status: period.status },
      nextPeriod: nextResult.period,
      nextCreated: nextResult.created,
      steps,
    });
  }

  return NextResponse.json({ error: `Statut non pris en charge: ${period.status}` }, { status: 409 });
}
