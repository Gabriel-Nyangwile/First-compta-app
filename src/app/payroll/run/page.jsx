import { featureFlags } from '@/lib/features';
import BackButtonLayoutHeader from '@/components/BackButtonLayoutHeader';
import RunWizard from './RunWizard.jsx';

export default function PayrollRunWizardPage() {
  if (!featureFlags.payroll) return <div className="p-6">Module paie désactivé.</div>;
  return (
    <div className="p-6 space-y-6">
      <BackButtonLayoutHeader />
      <h1 className="text-xl font-semibold">Génération Bulletins</h1>
      <p className="text-sm text-gray-600 max-w-prose">Wizard sécurisé: créer / sélectionner une période ouverte, prévisualiser les montants (brut, retenues, net, charges employeur) avant génération puis verrouillage.</p>
      <RunWizard />
    </div>
  );
}
