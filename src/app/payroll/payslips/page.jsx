import prisma from '@/lib/prisma';
import { featureFlags } from '@/lib/features';
import BackButtonLayoutHeader from '@/components/BackButtonLayoutHeader';

export const dynamic = 'force-dynamic';

export default async function PayslipListPage() {
  if (!featureFlags.payroll) return <div className="p-6">Module paie désactivé.</div>;
  const payslips = await prisma.payslip.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true } }, period: true }
  });
  return (
    <div className="p-6 space-y-4">
      <BackButtonLayoutHeader />
      <h1 className="text-xl font-semibold">Bulletins (50 derniers)</h1>
      <table className="text-sm min-w-[700px] border">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-2 py-1 text-left">Ref</th>
            <th className="px-2 py-1 text-left">Employé</th>
            <th className="px-2 py-1 text-left">Période</th>
            <th className="px-2 py-1 text-left">Brut</th>
            <th className="px-2 py-1 text-left">Net</th>
            <th className="px-2 py-1 text-left">Statut</th>
            <th className="px-2 py-1 text-left">PDF</th>
          </tr>
        </thead>
        <tbody>
          {payslips.map(ps => (
            <tr key={ps.id} className="border-t">
              <td className="px-2 py-1"><a className="text-blue-600 underline" href={`/payroll/payslips/${ps.id}`}>{ps.ref}</a></td>
              <td className="px-2 py-1">{ps.employee.lastName} {ps.employee.firstName} ({ps.employee.employeeNumber || '—'})</td>
              <td className="px-2 py-1">{ps.period.month}/{ps.period.year}</td>
              <td className="px-2 py-1">{ps.grossAmount.toString()}</td>
              <td className="px-2 py-1">{ps.netAmount.toString()}</td>
              <td className="px-2 py-1">{ps.locked ? 'LOCKED' : 'EDITABLE'}</td>
              <td className="px-2 py-1"><a className="underline" href={`/api/payroll/payslips/${ps.id}/pdf`}>PDF</a></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!payslips.length && <div className="text-sm text-gray-600">Aucun bulletin.</div>}
      <p className="text-xs text-gray-500">Liste simplifiée. Pagination / filtres à venir.</p>
    </div>
  );
}