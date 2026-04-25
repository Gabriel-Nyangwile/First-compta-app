import prisma from '@/lib/prisma';

export async function aggregateAnnualPayroll(year, companyId = null) {
  const periods = await prisma.payrollPeriod.findMany({
    where: { year, ...(companyId ? { companyId } : {}) },
    include: { payslips: { include: { lines: { select: { code:true, amount:true } } } } },
    orderBy: { month: 'asc' }
  });
  // Map by month for quick lookup
  const byMonth = new Map(periods.map(p => [p.month, p]));
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const p = byMonth.get(m);
    let grossTotal = 0, netTotal = 0, cnssEmployeeTotal = 0, iprTaxTotal = 0, cnssEmployerTotal = 0, onemTotal = 0, inppTotal = 0, overtimeTotal = 0;
    if (p) {
      for (const ps of p.payslips) {
        const gross = ps.grossAmount?.toNumber?.() ?? ps.grossAmount ?? 0;
        const net = ps.netAmount?.toNumber?.() ?? ps.netAmount ?? 0;
        grossTotal += gross; netTotal += net;
        for (const l of ps.lines) {
          const amt = l.amount?.toNumber?.() ?? l.amount ?? 0;
          if (l.code === 'CNSS_EMP') cnssEmployeeTotal += Math.abs(amt);
          else if (l.code === 'IPR') iprTaxTotal += Math.abs(amt);
          else if (l.code === 'CNSS_ER') cnssEmployerTotal += Math.abs(amt);
          else if (l.code === 'ONEM') onemTotal += Math.abs(amt);
          else if (l.code === 'INPP') inppTotal += Math.abs(amt);
          else if (l.code === 'OT') overtimeTotal += amt;
        }
      }
    }
    const employerChargesTotal = cnssEmployerTotal + onemTotal + inppTotal;
    const grossNegative = grossTotal < 0 ? Math.abs(grossTotal) : 0;
    const netNegative = netTotal < 0 ? Math.abs(netTotal) : 0;
    const grossBaseForRatio = grossTotal < 0 ? (grossTotal * -1 + grossTotal) : grossTotal; // if negative grossTotal treat ratio base as abs original? keep simple: use (grossTotal||1)
    const netBaseForRatio = netTotal < 0 ? (netTotal * -1 + netTotal) : netTotal;
    const correctionRatioGross = grossTotal !== 0 ? (grossNegative / Math.abs(grossTotal)) : 0;
    const correctionRatioNet = netTotal !== 0 ? (netNegative / Math.abs(netTotal)) : 0;
    months.push({
      month: m,
      hasPeriod: !!p,
      periodRef: p?.ref || null,
      processingCurrency: p?.processingCurrency || null,
      fiscalCurrency: p?.fiscalCurrency || null,
      fxRate: p?.fxRate?.toNumber?.() ?? p?.fxRate ?? null,
      grossTotal,
      netTotal,
      cnssEmployeeTotal,
      iprTaxTotal,
      cnssEmployerTotal,
      onemTotal,
      inppTotal,
      employerChargesTotal,
      overtimeTotal,
      grossNegative,
      netNegative,
      correctionRatioGross,
      correctionRatioNet
    });
  }
  // Year-to-date cumulative (monotonic: ignore negative corrections for gross/net)
  let ytdGross=0,ytdNet=0,ytdCnssEmp=0,ytdIpr=0,ytdCnssEr=0,ytdOnem=0,ytdInpp=0,ytdEmployerCharges=0,ytdOvertime=0,ytdCorrectionsGross=0,ytdCorrectionsNet=0;
  const monthsYtd = months.map(row => {
    const addGross = row.grossTotal < 0 ? 0 : row.grossTotal;
    const addNet = row.netTotal < 0 ? 0 : row.netTotal;
    ytdGross += addGross;
    ytdNet += addNet;
    ytdCorrectionsGross += row.grossNegative;
    ytdCorrectionsNet += row.netNegative;
    ytdCnssEmp += row.cnssEmployeeTotal;
    ytdIpr += row.iprTaxTotal;
    ytdCnssEr += row.cnssEmployerTotal;
    ytdOnem += row.onemTotal;
    ytdInpp += row.inppTotal;
    ytdEmployerCharges += row.employerChargesTotal;
    ytdOvertime += row.overtimeTotal;
    const ytdCorrectionRatioGross = ytdCorrectionsGross !==0 && ytdGross !==0 ? (ytdCorrectionsGross / ytdGross) : 0;
    const ytdCorrectionRatioNet = ytdCorrectionsNet !==0 && ytdNet !==0 ? (ytdCorrectionsNet / ytdNet) : 0;
    return { ...row, ytdGross, ytdNet, ytdCorrectionsGross, ytdCorrectionsNet, ytdCorrectionRatioGross, ytdCorrectionRatioNet, ytdCnssEmp, ytdIpr, ytdCnssEr, ytdOnem, ytdInpp, ytdEmployerCharges, ytdOvertime };
  });
  const usedMonths = monthsYtd.filter((month) => month.hasPeriod);
  const processingCurrencies = [...new Set(usedMonths.map((month) => month.processingCurrency).filter(Boolean))];
  const fiscalCurrencies = [...new Set(usedMonths.map((month) => month.fiscalCurrency).filter(Boolean))];
  const missingFxMonths = usedMonths
    .filter((month) => month.processingCurrency !== month.fiscalCurrency && !month.fxRate)
    .map((month) => ({ month: month.month, periodRef: month.periodRef }));
  return {
    year,
    months: monthsYtd,
    currencySummary: {
      processingCurrency: processingCurrencies.length === 1 ? processingCurrencies[0] : null,
      fiscalCurrency: fiscalCurrencies.length === 1 ? fiscalCurrencies[0] : null,
      processingCurrencies,
      fiscalCurrencies,
      mixedProcessingCurrencies: processingCurrencies.length > 1,
      mixedFiscalCurrencies: fiscalCurrencies.length > 1,
      missingFxMonths,
    },
  };
}
