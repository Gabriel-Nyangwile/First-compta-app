import prisma from '@/lib/prisma';
import { featureFlags } from '@/lib/features';
import BackButtonLayoutHeader from '@/components/BackButtonLayoutHeader';
import { getPayrollCurrencyContext } from '@/lib/payroll/context';
import { roundCurrency, toNumber } from '@/lib/payroll/currency';
import { computeAllocFam, computeCnssQpoFromGross, computeIprBaseFromGross, computeIprTaxFromGross } from '@/lib/payroll/calc-utils';
import { notFound } from 'next/navigation';
import RecalcButton from '../RecalcButton.jsx';
import ExportPayslipJson from '../ExportPayslipJson.jsx';
import { sanitizePlain } from '@/lib/sanitizePlain';
import { formatAmount } from '@/lib/utils';
import PayButton from '../PayButton.jsx';
import { cookies } from 'next/headers';
import { getCompanyIdFromCookies } from '@/lib/tenant';
import { listPayrollSettlements } from '@/lib/payroll/settlement';

export const dynamic = 'force-dynamic';

export default async function PayslipDetailPage({ params }) {
  if (!featureFlags.payroll) return <div className="p-6">Module paie désactivé.</div>;
  const { id } = await params;
  if (!id) return notFound();
  const cookieStore = await cookies();
  const companyId = getCompanyIdFromCookies(cookieStore);
  if (!companyId) return <div className="p-6">companyId requis (cookie company-id ou DEFAULT_COMPANY_ID).</div>;
  const psRaw = await prisma.payslip.findUnique({
    where: { id, companyId },
    include: { employee: true, lines: true, period: true }
  });
  if (!psRaw) return notFound();
  // Sanitize all Decimal/Date fields to primitives before any potential client boundary.
  const ps = sanitizePlain(psRaw);
  const companyCurrencyContext = await getPayrollCurrencyContext(companyId);
  const currencyContext = {
    processingCurrency: ps.processingCurrency || ps.period?.processingCurrency || companyCurrencyContext.processingCurrency,
    fiscalCurrency: ps.fiscalCurrency || ps.period?.fiscalCurrency || companyCurrencyContext.fiscalCurrency,
    fxRate: ps.fxRate ?? ps.period?.fxRate ?? null,
  };
  const formatProcessingAmount = (value) => formatAmount(value, currencyContext.processingCurrency);
  const formatFiscalAmount = (value) => formatAmount(value, currencyContext.fiscalCurrency);
  // Derive breakdown aggregates from stored lines (post-generation) mirroring preview enrichments.
  const lines = ps.lines || [];
  const findLine = code => lines.find(l => l.code === code);
  const cnssEmpLine = findLine('CNSS_EMP');
  const iprLine = findLine('IPR');
  const cnssErLine = findLine('CNSS_ER');
  const onemLine = findLine('ONEM');
  const inppLine = findLine('INPP');
  const overtimeLine = findLine('OT');
  const cnssEmployee = Math.abs(cnssEmpLine?.amount ?? 0);
  const iprTax = Math.abs(iprLine?.amount ?? 0);
  const riBase = iprLine?.baseAmount ?? null;
  const riCDF = iprLine?.meta?.riCDF ?? null;
  const fxRate = currencyContext.fxRate ?? iprLine?.meta?.fxRate ?? null;
  const cnssEmployer = Math.abs(cnssErLine?.amount ?? 0);
  const onem = Math.abs(onemLine?.amount ?? 0);
  const inpp = Math.abs(inppLine?.amount ?? 0);
  const overtime = overtimeLine?.amount ?? 0;
  const employerCharges = cnssEmployer + onem + inpp;
  const employeeDeductions = cnssEmployee + iprTax + lines.filter(l => l.kind === 'RETENUE').reduce((s,l)=> s + Math.abs(l.amount??0),0);
  const grossAmount = toNumber(ps.grossAmount);
  const cnssAmount = computeCnssQpoFromGross(grossAmount, { processingCurrency: currencyContext.processingCurrency, fxRate });
  const iprBaseAmount = computeIprBaseFromGross(grossAmount, cnssAmount, { processingCurrency: currencyContext.processingCurrency, fxRate });
  const iprAmount = computeIprTaxFromGross(grossAmount, { processingCurrency: currencyContext.processingCurrency, cnssQpoAmount: cnssAmount, fxRate });
  const children = ps.employee?.childrenUnder18 ?? 0;
  const allocFamAmount = computeAllocFam(children, { processingCurrency: currencyContext.processingCurrency, fxRate });
  const netEstAmount = roundCurrency(grossAmount - cnssAmount - iprAmount, currencyContext.processingCurrency);
  const netPlusAllocAmount = roundCurrency(netEstAmount + allocFamAmount, currencyContext.processingCurrency);
  // Déterminer si un règlement PAYSET existe pour l'employé dans cette période
  const settlements = ps.period?.id ? await listPayrollSettlements(ps.period.id, companyId, { liabilityCode: 'NET_PAY' }) : [];
  const hasGlobalSettlement = settlements.some((settlement) => !settlement.employeeId);
  const hasEmployeeSettlement = settlements.some((settlement) => settlement.employeeId === ps.employee.id);
  const hasSettlement = hasGlobalSettlement || hasEmployeeSettlement;
  const settledAmount = hasGlobalSettlement
    ? Number(ps.netAmount ?? 0)
    : settlements
        .filter((settlement) => settlement.employeeId === ps.employee.id)
        .reduce((sum, settlement) => sum + Number(settlement.amount || 0), 0);
  const remainingAmount = Math.max(0, Number((Number(ps.netAmount ?? 0) - settledAmount).toFixed(2)));
  const grouped = lines.reduce((acc, l) => {
    const key = l.kind || 'AUTRE';
    acc[key] = acc[key] || [];
    acc[key].push(l);
    return acc;
  }, {});
  const groupOrder = ['BASE', 'PRIME', 'RETENUE', 'COTISATION_SALARIALE', 'IMPOT', 'COTISATION_PATRONALE', 'AJUSTEMENT'];
  const badge = ps.locked ? (ps.period?.status === 'POSTED' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-blue-100 text-blue-800 border border-blue-200') : 'bg-yellow-100 text-yellow-800 border border-yellow-200';
  const badgeText = ps.locked ? (ps.period?.status === 'POSTED' ? 'POSTED' : 'LOCKED') : 'EDITABLE';
  return (
    <div className="p-6 space-y-4">
      <BackButtonLayoutHeader />
      <h1 className="text-xl font-semibold">Bulletin {ps.ref}</h1>
      <div className="flex items-center gap-3 text-sm text-gray-700 flex-wrap">
        <span className={`px-2 py-[2px] rounded text-xs font-semibold border ${badge}`}>{badgeText}</span>
        <div>Employé: <span className="font-medium">{ps.employee.firstName} {ps.employee.lastName}</span></div>
        <div>Matricule: {ps.employee.employeeNumber || '-'}</div>
        <div>Période: {ps.period.month}/{ps.period.year}</div>
        {hasSettlement && <span className="px-2 py-[2px] rounded text-xs font-semibold border bg-emerald-100 text-emerald-800 border-emerald-200">Payé (PAYSET)</span>}
      </div>
      <div className="text-sm text-gray-600">
        Devise de traitement: <span className="font-medium">{currencyContext.processingCurrency}</span> · Devise fiscale: <span className="font-medium">{currencyContext.fiscalCurrency}</span>
      </div>
      <div className="text-sm flex items-center gap-4 flex-wrap">Brut: {formatProcessingAmount(ps.grossAmount)} | Net (stocké): {formatProcessingAmount(ps.netAmount)} | Réglé: {formatProcessingAmount(settledAmount)} | Reste: {formatProcessingAmount(remainingAmount)} <ExportPayslipJson payslip={ps} /></div>
      {!ps.locked && <RecalcButton payslipId={ps.id} />}
      {ps.period?.status === 'POSTED' && <PayButton periodId={ps.period.id} employeeId={ps.employee.id} disabled={hasSettlement} />}
      <div className="border rounded p-3 bg-white text-sm grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <div className="font-medium mb-1">Montants clés</div>
          <div>Brut: {formatProcessingAmount(ps.grossAmount)}</div>
          <div>Net stocké: {formatProcessingAmount(ps.netAmount)}</div>
          <div>Net estimé ({currencyContext.processingCurrency}): {formatProcessingAmount(netEstAmount)}</div>
          <div>Net + alloc. ({currencyContext.processingCurrency}): {formatProcessingAmount(netPlusAllocAmount)}</div>
        </div>
        <div>
          <div className="font-medium mb-1">Cotisations / impôt</div>
          <div>CNSS salarié: {formatProcessingAmount(cnssEmployee)}</div>
          <div>IPR: {formatProcessingAmount(iprTax)}</div>
          <div>Base IPR ({currencyContext.processingCurrency}): {riBase==null?'-':formatProcessingAmount(riBase)}</div>
          <div>RI {currencyContext.fiscalCurrency}: {riCDF==null?'-':formatFiscalAmount(riCDF)}</div>
          <div>FX rate: {fxRate==null?'-':fxRate}</div>
        </div>
        <div>
          <div className="font-medium mb-1">Charges & effectifs</div>
          <div>CNSS employeur: {formatProcessingAmount(cnssEmployer)}</div>
          <div>ONEM: {formatProcessingAmount(onem)}</div>
          <div>INPP: {formatProcessingAmount(inpp)}</div>
          <div>Charges employeur totales: {formatProcessingAmount(employerCharges)}</div>
          <div>Déductions salarié totales: {formatProcessingAmount(employeeDeductions)}</div>
          <div>Heures suppl.: {formatProcessingAmount(overtime)}</div>
        </div>
      </div>
      <div className="border rounded p-3 bg-gray-50 text-sm">
        <div className="font-medium mb-2">Calcul (brouillon)</div>
        <div>CNSS QPO ({currencyContext.processingCurrency}): {formatProcessingAmount(cnssAmount)}</div>
        <div>Base IPR ({currencyContext.processingCurrency}): {formatProcessingAmount(iprBaseAmount)}</div>
        <div>IPR ({currencyContext.processingCurrency}): {formatProcessingAmount(iprAmount)}</div>
        <div>Allocations familiales ({currencyContext.processingCurrency}) enfants={children}: {formatProcessingAmount(allocFamAmount)}</div>
        <div className="mt-2">Net estimé ({currencyContext.processingCurrency}, sans allocations): {formatProcessingAmount(netEstAmount)}</div>
        <div>Net + allocations ({currencyContext.processingCurrency}): {formatProcessingAmount(netPlusAllocAmount)}</div>
      </div>
      <div className="text-sm">Statut: {ps.locked ? 'LOCKED' : 'EDITABLE'}</div>
      <a className="inline-block text-blue-600 underline" href={`/api/payroll/payslips/${ps.id}/pdf`}>Télécharger PDF</a>
      <div className="space-y-3">
        {groupOrder.map(key => grouped[key] && (
          <div key={key} className="border rounded">
            <div className="bg-gray-100 px-3 py-2 text-sm font-semibold">{key}</div>
            <table className="text-sm w-full">
              <thead>
                <tr className="bg-white">
                  <th className="px-2 py-1 text-left">Code</th>
                  <th className="px-2 py-1 text-left">Libellé</th>
                  <th className="px-2 py-1 text-left">Montant</th>
                  <th className="px-2 py-1 text-left">Base</th>
                  <th className="px-2 py-1 text-left">Taux %</th>
                  <th className="px-2 py-1 text-left">Meta</th>
                </tr>
              </thead>
              <tbody>
                {grouped[key].map(l => (
                  <tr key={l.id || l.code} className="border-t">
                    <td className="px-2 py-1">{l.code}</td>
                    <td className="px-2 py-1">{l.label}</td>
                    <td className="px-2 py-1">{formatProcessingAmount(l.amount)}</td>
                    <td className="px-2 py-1">{l.baseAmount == null ? '' : formatProcessingAmount(l.baseAmount)}</td>
                    <td className="px-2 py-1">{typeof l.meta?.rate === 'number' ? (l.meta.rate * 100).toFixed(2) : ''}</td>
                    <td className="px-2 py-1 text-[11px] max-w-[220px] truncate" title={l.meta ? JSON.stringify(l.meta) : ''}>{l.meta ? JSON.stringify(l.meta) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500">(UI provisoire - calculs et ventilation à intégrer)</p>
    </div>
  );
}
