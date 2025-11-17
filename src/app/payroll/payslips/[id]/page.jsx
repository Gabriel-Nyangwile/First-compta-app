import prisma from '@/lib/prisma';
import { featureFlags } from '@/lib/features';

export const dynamic = 'force-dynamic';

export default async function PayslipDetailPage({ params }) {
  if (!featureFlags.payroll) return <div className="p-6">Module paie désactivé.</div>;
  const ps = await prisma.payslip.findUnique({
    where: { id: params.id },
    include: { employee: true, lines: true, period: true }
  });
  if (!ps) return <div className="p-6">Bulletin introuvable.</div>;
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Bulletin {ps.ref}</h1>
      <div className="text-sm text-gray-600">Employé: {ps.employee.firstName} {ps.employee.lastName}</div>
      <div className="text-sm">Période: {ps.period.month}/{ps.period.year}</div>
      <div className="text-sm">Brut: {ps.grossAmount.toString()} | Net: {ps.netAmount.toString()}</div>
      <div className="text-sm">Statut: {ps.locked ? 'LOCKED' : 'EDITABLE'}</div>
      <a className="inline-block text-blue-600 underline" href={`/api/payroll/payslips/${ps.id}/pdf`}>Télécharger PDF</a>
      <table className="text-sm min-w-[600px] border">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-2 py-1 text-left">Code</th>
            <th className="px-2 py-1 text-left">Libellé</th>
            <th className="px-2 py-1 text-left">Type</th>
            <th className="px-2 py-1 text-left">Montant</th>
            <th className="px-2 py-1 text-left">Base</th>
          </tr>
        </thead>
        <tbody>
          {ps.lines.map(l => (
            <tr key={l.id} className="border-t">
              <td className="px-2 py-1">{l.code}</td>
              <td className="px-2 py-1">{l.label}</td>
              <td className="px-2 py-1">{l.kind}</td>
              <td className="px-2 py-1">{l.amount.toString()}</td>
              <td className="px-2 py-1">{l.baseAmount?.toString() || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-500">(UI provisoire — calculs et ventilation à intégrer)</p>
    </div>
  );
}
