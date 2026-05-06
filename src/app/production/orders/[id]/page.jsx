import Link from "next/link";
import { internalApiFetch } from "@/lib/url";
import { ProductionOrderActions } from "@/components/production/ProductionForms";

async function fetchOrder(id) {
  const res = await internalApiFetch(`/api/production/orders/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  return data.order || null;
}

function Step({ number, title, active, done, children }) {
  const tone = done ? "border-emerald-200 bg-emerald-50" : active ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white";
  return (
    <div className={`rounded border p-3 ${tone}`}>
      <div className="flex gap-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full border bg-white text-xs font-semibold">{number}</span>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-1 text-xs text-slate-700">{children}</div>
        </div>
      </div>
    </div>
  );
}

function nextAction(order) {
  if (order.status === "DRAFT") return "Étape suivante : lancer l'ordre de fabrication";
  if (order.status === "RELEASED") return "Étape suivante : enregistrer la consommation des composants";
  if (order.status === "IN_PROGRESS") return "Étape suivante : déclarer la quantité produite";
  if (order.status === "COMPLETED") return "Étape suivante : clôturer l'ordre";
  if (order.status === "CLOSED") return "Ordre clôturé";
  return "Ordre annulé";
}

export const dynamic = "force-dynamic";

export default async function ManufacturingOrderDetailPage(props) {
  const { id } = await props.params;
  const order = await fetchOrder(id);
  if (!order) return <div className="p-6">Ordre de fabrication introuvable.</div>;
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/production/orders" className="text-sm text-blue-600 underline">Retour ordres</Link>
          <h1 className="mt-2 text-xl font-semibold">Ordre {order.number}</h1>
          <div className="mt-1 text-sm text-slate-600">{nextAction(order)}</div>
        </div>
        <span className="rounded bg-slate-200 px-3 py-1 text-sm font-semibold">{order.status}</span>
      </div>

      <ProductionOrderActions order={order} />

      <section className="grid gap-3 lg:grid-cols-5">
        <Step number="1" title="Ordre créé" active={order.status === "DRAFT"} done={order.status !== "DRAFT"}>
          Le produit fini, la quantité et les composants issus de la nomenclature sont préparés.
        </Step>
        <Step number="2" title="Ordre lancé" active={order.status === "RELEASED"} done={["IN_PROGRESS", "COMPLETED", "CLOSED"].includes(order.status)}>
          Les composants peuvent être prélevés en stock.
        </Step>
        <Step number="3" title="Composants consommés" active={order.status === "IN_PROGRESS"} done={["COMPLETED", "CLOSED"].includes(order.status)}>
          Les sorties stock et l'écriture vers production en cours sont créées.
        </Step>
        <Step number="4" title="Produit fini déclaré" active={order.status === "COMPLETED"} done={order.status === "CLOSED"}>
          L'entrée stock du produit fini est créée.
        </Step>
        <Step number="5" title="Ordre clôturé" active={order.status === "CLOSED"} done={order.status === "CLOSED"}>
          Le cycle de fabrication est terminé.
        </Step>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded border bg-white p-4 text-sm">
          <h2 className="mb-3 font-semibold">Synthèse</h2>
          <dl className="grid grid-cols-2 gap-2">
            <dt className="text-slate-500">Produit fini</dt>
            <dd>{order.product?.sku} - {order.product?.name}</dd>
            <dt className="text-slate-500">Nomenclature</dt>
            <dd>{order.billOfMaterial?.code || "-"}</dd>
            <dt className="text-slate-500">Compte production en cours</dt>
            <dd>{order.wipAccount?.number} - {order.wipAccount?.label}</dd>
            <dt className="text-slate-500">Quantité prévue</dt>
            <dd>{Number(order.plannedQty).toFixed(3)}</dd>
            <dt className="text-slate-500">Quantité produite</dt>
            <dd>{Number(order.producedQty).toFixed(3)}</dd>
            <dt className="text-slate-500">Rebut</dt>
            <dd>{Number(order.scrapQty).toFixed(3)}</dd>
          </dl>
        </div>
        <div className="rounded border bg-white p-4 text-sm">
          <h2 className="mb-3 font-semibold">Notes</h2>
          <p className="whitespace-pre-wrap text-slate-700">{order.notes || "Aucune note."}</p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Composants à consommer</h2>
        <table className="min-w-full border bg-white text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="border px-3 py-2 text-left">Composant</th>
              <th className="border px-3 py-2 text-right">Stock</th>
              <th className="border px-3 py-2 text-right">Prévu</th>
              <th className="border px-3 py-2 text-right">Consommé</th>
              <th className="border px-3 py-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {order.components.map((component) => (
              <tr key={component.id}>
                <td className="border px-3 py-2">{component.product?.sku} - {component.product?.name}</td>
                <td className="border px-3 py-2 text-right">{Number(component.product?.inventory?.qtyOnHand || 0).toFixed(3)}</td>
                <td className="border px-3 py-2 text-right">{Number(component.plannedQty).toFixed(3)}</td>
                <td className="border px-3 py-2 text-right">{Number(component.consumedQty).toFixed(3)}</td>
                <td className="border px-3 py-2 text-center">{component.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Déclarations de production</h2>
        {!order.outputs.length ? (
          <div className="rounded border border-dashed bg-white p-4 text-sm text-slate-600">Aucune déclaration.</div>
        ) : (
          <table className="min-w-full border bg-white text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="border px-3 py-2">Date</th>
                <th className="border px-3 py-2 text-right">Quantité</th>
                <th className="border px-3 py-2 text-right">Coût unitaire</th>
                <th className="border px-3 py-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {order.outputs.map((output) => (
                <tr key={output.id}>
                  <td className="border px-3 py-2 text-center">{new Date(output.declaredAt).toLocaleString()}</td>
                  <td className="border px-3 py-2 text-right">{Number(output.quantity).toFixed(3)}</td>
                  <td className="border px-3 py-2 text-right">{Number(output.unitCost).toFixed(4)}</td>
                  <td className="border px-3 py-2">{output.notes || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
