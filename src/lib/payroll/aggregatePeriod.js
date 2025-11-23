import prisma from '@/lib/prisma';

// Shared aggregation for period summary (used by JSON/CSV/PDF/XLSX endpoints)
export async function aggregatePeriodSummary(periodId) {
  const period = await prisma.payrollPeriod.findUnique({
    where: { id: periodId },
    include: { payslips: { include: { employee: { select: { firstName:true, lastName:true, employeeNumber:true } }, lines: { select: { code:true, amount:true, meta:true } } } } }
  });
  if (!period) return null;
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
    employees.push({
      payslipId: ps.id,
      ref: ps.ref,
      employeeId: ps.employee.employeeNumber || ps.id,
      employeeName: `${ps.employee.firstName} ${ps.employee.lastName}`.trim(),
      gross, net, cnssEmployee, iprTax, cnssEmployer, onem, inpp, overtime,
      employerCharges: cnssEmployer + onem + inpp,
      linesCount: ps.lines.length,
    });
  }
  const employerChargesTotal = cnssEmployerTotal + onemTotal + inppTotal;
  return {
    period: { id: period.id, ref: period.ref, status: period.status },
    totals: { grossTotal, netTotal, cnssEmployeeTotal, iprTaxTotal, cnssEmployerTotal, onemTotal, inppTotal, employerChargesTotal, overtimeTotal, payslipCount: period.payslips.length },
    employees,
  };
}
