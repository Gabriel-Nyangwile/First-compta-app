import Link from "next/link";
import { BomCreateForm } from "@/components/production/ProductionForms";
import { getProductionCompanyId, getProductionProducts } from "@/lib/productionPageData";

export const dynamic = "force-dynamic";

export default async function CreateBomPage() {
  const companyId = await getProductionCompanyId();
  const products = await getProductionProducts(companyId);
  return (
    <div className="space-y-4 p-6">
      <div>
        <Link href="/production/boms" className="text-sm text-blue-600 underline">Retour nomenclatures</Link>
        <h1 className="mt-2 text-xl font-semibold">Créer une nomenclature</h1>
      </div>
      <BomCreateForm products={products} />
    </div>
  );
}
