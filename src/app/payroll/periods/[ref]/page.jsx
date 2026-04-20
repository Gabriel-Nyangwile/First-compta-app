import prisma from '@/lib/prisma';
import { featureFlags } from '@/lib/features';
import BackButtonLayoutHeader from '@/components/BackButtonLayoutHeader';
import LockButton from '../LockButton.jsx';
import PostButton from '../PostButton.jsx';
import { getPayrollCurrencyContext } from '@/lib/payroll/context';
import { auditPayrollPeriod } from '@/lib/payroll/audit';
import AuditPanel from '../AuditPanel.jsx';
import RepairStatusButton from '../RepairStatusButton.jsx';
import ReverseButton from '../ReverseButton.jsx';
import SettlementButton from '../SettlementButton.jsx';
import PayrollLetteringButton from '../PayrollLetteringButton.jsx';
import { sanitizePlain } from '@/lib/sanitizePlain';
import { listPayrollSettlements } from '@/lib/payroll/settlement';
import { aggregatePeriodSummary } from '@/lib/payroll/aggregatePeriod';
import { getCurrentPayrollJournal } from '@/lib/payroll/journals';
import { getPayrollLetteringSummary } from '@/lib/payroll/lettering';
import { formatAmount } from '@/lib/utils';
import { cookies } from 'next/headers';
import { getCompanyIdFromCookies } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export default async function PayrollPeriodDetail({ params, searchParams }) {
  if (!featureFlags.payroll) return <div className="p-6">Module paie desactive.</div>;
  const { ref } = await params;
  const sp = await searchParams;
  const employeeFilter = sp?.employeeId || null;
  const cookieStore = await cookies();
  const companyId = getCompanyIdFromCookies(cookieStore);
  if (!companyId) return <div className="p-6">companyId requis (cookie company-id ou DEFAULT_COMPANY_ID).</div>;
  const currencyContext = await getPayrollCurrencyContext(companyId);
  const fmt = (value) => formatAmount(value, currencyContext.processingCurrency);
  const rawPeriod = await prisma.payrollPeriod.findUnique({
    where: { companyId_ref: { companyId, ref } },
    include: {
      payslips: {
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
          lines: { select: { code: true, amount: true, meta: true } },
        },
      },
    },
  });
  const period = rawPeriod
    ? {
        id: rawPeriod.id,
        ref: rawPeriod.ref,
        status: rawPeriod.status,
        payslips: rawPeriod.payslips.map((ps) => ({
          id: ps.id,
          ref: ps.ref,
          grossAmount: ps.grossAmount?.toNumber?.() ?? ps.grossAmount,
          netAmount: ps.netAmount?.toNumber?.() ?? ps.netAmount,
          locked: ps.locked,
          employee: ps.employee,
          lines: ps.lines.map((l) => ({ code: l.code, amount: l.amount?.toNumber?.() ?? l.amount, meta: l.meta || null })),
        })),
      }
    : null;
  if (!period) return <div className="p-6">Periode introuvable.</div>;
  const payrollJe =
    period.status === 'POSTED'
      ? await getCurrentPayrollJournal(prisma, period.id, companyId, { id: true, description: true })
      : null;
  const hasJournal = !!payrollJe;
  const auditRaw =
    period.status === 'POSTED' && hasJournal
      ? await auditPayrollPeriod(period.id, prisma, companyId)
      : null;
  const periodSummary = await aggregatePeriodSummary(period.id, companyId);
  const payrollLettering = await getPayrollLetteringSummary({ periodId: period.id, companyId });
  const totals = periodSummary?.totals || null;
  const liabilities = periodSummary?.liabilities || [];
  const liabilityTotals = periodSummary?.liabilityTotals || null;
  const liabilityLetteringMap = new Map((payrollLettering?.items || []).map((item) => [item.liabilityCode, item]));
  const employeeSettlementMap = new Map((periodSummary?.employees || []).map((employee) => [employee.payslipId, employee]));
  const audit = auditRaw ? sanitizePlain(auditRaw) : null;
  const allSettlements =
    period.status === 'POSTED' ? await listPayrollSettlements(period.id, companyId) : [];
  let settlements = allSettlements.filter((settlement) => settlement.liabilityCode === 'NET_PAY');
  const liabilitySettlements = allSettlements.filter((settlement) => settlement.liabilityCode !== 'NET_PAY');
  if (employeeFilter) {
    settlements = settlements.filter((s) => s.employeeId === employeeFilter);
  }
  const filteredSettledTotal = settlements.reduce((sum, settlement) => sum + (settlement.amount || 0), 0);
  const settledTotal = totals?.settledTotal ?? filteredSettledTotal;
  const isFullySettled = totals ? totals.remainingTotal <= 0.005 : false;
  const isPartiallySettled = totals ? totals.settledTotal > 0.005 && totals.remainingTotal > 0.005 : filteredSettledTotal > 0 && !isFullySettled;
  const settlementEmployees = Array.from(new Set(settlements.map((s) => s.employeeId).filter(Boolean)));
  const employeeLabel = (empId) => {
    const ps = period.payslips.find((p) => p.employee.id === empId);
    if (!ps) return empId;
    const e = ps.employee;
    return `${e.employeeNumber || ''} ${e.firstName} ${e.lastName}`.trim();
  };
  const auditBadge = audit ? (
    <div
      className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
        audit.balanced && audit.mismatchCount === 0
          ? 'bg-green-100 text-green-800 border border-green-200'
          : 'bg-amber-100 text-amber-800 border border-amber-200'
      }`}
    >
      {audit.balanced && audit.mismatchCount === 0 ? 'Audit OK' : `Ecarts: ${audit.mismatchCount || 0}`}
    </div>
  ) : null;
  return (
    <div className="p-6 space-y-4">
      <BackButtonLayoutHeader />
      <h1 className="text-xl font-semibold">Periode {period.ref}</h1>
      <div className="text-sm text-gray-600">
        Devise de traitement: <span className="font-medium">{currencyContext.processingCurrency}</span> · Devise fiscale: <span className="font-medium">{currencyContext.fiscalCurrency}</span>
      </div>
      {period.status === 'POSTED' && !hasJournal && (
        <div className="border rounded p-3 bg-amber-50 text-sm text-amber-900 border-amber-200">
          La période est marquée `POSTED`, mais aucun journal de paie principal n’est lié à cette période. L’audit détaillé est donc indisponible tant que l’écriture de paie n’a pas été régénérée ou rétablie.
          <div className="mt-3">
            <RepairStatusButton periodId={period.id} />
          </div>
        </div>
      )}
      {audit && (
        <div className="border rounded p-3 bg-white text-sm flex items-center gap-4 flex-wrap">
          {auditBadge}
          <div>Journal: {audit.journalNumber || '-'}</div>
          <div>Debit/Credit: {(audit.debitTotal ?? 0).toFixed(2)} / {(audit.creditTotal ?? 0).toFixed(2)}</div>
          <div>Mismatches: {audit.mismatchCount ?? 0}</div>
          <a className="underline text-blue-600" href={`/api/payroll/period/${period.id}/audit`}>
            JSON audit
          </a>
          <form action={`/api/payroll/period/${period.id}/audit`} method="get" className="inline">
            <button type="submit" className="px-2 py-1 rounded bg-blue-700 text-white text-xs">
              Rafraichir audit
            </button>
          </form>
        </div>
      )}
      <aside className="text-[11px] leading-relaxed bg-blue-50 border border-blue-200 text-blue-800 rounded p-2 max-w-prose">
        <strong>Reference Validation Paie:</strong> Regles & codes d'erreur detailles{' '}
        <a
          className="underline hover:no-underline"
          href="https://github.com/Gabriel-Nyangwile/first-compta#188-validation-rules"
          target="_blank"
          rel="noopener noreferrer"
        >
          README 18.8
        </a>{' '}
        |{' '}
        <a
          className="underline hover:no-underline"
          href="https://github.com/Gabriel-Nyangwile/first-compta#1518-regles-de-validation"
          target="_blank"
          rel="noopener noreferrer"
        >
          FR 15.1.8
        </a>{' '}
        |{' '}
        <a
          className="underline hover:no-underline"
          href="https://github.com/Gabriel-Nyangwile/first-compta/blob/master/docs/payroll-validation.md"
          target="_blank"
          rel="noopener noreferrer"
        >
          Cheat Sheet
        </a>
        . Les taux sont des decimaux [0,1]; les tranches fiscales restent strictement ascendantes; un conflit code renvoie
        <code>code.exists</code>.
      </aside>
      <div className="text-sm text-gray-600 flex items-center gap-4 flex-wrap">
        Statut: {period.status}
        {period.status === 'POSTED' && isFullySettled && <span className="px-2 py-[2px] rounded text-xs font-semibold border bg-emerald-100 text-emerald-800 border-emerald-200">SETTLED</span>}
        {period.status === 'POSTED' && isPartiallySettled && <span className="px-2 py-[2px] rounded text-xs font-semibold border bg-amber-100 text-amber-800 border-amber-200">PARTIAL_SETTLEMENT</span>}
        {period.status === 'OPEN' && <LockButton periodId={period.id} />}
        {period.status === 'LOCKED' && <PostButton periodId={period.id} />}
        {period.status === 'POSTED' && (
          <>
            <ReverseButton periodId={period.id} hasJournal={hasJournal} />
            {!isFullySettled && <SettlementButton periodId={period.id} liabilityCode="NET_PAY" buttonLabel="Régler net" />}
          </>
        )}
        <a className="underline text-blue-600" href={`/payroll/periods/${period.ref}/inputs`}>
          Saisies
        </a>
        <a className="underline text-blue-600" href={`/api/payroll/period/${period.id}/summary`}>
          Resume JSON
        </a>
        <a className="underline text-blue-600" href={`/api/payroll/period/${period.id}/summary?format=csv`}>
          Resume CSV
        </a>
        <a className="underline text-blue-600" href={`/api/payroll/period/${period.id}/summary?format=csv&section=liabilities`}>
          Passifs CSV
        </a>
        <a className="underline text-blue-600" href={`/api/payroll/period/${period.id}/summary/pdf`}>
          Resume PDF
        </a>
        <a className="underline text-blue-600" href={`/api/payroll/period/${period.id}/summary/xlsx`}>
          Resume XLSX
        </a>
        <a className="underline text-blue-600" href={`/api/payroll/period/${period.id}/lettering`}>
          Lettrage JSON
        </a>
        <PayrollLetteringButton periodId={period.id} buttonLabel="Relettrer paie" />
      </div>
      {audit && <AuditPanel audit={audit} periodId={period.id} />}
      {period.status === 'POSTED' && settlements.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-medium">Reglements net (PAYSET)</h2>
            <span className="text-xs text-gray-600">Regle période: {fmt(settledTotal)} / Net période: {fmt(totals?.netTotal ?? 0)}</span>
            {employeeFilter && <span className="text-xs text-gray-500">Vue filtrée: {fmt(filteredSettledTotal)}</span>}
            <a
              className="text-xs underline text-blue-700"
              href={`/api/payroll/period/${period.id}/settlements?format=csv${employeeFilter ? `&employeeId=${employeeFilter}` : ''}`}
            >
              Exporter CSV
            </a>
            {settlementEmployees.length > 0 && (
              <form method="get" className="text-xs flex items-center gap-2">
                <label htmlFor="employeeId">Filtrer employe</label>
                <select name="employeeId" id="employeeId" defaultValue={employeeFilter ?? ''} className="border rounded px-1 py-[2px]">
                  <option value="">(tous)</option>
                  {settlementEmployees.map((id) => (
                    <option key={id} value={id}>
                      {employeeLabel(id)}
                    </option>
                  ))}
                </select>
                <button type="submit" className="px-2 py-[2px] rounded bg-blue-600 text-white">
                  Appliquer
                </button>
                {employeeFilter && (
                  <a href="." className="underline text-blue-700">
                    Reinitialiser
                  </a>
                )}
              </form>
            )}
          </div>
          <table className="text-sm min-w-[520px] border">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 py-1 text-left">Ref</th>
                <th className="px-2 py-1 text-left">Journal</th>
                <th className="px-2 py-1 text-left">Date</th>
                <th className="px-2 py-1 text-left">Debit/Credit</th>
                <th className="px-2 py-1 text-left">Banque</th>
                <th className="px-2 py-1 text-left">Employe</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-2 py-1">{s.voucherRef || s.description || '-'}</td>
                  <td className="px-2 py-1">{s.number}</td>
                  <td className="px-2 py-1">{new Date(s.date).toLocaleDateString('fr-FR')}</td>
                  <td className="px-2 py-1">{fmt(s.debit ?? 0)} / {fmt(s.credit ?? 0)}</td>
                  <td className="px-2 py-1">{s.bankAccount || '-'}</td>
                  <td className="px-2 py-1">{s.employeeId ? employeeLabel(s.employeeId) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <section className="space-y-2">
        <h2 className="font-medium">Bulletins ({period.payslips.length})</h2>
        {totals && (
          <div className="border rounded p-3 bg-white text-xs mb-2">
            <div className="font-semibold mb-1">Totaux periode</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1">
              <div>Brut total: {fmt(totals.grossTotal)}</div>
              <div>Net total: {fmt(totals.netTotal)}</div>
              <div>Réglé total: {fmt(totals.settledTotal)}</div>
              <div>Reste à régler: {fmt(totals.remainingTotal)}</div>
              <div>CNSS salarie total: {fmt(totals.cnssEmployeeTotal)}</div>
              <div>IPR total: {fmt(totals.iprTaxTotal)}</div>
              <div>CNSS employeur total: {fmt(totals.cnssEmployerTotal)}</div>
              <div>ONEM total: {fmt(totals.onemTotal)}</div>
              <div>INPP total: {fmt(totals.inppTotal)}</div>
              <div>Charges employeur totales: {fmt(totals.employerChargesTotal)}</div>
              <div>Heures suppl. total: {fmt(totals.overtimeTotal)}</div>
              <div>Bulletins: {totals.payslipCount}</div>
            </div>
          </div>
        )}
        {liabilityTotals && (
          <div className="border rounded p-3 bg-amber-50 text-xs mb-2">
            <div className="font-semibold mb-1">Passifs paie à régler</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1">
              <div>Total passifs: {fmt(liabilityTotals.overallTotal)}</div>
              <div>Réglé: {fmt(liabilityTotals.settledTotal)}</div>
              <div>Reste global: {fmt(liabilityTotals.remainingTotal)}</div>
              <div>Passifs sociaux: {fmt(liabilityTotals.socialTotal)}</div>
              <div>Passifs fiscaux: {fmt(liabilityTotals.fiscalTotal)}</div>
              <div>Net salariés: {fmt(liabilityTotals.employeeNetTotal)}</div>
            </div>
            <div className="mt-2 text-[11px] text-gray-600">
              Les passifs paie sont réglables et lettrables. Le suivi ci-dessous combine état de règlement et état de rapprochement des lignes de passif dans le grand livre.
            </div>
          </div>
        )}
        {payrollLettering?.items?.length > 0 && (
          <div className="border rounded p-3 bg-slate-50 text-xs mb-2">
            <div className="font-semibold mb-2">Lettrage paie grand livre</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {payrollLettering.items.map((item) => (
                <div key={item.liabilityCode} className="border rounded bg-white px-3 py-2">
                  <div className="font-medium">{item.liabilityCode} · {item.status}</div>
                  <div>Réf lettrage: {item.letterRef || '—'}</div>
                  <div>Débit lettré: {(item.letteredDebit ?? 0).toFixed(2)} / Crédit lettré: {(item.letteredCredit ?? 0).toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {liabilities.length > 0 && (
          <table className="text-sm min-w-[900px] border mb-3">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1 text-left">Code</th>
                <th className="px-2 py-1 text-left">Nature</th>
                <th className="px-2 py-1 text-left">Groupe</th>
                <th className="px-2 py-1 text-left">Total</th>
                <th className="px-2 py-1 text-left">Réglé</th>
                <th className="px-2 py-1 text-left">Reste</th>
                <th className="px-2 py-1 text-left">Statut</th>
                <th className="px-2 py-1 text-left">Flux prêt</th>
                <th className="px-2 py-1 text-left">Lettrage</th>
                <th className="px-2 py-1 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {liabilities.map((item) => {
                const letteringItem = liabilityLetteringMap.get(item.code);
                return (
                <tr key={item.code} className="border-t">
                  <td className="px-2 py-1">{item.code}</td>
                  <td className="px-2 py-1">{item.label}</td>
                  <td className="px-2 py-1">{item.group}</td>
                  <td className="px-2 py-1">{fmt(item.total)}</td>
                  <td className="px-2 py-1">{fmt(item.settled)}</td>
                  <td className="px-2 py-1">{fmt(item.remaining)}</td>
                  <td className="px-2 py-1">{item.settlementStatus}</td>
                  <td className="px-2 py-1">{item.paymentFlowReady ? 'oui' : 'non'}</td>
                  <td className="px-2 py-1">
                    <div>{letteringItem?.status || 'UNMATCHED'}</div>
                    <div className="text-[11px] text-gray-500">{letteringItem?.letterRef || '—'}</div>
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex flex-col gap-1 items-start">
                      {period.status === 'POSTED' && item.paymentFlowReady && item.remaining > 0.005 ? (
                        <SettlementButton
                          periodId={period.id}
                          liabilityCode={item.code}
                          buttonLabel={item.code === 'NET_PAY' ? 'Régler net' : `Régler ${item.code}`}
                        />
                      ) : (
                        <span className="text-xs text-gray-500">-</span>
                      )}
                      <PayrollLetteringButton periodId={period.id} liabilityCode={item.code} buttonLabel={`Lettrer ${item.code}`} />
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {liabilitySettlements.length > 0 && (
          <section className="space-y-2 mb-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="font-medium">Règlements organismes et fiscalité</h3>
              <a className="text-xs underline text-blue-700" href={`/api/payroll/period/${period.id}/settlements?format=csv`}>
                Exporter CSV global
              </a>
            </div>
            <table className="text-sm min-w-[760px] border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-2 py-1 text-left">Ref</th>
                  <th className="px-2 py-1 text-left">Nature</th>
                  <th className="px-2 py-1 text-left">Journal</th>
                  <th className="px-2 py-1 text-left">Date</th>
                  <th className="px-2 py-1 text-left">Débit/Crédit</th>
                  <th className="px-2 py-1 text-left">Banque</th>
                  <th className="px-2 py-1 text-left">Compte passif</th>
                  <th className="px-2 py-1 text-left">Lettrage</th>
                </tr>
              </thead>
              <tbody>
                {liabilitySettlements.map((settlement) => (
                  <tr key={settlement.id} className="border-t">
                    <td className="px-2 py-1">{settlement.voucherRef || '-'}</td>
                    <td className="px-2 py-1">{settlement.liabilityCode}</td>
                    <td className="px-2 py-1">{settlement.number}</td>
                    <td className="px-2 py-1">{new Date(settlement.date).toLocaleDateString('fr-FR')}</td>
                    <td className="px-2 py-1">{fmt(settlement.debit ?? 0)} / {fmt(settlement.credit ?? 0)}</td>
                    <td className="px-2 py-1">{settlement.bankAccount || '-'}</td>
                    <td className="px-2 py-1">{settlement.liabilityAccount || '-'}</td>
                    <td className="px-2 py-1">{settlement.letterStatus || 'UNMATCHED'} · {settlement.letterRef || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        <table className="text-sm min-w-[600px] border">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-2 py-1 text-left">Ref</th>
              <th className="px-2 py-1 text-left">Employe</th>
              <th className="px-2 py-1 text-left">Brut</th>
              <th className="px-2 py-1 text-left">Net</th>
              <th className="px-2 py-1 text-left">Réglé</th>
              <th className="px-2 py-1 text-left">Reste</th>
              <th className="px-2 py-1 text-left">Lock</th>
              <th className="px-2 py-1 text-left">PDF</th>
            </tr>
          </thead>
          <tbody>
            {period.payslips.map((ps) => {
              const settlementInfo = employeeSettlementMap.get(ps.id);
              return (
              <tr key={ps.id} className="border-t hover:bg-gray-50">
                <td className="px-2 py-1">
                  <a href={`/payroll/payslips/${ps.id}`} className="text-blue-600 underline">
                    {ps.ref}
                  </a>
                </td>
                <td className="px-2 py-1">{ps.employee.employeeNumber || ''} {ps.employee.firstName} {ps.employee.lastName}</td>
                <td className="px-2 py-1">{fmt(ps.grossAmount)}</td>
                <td className="px-2 py-1">{fmt(ps.netAmount)}</td>
                <td className="px-2 py-1">{fmt(settlementInfo?.settledAmount ?? 0)}</td>
                <td className="px-2 py-1">{fmt(settlementInfo?.remainingAmount ?? (ps.netAmount || 0))}</td>
                <td className="px-2 py-1">{ps.locked ? 'V' : '-'}</td>
                <td className="px-2 py-1">
                  <a href={`/api/payroll/payslips/${ps.id}/pdf`} className="underline">
                    PDF
                  </a>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </section>
    </div>
  );
}
