import prisma from '@/lib/prisma';
import BackButtonLayoutHeader from '@/components/BackButtonLayoutHeader';
import InputsPanel from '../../InputsPanel.jsx';
import { featureFlags } from '@/lib/features';
import { sanitizeArray } from '@/lib/sanitizePlain';

export const dynamic = 'force-dynamic';

export default async function PeriodInputsPage({ params }) {
  if (!featureFlags.payroll) return <div className="p-6">Module paie désactivé.</div>;
  const { ref } = await params;
  const period = await prisma.payrollPeriod.findUnique({
    where: { ref },
    select: { id: true, ref: true, status: true },
  });
  if (!period) return <div className="p-6">Période introuvable.</div>;
  const employeesRaw = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, firstName: true, lastName: true, employeeNumber: true },
    orderBy: { lastName: 'asc' },
  });
  const costCentersRaw = await prisma.costCenter.findMany({ select: { id: true, code: true, label: true, active: true }, orderBy: { code: 'asc' } });
  const employees = sanitizeArray(employeesRaw);
  const costCenters = sanitizeArray(costCentersRaw);
  const readonly = period.status !== 'OPEN';
  return (
    <div className="p-6 space-y-4">
      <BackButtonLayoutHeader />
      <h1 className="text-xl font-semibold">Saisies Paie — {period.ref}</h1>
      <div className="text-sm text-gray-600">Statut: {period.status} {readonly && '(lecture seule)'}</div>
      <p className="text-[11px] text-gray-600">Aide validation configuration: <a className="underline" href="https://github.com/Gabriel-Nyangwile/first-compta#188-validation-rules" target="_blank" rel="noopener noreferrer">README 18.8</a> · <a className="underline" href="https://github.com/Gabriel-Nyangwile/first-compta/blob/master/docs/payroll-validation.md" target="_blank" rel="noopener noreferrer">Cheat Sheet</a>.</p>
      <InputsPanel periodId={period.id} employees={employees} costCenters={costCenters} readonly={readonly} />
    </div>
  );
}
