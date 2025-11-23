import prisma from '@/lib/prisma';
import { featureFlags } from '@/lib/features';
import BackButtonLayoutHeader from '@/components/BackButtonLayoutHeader';

export const dynamic = 'force-dynamic';

export default async function PayrollPeriodsPage() {
  if (!featureFlags.payroll) {
    return <div className="p-6 text-sm text-gray-600">Module paie désactivé.</div>;
  }
  const periods = await prisma.payrollPeriod.findMany({
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    take: 24,
  });
  return (
    <div className="p-6 space-y-4">
      <BackButtonLayoutHeader />
      <h1 className="text-xl font-semibold">Périodes de Paie</h1>
      <p className="text-sm text-gray-600">Liste des dernières périodes (draft UI). Réf validation: <a className="underline" href="https://github.com/Gabriel-Nyangwile/first-compta#188-validation-rules" target="_blank" rel="noopener noreferrer">README 18.8</a> · <a className="underline" href="https://github.com/Gabriel-Nyangwile/first-compta/blob/master/docs/payroll-validation.md" target="_blank" rel="noopener noreferrer">Cheat Sheet</a>.</p>
      <table className="min-w-[480px] text-sm border">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-2 py-1 text-left">Ref</th>
            <th className="px-2 py-1 text-left">Mois</th>
            <th className="px-2 py-1 text-left">Année</th>
            <th className="px-2 py-1 text-left">Statut</th>
            <th className="px-2 py-1 text-left">Bulletins</th>
          </tr>
        </thead>
        <tbody>
          {periods.map(p => (
            <tr key={p.id} className="border-t hover:bg-gray-50">
              <td className="px-2 py-1"><a className="text-blue-600 underline" href={`/payroll/periods/${p.ref}`}>{p.ref}</a></td>
              <td className="px-2 py-1">{p.month}</td>
              <td className="px-2 py-1">{p.year}</td>
              <td className="px-2 py-1">{p.status}</td>
              <td className="px-2 py-1">{p._count?.payslips ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
