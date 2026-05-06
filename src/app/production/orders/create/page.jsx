import Link from "next/link";
import { internalApiFetch } from "@/lib/url";
import { OrderCreateForm } from "@/components/production/ProductionForms";
import { getProductionAccounts, getProductionCompanyId } from "@/lib/productionPageData";

async function fetchActiveBoms() {
  const res = await internalApiFetch("/api/production/boms?status=ACTIVE", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.boms || [];
}

export const dynamic = "force-dynamic";

export default async function CreateManufacturingOrderPage() {
  const companyId = await getProductionCompanyId();
  const [boms, accounts] = await Promise.all([fetchActiveBoms(), getProductionAccounts(companyId)]);
  return (
    <div className="space-y-4 p-6">
      <div>
        <Link href="/production/orders" className="text-sm text-blue-600 underline">Retour ordres</Link>
        <h1 className="mt-2 text-xl font-semibold">Créer un ordre de fabrication</h1>
      </div>
      {!boms.length && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Aucune nomenclature active. Activez une nomenclature avant de créer un ordre.
        </div>
      )}
      {!accounts.length && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Aucun compte de production en cours proposé. Créez ou sélectionnez un compte 33/34/35/38/471.
        </div>
      )}
      <OrderCreateForm boms={boms} accounts={accounts} />
    </div>
  );
}
