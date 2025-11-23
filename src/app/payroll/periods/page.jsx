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
    include: { _count: { select: { payslips: true } } },
  });

  const badge = (status) => {
    const map = {
      OPEN: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
      LOCKED: 'bg-blue-100 text-blue-800 border border-blue-200',
      POSTED: 'bg-green-100 text-green-800 border border-green-200',
    };
    return <span className={`px-2 py-[2px] rounded text-xs font-semibold ${map[status] || 'bg-gray-100 text-gray-700 border border-gray-200'}`}>{status}</span>;
  };

  return (
    <div className="p-6 space-y-4">
      <BackButtonLayoutHeader />
      <h1 className="text-xl font-semibold">Périodes de paie</h1>
      <p className="text-sm text-gray-600">24 dernières périodes. Réf validation: <a className="underline" href="https://github.com/Gabriel-Nyangwile/first-compta#188-validation-rules" target="_blank" rel="noopener noreferrer">README 18.8</a> · <a className="underline" href="https://github.com/Gabriel-Nyangwile/first-compta/blob/master/docs/payroll-validation.md" target="_blank" rel="noopener noreferrer">Cheat Sheet</a>.</p>
      <table className="min-w-[520px] text-sm border rounded overflow-hidden">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-2 py-1 text-left">Ref</th>
            <th className="px-2 py-1 text-left">Période</th>
            <th className="px-2 py-1 text-left">Statut</th>
            <th className="px-2 py-1 text-left">Bulletins</th>
            <th className="px-2 py-1 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {periods.map(p => (
            <tr key={p.id} className="border-t hover:bg-gray-50">
              <td className="px-2 py-1"><a className="text-blue-600 underline" href={`/payroll/periods/${p.ref}`}>{p.ref}</a></td>
              <td className="px-2 py-1">{p.month}/{p.year}</td>
              <td className="px-2 py-1">{badge(p.status)}</td>
              <td className="px-2 py-1">{p._count?.payslips ?? '-'}</td>
              <td className="px-2 py-1 space-x-2">
                <a className="text-blue-600 underline" href={`/payroll/periods/${p.ref}`}>Détail</a>
                <a className="text-blue-600 underline" href={`/api/payroll/period/${p.id}/summary`}>Résumé JSON</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
