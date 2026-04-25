import prisma from '@/lib/prisma';
import { listPayrollSettlements } from '@/lib/payroll/settlement';

// Shared aggregation for period summary (used by JSON/CSV/PDF/XLSX endpoints)
function round2(n) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

function deriveSettlementStatus(total, settled) {
  const normalizedTotal = round2(total);
  const normalizedSettled = round2(settled);
  const remaining = Math.max(0, round2(normalizedTotal - normalizedSettled));
  if (normalizedSettled <= 0.005) return 'UNSETTLED';
  if (remaining <= 0.005) return 'SETTLED';
  return 'PARTIAL_SETTLEMENT';
}

export async function aggregatePeriodSummary(periodId, companyId = null) {
  const period = await prisma.payrollPeriod.findFirst({
    where: { id: periodId, ...(companyId ? { companyId } : {}) },
    include: { payslips: { include: { employee: { select: { firstName:true, lastName:true, employeeNumber:true } }, lines: { select: { code:true, amount:true, meta:true } } } } }
  });
  if (!period) return null;
  const settlements = period.status === 'POSTED' ? await listPayrollSettlements(period.id, companyId || period.companyId || null) : [];
  const netSettlements = settlements.filter((settlement) => settlement.liabilityCode === 'NET_PAY');
  const hasGlobalSettlement = netSettlements.some((settlement) => !settlement.employeeId);
  const settledByLiability = new Map();
  const settledByEmployee = new Map();
  for (const settlement of settlements) {
    settledByLiability.set(
      settlement.liabilityCode,
      round2((settledByLiability.get(settlement.liabilityCode) || 0) + Number(settlement.amount || 0))
    );
  }
  for (const settlement of netSettlements) {
    if (!settlement.employeeId) continue;
    settledByEmployee.set(
      settlement.employeeId,
      (settledByEmployee.get(settlement.employeeId) || 0) + Number(settlement.amount || 0)
    );
  }
  let grossTotal = 0, netTotal = 0, cnssEmployeeTotal = 0, iprTaxTotal = 0, cnssEmployerTotal = 0, onemTotal = 0, inppTotal = 0, overtimeTotal = 0;
  const employees = [];
  for (const ps of period.payslips) {
    const gross = ps.grossAmount?.toNumber?.() ?? ps.grossAmount ?? 0;
    const net = ps.netAmount?.toNumber?.() ?? ps.netAmount ?? 0;
    grossTotal += gross; netTotal += net;
    let cnssEmployee=0, iprTax=0, cnssEmployer=0, onem=0, inpp=0, overtime=0;
    for (const l of ps.lines) {
      const amt = l.amount?.toNumber?.() ?? l.amount ?? 0;
      if (l.code === 'CNSS_EMP') cnssEmployee += Math.abs(amt);
      else if (l.code === 'IPR') iprTax += Math.abs(amt);
      else if (l.code === 'CNSS_ER') cnssEmployer += Math.abs(amt);
      else if (l.code === 'ONEM') onem += Math.abs(amt);
      else if (l.code === 'INPP') inpp += Math.abs(amt);
      else if (l.code === 'OT') overtime += amt;
    }
    cnssEmployeeTotal += cnssEmployee;
    iprTaxTotal += iprTax;
    cnssEmployerTotal += cnssEmployer;
    onemTotal += onem;
    inppTotal += inpp;
    overtimeTotal += overtime;
    const settledAmount = hasGlobalSettlement
      ? net
      : Math.min(net, settledByEmployee.get(ps.employeeId) || 0);
    const remainingAmount = Math.max(0, round2(net - settledAmount));
    employees.push({
      payslipId: ps.id,
      ref: ps.ref,
      employeeId: ps.employeeId,
      employeeNumber: ps.employee.employeeNumber || '',
      employeeName: `${ps.employee.firstName} ${ps.employee.lastName}`.trim(),
      gross, net, cnssEmployee, iprTax, cnssEmployer, onem, inpp, overtime,
      settledAmount,
      remainingAmount,
      isSettled: remainingAmount <= 0.005,
      employerCharges: cnssEmployer + onem + inpp,
      linesCount: ps.lines.length,
    });
  }
  const employerChargesTotal = cnssEmployerTotal + onemTotal + inppTotal;
  const settledTotal = hasGlobalSettlement
    ? netTotal
    : round2(Math.min(netTotal, settledByLiability.get('NET_PAY') || 0));
  const remainingTotal = Math.max(0, round2(netTotal - settledTotal));
  const liabilities = [
    {
      code: 'NET_PAY',
      label: 'Salaires nets a payer',
      group: 'EMPLOYEE',
      total: round2(netTotal),
      settled: round2(settledByLiability.get('NET_PAY') || settledTotal),
      remaining: round2(remainingTotal),
      settlementStatus: deriveSettlementStatus(netTotal, settledTotal),
      paymentFlowReady: true,
    },
    {
      code: 'CNSS',
      label: 'CNSS (part salariale + employeur)',
      group: 'SOCIAL',
      total: round2(cnssEmployeeTotal + cnssEmployerTotal),
      settled: round2(settledByLiability.get('CNSS') || 0),
      remaining: round2(cnssEmployeeTotal + cnssEmployerTotal - (settledByLiability.get('CNSS') || 0)),
      settlementStatus: deriveSettlementStatus(cnssEmployeeTotal + cnssEmployerTotal, settledByLiability.get('CNSS') || 0),
      paymentFlowReady: true,
    },
    {
      code: 'ONEM',
      label: 'ONEM',
      group: 'SOCIAL',
      total: round2(onemTotal),
      settled: round2(settledByLiability.get('ONEM') || 0),
      remaining: round2(onemTotal - (settledByLiability.get('ONEM') || 0)),
      settlementStatus: deriveSettlementStatus(onemTotal, settledByLiability.get('ONEM') || 0),
      paymentFlowReady: true,
    },
    {
      code: 'INPP',
      label: 'INPP',
      group: 'SOCIAL',
      total: round2(inppTotal),
      settled: round2(settledByLiability.get('INPP') || 0),
      remaining: round2(inppTotal - (settledByLiability.get('INPP') || 0)),
      settlementStatus: deriveSettlementStatus(inppTotal, settledByLiability.get('INPP') || 0),
      paymentFlowReady: true,
    },
    {
      code: 'PAYE_TAX',
      label: 'IPR / PAYE a reverser',
      group: 'FISCAL',
      total: round2(iprTaxTotal),
      settled: round2(settledByLiability.get('PAYE_TAX') || 0),
      remaining: round2(iprTaxTotal - (settledByLiability.get('PAYE_TAX') || 0)),
      settlementStatus: deriveSettlementStatus(iprTaxTotal, settledByLiability.get('PAYE_TAX') || 0),
      paymentFlowReady: true,
    },
  ].filter((liability) => liability.total > 0.005 || liability.code === 'NET_PAY');
  const liabilityTotals = {
    employeeNetTotal: round2(netTotal),
    socialTotal: round2(cnssEmployeeTotal + cnssEmployerTotal + onemTotal + inppTotal),
    fiscalTotal: round2(iprTaxTotal),
    overallTotal: round2(
      netTotal + cnssEmployeeTotal + cnssEmployerTotal + onemTotal + inppTotal + iprTaxTotal
    ),
    settledTotal: round2(liabilities.reduce((sum, liability) => sum + liability.settled, 0)),
    remainingTotal: round2(liabilities.reduce((sum, liability) => sum + liability.remaining, 0)),
  };
  return {
    period: {
      id: period.id,
      ref: period.ref,
      status: period.status,
      processingCurrency: period.processingCurrency,
      fiscalCurrency: period.fiscalCurrency,
      fxRate: period.fxRate?.toNumber?.() ?? period.fxRate ?? null,
      settlementStatus: deriveSettlementStatus(netTotal, settledTotal),
    },
    totals: {
      grossTotal,
      netTotal,
      settledTotal,
      remainingTotal,
      cnssEmployeeTotal,
      iprTaxTotal,
      cnssEmployerTotal,
      onemTotal,
      inppTotal,
      employerChargesTotal,
      overtimeTotal,
      payslipCount: period.payslips.length,
    },
    liabilityTotals,
    liabilities,
    settlements,
    employees,
  };
}
