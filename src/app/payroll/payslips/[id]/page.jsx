import prisma from '@/lib/prisma';
import { featureFlags } from '@/lib/features';
import BackButtonLayoutHeader from '@/components/BackButtonLayoutHeader';
import { toNumber, roundEur } from '@/lib/payroll/currency';
import { computeCnssQpoFromGrossEur, computeIprBaseFromGrossEur, computeIprTaxFromGrossEur, computeAllocFamEur } from '@/lib/payroll/calc-utils';
import { notFound } from 'next/navigation';
import RecalcButton from '../RecalcButton.jsx';
import ExportPayslipJson from '../ExportPayslipJson.jsx';
import { sanitizePlain } from '@/lib/sanitizePlain';

export const dynamic = 'force-dynamic';

export default async function PayslipDetailPage({ params }) {
  if (!featureFlags.payroll) return <div className="p-6">Module paie désactivé.</div>;
  const { id } = await params;
  if (!id) return notFound();
  const psRaw = await prisma.payslip.findUnique({
    where: { id },
    include: { employee: true, lines: true, period: true }
  });
  if (!psRaw) return notFound();
  // Sanitize all Decimal/Date fields to primitives before any potential client boundary.
  const ps = sanitizePlain(psRaw);
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
  const fxRate = iprLine?.meta?.fxRate ?? null;
  const cnssEmployer = Math.abs(cnssErLine?.amount ?? 0);
  const onem = Math.abs(onemLine?.amount ?? 0);
  const inpp = Math.abs(inppLine?.amount ?? 0);
  const overtime = overtimeLine?.amount ?? 0;
  const employerCharges = cnssEmployer + onem + inpp;
  const employeeDeductions = cnssEmployee + iprTax + lines.filter(l => l.kind === 'RETENUE').reduce((s,l)=> s + Math.abs(l.amount??0),0);
  const grossEur = toNumber(ps.grossAmount);
  const cnssEur = computeCnssQpoFromGrossEur(grossEur);
  const iprBaseEur = computeIprBaseFromGrossEur(grossEur, cnssEur);
  const iprEur = computeIprTaxFromGrossEur(grossEur, { cnssQpoEur: cnssEur });
  const children = ps.employee?.childrenUnder18 ?? 0;
  const allocFamEur = computeAllocFamEur(children);
  const netEstEur = roundEur(grossEur - cnssEur - iprEur);
  const netPlusAllocEur = roundEur(netEstEur + allocFamEur);
  return (
    <div className="p-6 space-y-4">
      <BackButtonLayoutHeader />
      <h1 className="text-xl font-semibold">Bulletin {ps.ref}</h1>
      <div className="text-sm text-gray-600">Employé: {ps.employee.firstName} {ps.employee.lastName}</div>
      <div className="text-sm">Période: {ps.period.month}/{ps.period.year}</div>
      <div className="text-sm flex items-center gap-4 flex-wrap">Brut: {ps.grossAmount?.toFixed?.(2) ?? ps.grossAmount} | Net (stocké): {ps.netAmount?.toFixed?.(2) ?? ps.netAmount} <ExportPayslipJson payslip={ps} /></div>
      {!ps.locked && <RecalcButton payslipId={ps.id} />}
      <div className="border rounded p-3 bg-white text-sm">
        <div className="font-medium mb-2">Ventilation principale</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          <div>CNSS salarié: {cnssEmployee.toFixed(2)}</div>
          <div>CNSS employeur: {cnssEmployer.toFixed(2)}</div>
          <div>IPR: {iprTax.toFixed(2)}</div>
          <div>Base IPR (RI): {riBase==null?'—':Number(riBase).toFixed(2)}</div>
          <div>RI CDF: {riCDF==null?'—':Number(riCDF).toFixed(2)}</div>
          <div>FX rate: {fxRate==null?'—':fxRate}</div>
          <div>ONEM: {onem.toFixed(2)}</div>
          <div>INPP: {inpp.toFixed(2)}</div>
          <div>Charges employeur totales: {employerCharges.toFixed(2)}</div>
          <div>Déductions salarié totales: {employeeDeductions.toFixed(2)}</div>
          <div>Heures suppl.: {overtime.toFixed(2)}</div>
          <div>Nb lignes: {lines.length}</div>
        </div>
      </div>
      <div className="border rounded p-3 bg-gray-50 text-sm">
        <div className="font-medium mb-2">Calcul (brouillon)</div>
        <div>CNSS QPO (EUR): {cnssEur.toFixed(2)}</div>
        <div>Base IPR (EUR): {iprBaseEur.toFixed(2)}</div>
        <div>IPR (EUR): {iprEur.toFixed(2)}</div>
        <div>Allocations familiales (EUR) enfants={children}: {allocFamEur.toFixed(2)}</div>
        <div className="mt-2">Net estimé (EUR, sans allocations): {netEstEur.toFixed(2)}</div>
        <div>Net + allocations (EUR): {netPlusAllocEur.toFixed(2)}</div>
      </div>
      <div className="text-sm">Statut: {ps.locked ? 'LOCKED' : 'EDITABLE'}</div>
      <a className="inline-block text-blue-600 underline" href={`/api/payroll/payslips/${ps.id}/pdf`}>Télécharger PDF</a>
      <table className="text-sm min-w-[900px] border">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-2 py-1 text-left">Code</th>
            <th className="px-2 py-1 text-left">Libellé</th>
            <th className="px-2 py-1 text-left">Type</th>
            <th className="px-2 py-1 text-left">Montant</th>
            <th className="px-2 py-1 text-left">Base</th>
            <th className="px-2 py-1 text-left">Taux %</th>
            <th className="px-2 py-1 text-left">Meta</th>
          </tr>
        </thead>
        <tbody>
          {ps.lines.map(l => (
            <tr key={l.id} className="border-t">
              <td className="px-2 py-1">{l.code}</td>
              <td className="px-2 py-1">{l.label}</td>
              <td className="px-2 py-1">{l.kind}</td>
              <td className="px-2 py-1">{l.amount?.toFixed?.(2) ?? l.amount}</td>
              <td className="px-2 py-1">{l.baseAmount?.toFixed?.(2) ?? (l.baseAmount || '')}</td>
              <td className="px-2 py-1">{typeof l.meta?.rate === 'number' ? (l.meta.rate * 100).toFixed(2) : ''}</td>
              <td className="px-2 py-1 text-[11px] max-w-[220px] truncate" title={l.meta ? JSON.stringify(l.meta) : ''}>{l.meta ? JSON.stringify(l.meta) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-500">(UI provisoire — calculs et ventilation à intégrer)</p>
    </div>
  );
}
