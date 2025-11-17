import prisma from '@/lib/prisma';
import { featureFlags } from '@/lib/features';
import BackButtonLayoutHeader from '@/components/BackButtonLayoutHeader';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PayrollEmployeeDetailPage({ params }) {
  if (!featureFlags.payroll) return <div className="p-6">Module paie désactivé.</div>;
  const { id } = await params;
  if (!id) return notFound();

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      address: true,
      birthDate: true,
      hireDate: true,
      endDate: true,
      isExpat: true,
      status: true,
      position: { select: { title: true } }
    }
  });

  if (!employee) return notFound();

  return (
    <div className="p-6 space-y-4">
      <BackButtonLayoutHeader />
      <h1 className="text-xl font-semibold">Employé · {employee.lastName} {employee.firstName}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="space-y-1">
          <div><span className="font-medium">Matricule:</span> {employee.employeeNumber || '—'}</div>
          <div><span className="font-medium">Fonction:</span> {employee.position?.title || '—'}</div>
          <div><span className="font-medium">Statut:</span> {employee.status}</div>
          <div><span className="font-medium">Expat:</span> {employee.isExpat ? 'Oui' : 'Non'}</div>
        </div>
        <div className="space-y-1">
          <div><span className="font-medium">Email:</span> {employee.email || '—'}</div>
          <div><span className="font-medium">Téléphone:</span> {employee.phone || '—'}</div>
          <div><span className="font-medium">Adresse:</span> {employee.address || '—'}</div>
        </div>
      </div>
      <div className="text-xs text-gray-500">
        Ébauche de fiche employé. Les actions paie (bulletins, allocations de coûts) seront ajoutées ultérieurement.
      </div>
    </div>
  );
}
