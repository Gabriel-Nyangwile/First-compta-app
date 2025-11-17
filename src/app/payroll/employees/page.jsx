import prisma from '@/lib/prisma';
import { featureFlags } from '@/lib/features';
import BackButtonLayoutHeader from '@/components/BackButtonLayoutHeader';

export const dynamic = 'force-dynamic';

export default async function PayrollEmployeesPage() {
  if (!featureFlags.payroll) return <div className="p-6">Module paie désactivé.</div>;
  const employees = await prisma.employee.findMany({
    take: 100,
    orderBy: [{ lastName: 'asc' }],
    select: { id: true, employeeNumber: true, firstName: true, lastName: true, isExpat: true, status: true }
  });
  return (
    <div className="p-6 space-y-4">
      <BackButtonLayoutHeader />
      <h1 className="text-xl font-semibold">Employés (Paie)</h1>
      <table className="min-w-[520px] text-sm border">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-2 py-1 text-left">Matricule</th>
            <th className="px-2 py-1 text-left">Nom</th>
            <th className="px-2 py-1 text-left">Expat</th>
            <th className="px-2 py-1 text-left">Statut</th>
            <th className="px-2 py-1 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {employees.map(e => (
            <tr key={e.id} className="border-t hover:bg-gray-50">
              <td className="px-2 py-1">{e.employeeNumber || '—'}</td>
              <td className="px-2 py-1">{e.lastName} {e.firstName}</td>
              <td className="px-2 py-1">{e.isExpat ? '🌍' : ''}</td>
              <td className="px-2 py-1">{e.status}</td>
              <td className="px-2 py-1"><a href={`/payroll/employees/${e.id}`} className="text-blue-600 underline">Détail</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
