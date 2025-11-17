import { featureFlags } from '@/lib/features';

export default function PayrollRunWizard() {
  if (!featureFlags.payroll) return <div className="p-6">Module paie désactivé.</div>;
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Génération Bulletins (Wizard Draft)</h1>
      <p className="text-sm text-gray-600 max-w-prose">Cette page servira de wizard: sélection période ouverte, filtrage employés actifs, pré-calcul brut, contributions, retenues et net. Actions prévues: Prévisualiser, Générer bulletins, Verrouiller période.</p>
    </div>
  );
}
