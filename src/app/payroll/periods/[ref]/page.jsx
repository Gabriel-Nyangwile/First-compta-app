import prisma from '@/lib/prisma';
import { featureFlags } from '@/lib/features';
import BackButtonLayoutHeader from '@/components/BackButtonLayoutHeader';
import LockButton from '../LockButton.jsx';
import PostButton from '../PostButton.jsx';
import { auditPayrollPeriod } from '@/lib/payroll/audit';
import AuditPanel from '../AuditPanel.jsx';
import ReverseButton from '../ReverseButton.jsx';
import { sanitizePlain } from '@/lib/sanitizePlain';

export const dynamic = 'force-dynamic';

export default async function PayrollPeriodDetail({ params }) {
  if (!featureFlags.payroll) return <div className="p-6">Module paie désactivé.</div>;
  const { ref } = await params;
  const rawPeriod = await prisma.payrollPeriod.findUnique({
    where: { ref },
    include: { payslips: { include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true } }, lines: { select: { code: true, amount: true, meta: true } } } } }
  });
  const period = rawPeriod ? {
    id: rawPeriod.id,
    ref: rawPeriod.ref,
    status: rawPeriod.status,
    payslips: rawPeriod.payslips.map(ps => ({
      id: ps.id,
      ref: ps.ref,
      grossAmount: ps.grossAmount?.toNumber?.() ?? ps.grossAmount,
      netAmount: ps.netAmount?.toNumber?.() ?? ps.netAmount,
      locked: ps.locked,
      employee: ps.employee,
      lines: ps.lines.map(l => ({ code: l.code, amount: l.amount?.toNumber?.() ?? l.amount, meta: l.meta || null }))
    }))
  } : null;
  if (!period) return <div className="p-6">Période introuvable.</div>;
  const auditRaw = period && period.status === 'POSTED' ? await auditPayrollPeriod(period.id) : null;
  // Aggregate totals breakdown across payslips
  let totals = null;
  if (period) {
    let grossTotal = 0, netTotal = 0, cnssEmployeeTotal = 0, iprTaxTotal = 0, cnssEmployerTotal = 0, onemTotal = 0, inppTotal = 0, overtimeTotal = 0;
    for (const ps of period.payslips) {
      grossTotal += ps.grossAmount || 0;
      netTotal += ps.netAmount || 0;
      for (const l of ps.lines) {
        const amt = Math.abs(l.amount || 0);
        if (l.code === 'CNSS_EMP') cnssEmployeeTotal += amt;
        else if (l.code === 'IPR') iprTaxTotal += amt;
        else if (l.code === 'CNSS_ER') cnssEmployerTotal += amt;
        else if (l.code === 'ONEM') onemTotal += amt;
        else if (l.code === 'INPP') inppTotal += amt;
        else if (l.code === 'OT') overtimeTotal += l.amount || 0; // overtime positive already
      }
    }
    const employerChargesTotal = cnssEmployerTotal + onemTotal + inppTotal;
    totals = { grossTotal, netTotal, cnssEmployeeTotal, iprTaxTotal, cnssEmployerTotal, onemTotal, inppTotal, employerChargesTotal, overtimeTotal, payslipCount: period.payslips.length };
  }
  const audit = auditRaw ? sanitizePlain(auditRaw) : null;
  const payrollJe = period.status === 'POSTED'
    ? await prisma.journalEntry.findFirst({ where: { sourceType: 'PAYROLL', sourceId: period.id }, select: { id: true } })
    : null;
  const hasJournal = !!payrollJe;
  return (
    <div className="p-6 space-y-4">
      <BackButtonLayoutHeader />
      <h1 className="text-xl font-semibold">Période {period.ref}</h1>
      <aside className="text-[11px] leading-relaxed bg-blue-50 border border-blue-200 text-blue-800 rounded p-2 max-w-prose">
        <strong>Référence Validation Paie:</strong> Règles & codes d'erreur détaillés
        {' '}<a className="underline hover:no-underline" href="https://github.com/Gabriel-Nyangwile/first-compta#188-validation-rules" target="_blank" rel="noopener noreferrer">README §18.8</a>
        {' '}| <a className="underline hover:no-underline" href="https://github.com/Gabriel-Nyangwile/first-compta#1518-règles-de-validation" target="_blank" rel="noopener noreferrer">FR §15.1.8</a>
        {' '}| <a className="underline hover:no-underline" href="https://github.com/Gabriel-Nyangwile/first-compta/blob/master/docs/payroll-validation.md" target="_blank" rel="noopener noreferrer">Cheat Sheet</a>.
        Les taux sont des décimaux [0,1]; les tranches fiscales restent strictement ascendantes; un conflit code renvoie <code>code.exists</code>.
      </aside>
      <div className="text-sm text-gray-600 flex items-center gap-4 flex-wrap">Statut: {period.status} {period.status === 'OPEN' && <LockButton periodId={period.id} />} {period.status === 'LOCKED' && <PostButton periodId={period.id} />} {period.status === 'POSTED' && <ReverseButton periodId={period.id} hasJournal={hasJournal} />} <a className="underline text-blue-600" href={`/payroll/periods/${period.ref}/inputs`}>Saisies</a> <a className="underline text-blue-600" href={`/api/payroll/period/${period.id}/summary`}>Résumé JSON</a> <a className="underline text-blue-600" href={`/api/payroll/period/${period.id}/summary?format=csv`}>Résumé CSV</a> <a className="underline text-blue-600" href={`/api/payroll/period/${period.id}/summary/pdf`}>Résumé PDF</a> <a className="underline text-blue-600" href={`/api/payroll/period/${period.id}/summary/xlsx`}>Résumé XLSX</a></div>
      {audit && (<AuditPanel audit={audit} periodId={period.id} />)}
      <section className="space-y-2">
        <h2 className="font-medium">Bulletins ({period.payslips.length})</h2>
        {totals && (
          <div className="border rounded p-3 bg-white text-xs mb-2">
            <div className="font-semibold mb-1">Totaux période</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1">
              <div>Brut total: {totals.grossTotal.toFixed(2)}</div>
              <div>Net total: {totals.netTotal.toFixed(2)}</div>
              <div>CNSS salarié total: {totals.cnssEmployeeTotal.toFixed(2)}</div>
              <div>IPR total: {totals.iprTaxTotal.toFixed(2)}</div>
              <div>CNSS employeur total: {totals.cnssEmployerTotal.toFixed(2)}</div>
              <div>ONEM total: {totals.onemTotal.toFixed(2)}</div>
              <div>INPP total: {totals.inppTotal.toFixed(2)}</div>
              <div>Charges employeur totales: {totals.employerChargesTotal.toFixed(2)}</div>
              <div>Heures suppl. total: {totals.overtimeTotal.toFixed(2)}</div>
              <div>Bulletins: {totals.payslipCount}</div>
            </div>
          </div>
        )}
        <table className="text-sm min-w-[600px] border">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-2 py-1 text-left">Ref</th>
              <th className="px-2 py-1 text-left">Employé</th>
              <th className="px-2 py-1 text-left">Brut</th>
              <th className="px-2 py-1 text-left">Net</th>
              <th className="px-2 py-1 text-left">Lock</th>
              <th className="px-2 py-1 text-left">PDF</th>
            </tr>
          </thead>
          <tbody>
            {period.payslips.map(ps => (
              <tr key={ps.id} className="border-t hover:bg-gray-50">
                <td className="px-2 py-1"><a href={`/payroll/payslips/${ps.id}`} className="text-blue-600 underline">{ps.ref}</a></td>
                <td className="px-2 py-1">{ps.employee.employeeNumber || ''} {ps.employee.firstName} {ps.employee.lastName}</td>
                <td className="px-2 py-1">{ps.grossAmount}</td>
                <td className="px-2 py-1">{ps.netAmount}</td>
                <td className="px-2 py-1">{ps.locked ? '🔒' : '—'}</td>
                <td className="px-2 py-1"><a href={`/api/payroll/payslips/${ps.id}/pdf`} className="underline">PDF</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
