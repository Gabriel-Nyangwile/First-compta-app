import { absoluteUrl } from "@/lib/url";
import Amount from "@/components/Amount";
import Link from "next/link";

function formatDate(value) {
  if (!value) return "-";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("fr-FR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "-";
  }
}

async function fetchProductDetail(id) {
  const url = await absoluteUrl(`/api/products/${id}`);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload?.error || "Produit introuvable.");
  }
  return res.json();
}

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }) {
  const resolvedParams = await params;
  const { id } = resolvedParams || {};
  if (!id) {
    throw new Error("Paramètre produit manquant.");
  }

  const data = await fetchProductDetail(id);
  const { product, inventory, movements } = data;
  const qtyOnHandValue = Number(inventory?.qtyOnHand || 0);
  const avgCostValue = inventory?.avgCost != null ? Number(inventory.avgCost) : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Produit {product?.sku || "-"}
          </h1>
          <p className="text-sm text-slate-500">{product?.name || ""}</p>
        </div>
        <Link
          href="/products"
          className="text-sm text-blue-600 underline hover:text-blue-800"
        >
          ← Retour à la liste
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-2 bg-white border border-slate-200 rounded px-4 py-4 text-sm text-slate-700">
        <div className="space-y-2">
          <p>
            <span className="font-medium text-slate-600">SKU :</span>{" "}
            <span className="font-mono">{product?.sku || "-"}</span>
          </p>
          <p>
            <span className="font-medium text-slate-600">Nom :</span>{" "}
            {product?.name || "-"}
          </p>
          <p>
            <span className="font-medium text-slate-600">Description :</span>{" "}
            {product?.description || "-"}
          </p>
          <p>
            <span className="font-medium text-slate-600">Unité :</span>{" "}
            {product?.unit || "-"}
          </p>
        </div>
        <div className="space-y-2">
          <p>
            <span className="font-medium text-slate-600">Nature :</span>{" "}
            {product?.stockNature || "-"}
          </p>
          <p>
            <span className="font-medium text-slate-600">Compte stock :</span>{" "}
            {product?.inventoryAccount?.number || "-"}{" "}
            {product?.inventoryAccount?.label
              ? `• ${product.inventoryAccount.label}`
              : ""}
          </p>
          <p>
            <span className="font-medium text-slate-600">
              Compte variation :
            </span>{" "}
            {product?.stockVariationAccount?.number || "-"}{" "}
            {product?.stockVariationAccount?.label
              ? `• ${product.stockVariationAccount.label}`
              : ""}
          </p>
          <p>
            <span className="font-medium text-slate-600">Statut :</span>{" "}
            {product?.isActive ? "Actif" : "Inactif"}
          </p>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded px-4 py-4 text-sm text-slate-700 space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Inventaire
        </h2>
        <p>
          Stock actuel : {qtyOnHandValue.toFixed(3)} {product?.unit || ""}
        </p>
        <p>
          Coût moyen :{" "}
          {avgCostValue != null ? <Amount value={avgCostValue} /> : "-"}
        </p>
      </section>

      <section className="bg-white border border-slate-200 rounded px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Mouvements de stock
          </h2>
          <span className="text-[11px] text-slate-500">
            {movements?.length || 0} mouvement(s)
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="border px-2 py-1 text-left">Date</th>
                <th className="border px-2 py-1">Type</th>
                <th className="border px-2 py-1">Étape</th>
                <th className="border px-2 py-1 text-right">Quantité</th>
                <th className="border px-2 py-1 text-right">Coût unitaire</th>
                <th className="border px-2 py-1 text-right">Coût total</th>
                <th className="border px-2 py-1 text-left">Référence</th>
              </tr>
            </thead>
            <tbody>
              {!movements?.length && (
                <tr>
                  <td
                    colSpan={7}
                    className="border px-3 py-4 text-center text-slate-500"
                  >
                    Aucun mouvement enregistré.
                  </td>
                </tr>
              )}
              {(movements || []).map((movement) => (
                <tr key={movement.id} className="border-t hover:bg-slate-50">
                  <td className="border px-2 py-1">
                    {formatDate(movement.date)}
                  </td>
                  <td className="border px-2 py-1 text-center">
                    {movement.movementType || "-"}
                  </td>
                  <td className="border px-2 py-1 text-center">
                    {movement.stage || "-"}
                  </td>
                  <td className="border px-2 py-1 text-right font-mono">
                    {Number(movement.quantity || 0).toFixed(3)}
                  </td>
                  <td className="border px-2 py-1 text-right font-mono">
                    {movement.unitCost != null
                      ? Number(movement.unitCost).toFixed(4)
                      : "-"}
                  </td>
                  <td className="border px-2 py-1 text-right font-mono">
                    {movement.totalCost != null
                      ? Number(movement.totalCost).toFixed(2)
                      : "-"}
                  </td>
                  <td className="border px-2 py-1 text-xs text-slate-600">
                    {movement.voucherRef || movement.reference || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
