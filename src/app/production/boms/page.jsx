import Link from "next/link";
import { internalApiFetch } from "@/lib/url";
import { BomRowActions } from "@/components/production/ProductionForms";

async function fetchBoms(searchParams) {
  const qs = new URLSearchParams();
  if (searchParams?.status) qs.set("status", searchParams.status);
  if (searchParams?.q) qs.set("q", searchParams.q);
  const res = await internalApiFetch(`/api/production/boms${qs.toString() ? `?${qs}` : ""}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.boms || [];
}

export const dynamic = "force-dynamic";

export default async function ProductionBomsPage(props) {
  const searchParams = await props.searchParams;
  const boms = await fetchBoms(searchParams);
  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Nomenclatures</h1>
        <Link href="/production/boms/create" className="rounded bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700">
          Nouvelle nomenclature
        </Link>
      </div>
      <form className="flex flex-wrap gap-2 rounded border bg-slate-50 p-3 text-sm">
        <input name="q" defaultValue={searchParams?.q || ""} placeholder="Produit, code, libellé" className="rounded border px-2 py-1" />
        <select name="status" defaultValue={searchParams?.status || ""} className="rounded border px-2 py-1">
          <option value="">Tous statuts</option>
          <option value="DRAFT">DRAFT</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="ARCHIVED">ARCHIVED</option>
        </select>
        <button className="rounded bg-blue-600 px-3 py-1 text-white">Filtrer</button>
        <Link href="/production/boms" className="rounded border px-3 py-1">Réinitialiser</Link>
      </form>
      {!boms.length ? (
        <div className="rounded border border-dashed bg-white p-6 text-sm text-slate-600">Aucune nomenclature.</div>
      ) : (
        <table className="min-w-full border bg-white text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="border px-3 py-2 text-left">Code</th>
              <th className="border px-3 py-2 text-left">Produit fini</th>
              <th className="border px-3 py-2">Version</th>
              <th className="border px-3 py-2">Statut</th>
              <th className="border px-3 py-2 text-right">Composants</th>
              <th className="border px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {boms.map((bom) => (
              <tr key={bom.id}>
                <td className="border px-3 py-2 font-mono">{bom.code}</td>
                <td className="border px-3 py-2">{bom.product?.sku} - {bom.product?.name}</td>
                <td className="border px-3 py-2 text-center">{bom.version}</td>
                <td className="border px-3 py-2 text-center">{bom.status}</td>
                <td className="border px-3 py-2 text-right">{bom.lines?.length || 0}</td>
                <td className="border px-3 py-2"><BomRowActions bom={bom} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
