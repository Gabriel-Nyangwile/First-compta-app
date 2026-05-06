import { featureFlags } from '@/lib/features';
import BackButtonLayoutHeader from '@/components/BackButtonLayoutHeader';
import ClientTables from './ClientTables';
import { internalApiFetch } from '@/lib/url';

export const dynamic = 'force-dynamic';

async function fetchAll() {
  const res = await internalApiFetch('/api/payroll/config', { cache: 'no-store' });
  if (!res.ok) {
    return { error: 'échec chargement configuration paie', schemes: [], rules: [], centers: [] };
  }
  const json = await res.json();
  return {
    error: null,
    schemes: json.contributionSchemes || [],
    rules: json.taxRules || [],
    centers: json.costCenters || []
  };
}

export default async function PayrollConfigPage() {
  if (!featureFlags.payroll) return <div className="p-6">Module paie désactivé.</div>;
  const { schemes, rules, centers, error } = await fetchAll();
  return (
    <div className="p-6 space-y-8">
      <BackButtonLayoutHeader />
      <h1 className="text-xl font-semibold">Paramètres Paie</h1>
      <p className="text-sm text-gray-600">Contribution schemes, tax rules & cost centers.</p>
      <ClientTables schemes={schemes} rules={rules} centers={centers} loadError={error} />
    </div>
  );
}

// Client components moved to ClientTables.jsx
