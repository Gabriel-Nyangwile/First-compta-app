import { featureFlags } from '@/lib/features';
import BackButtonLayoutHeader from '@/components/BackButtonLayoutHeader';
import { getPayrollCurrencyContext } from '@/lib/payroll/context';
import { cookies } from 'next/headers';
import { getCompanyIdFromCookies } from '@/lib/tenant';
import RunWizard from './RunWizard.jsx';

export default function PayrollRunWizardPage() {
  if (!featureFlags.payroll) return <div className="p-6">Module paie désactivé.</div>;
  return <PayrollRunWizardPageContent />;
}

async function PayrollRunWizardPageContent() {
  const cookieStore = await cookies();
  const companyId = getCompanyIdFromCookies(cookieStore);
  const currencyContext = await getPayrollCurrencyContext(companyId);
  return (
    <div className="p-6 space-y-6">
      <BackButtonLayoutHeader />
      <h1 className="text-xl font-semibold">Génération Bulletins</h1>
      <p className="text-sm text-gray-600 max-w-prose">Wizard sécurisé: créer / sélectionner une période ouverte, prévisualiser les montants (brut, retenues, net, charges employeur) avant génération puis verrouillage.</p>
      <RunWizard currencyContext={currencyContext} />
    </div>
  );
}
