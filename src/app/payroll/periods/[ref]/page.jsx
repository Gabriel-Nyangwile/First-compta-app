import prisma from '@/lib/prisma';
import { featureFlags } from '@/lib/features';

export const dynamic = 'force-dynamic';

export default async function PayrollPeriodDetail({ params }) {
  if (!featureFlags.payroll) return <div className="p-6">Module paie désactivé.</div>;
  const ref = params.ref;
  const period = await prisma.payrollPeriod.findUnique({
    where: { ref },
    include: { payslips: { select: { id: true, ref: true, grossAmount: true, netAmount: true, locked: true, employee: { select: { firstName: true, lastName: true, employeeNumber: true } } } } }
  });
  if (!period) return <div className="p-6">Période introuvable.</div>;
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Période {period.ref}</h1>
      <div className="text-sm text-gray-600">Statut: {period.status}</div>
      <section className="space-y-2">
        <h2 className="font-medium">Bulletins ({period.payslips.length})</h2>
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
                <td className="px-2 py-1">{ps.grossAmount.toString()}</td>
                <td className="px-2 py-1">{ps.netAmount.toString()}</td>
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
