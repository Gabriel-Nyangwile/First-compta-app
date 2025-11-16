import Link from "next/link";
import ReceiveForm from "./ReceiveForm";
import GoodsReceiptCancelForm from "./GoodsReceiptCancelForm";
import ApprovePurchaseOrderButton from "./ApprovePurchaseOrderButton";
import ClosePurchaseOrderButton from "./ClosePurchaseOrderButton";
import GoodsReceiptDetail from "@/components/GoodsReceiptDetail";
import { absoluteUrl } from "@/lib/url";

async function fetchPO(id) {
  const url = await absoluteUrl(`/api/purchase-orders/${id}`);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}
async function fetchRemaining(id) {
  const url = await absoluteUrl(`/api/purchase-orders/${id}/remaining`);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export const dynamic = "force-dynamic";

export default async function PurchaseOrderDetail(props) {
  const awaitedParams = await props.params; // handle potential async params in Next 15
  const awaitedSearch = await props.searchParams;
  const { id } = awaitedParams;
  const closedFlagRaw = awaitedSearch?.closed;
  const closedSuccess = closedFlagRaw === "1" || closedFlagRaw === "true";
  const closedAlready =
    awaitedSearch?.already === "1" || awaitedSearch?.already === "true";
  const [po, remaining] = await Promise.all([fetchPO(id), fetchRemaining(id)]);
  if (!po) return <div className="p-6">PO introuvable.</div>;

  const closeEnabled =
    po.status === "RECEIVED" ||
    (remaining &&
      remaining.summary.withRemaining === 0 &&
      ["APPROVED", "PARTIAL"].includes(po.status));

  // CSV export helper (server-side streaming minimal)
  const csvHref = `/api/purchase-orders/${po.id}/export.csv`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">Bon de commande {po.number}</h1>
        <span className="px-2 py-1 rounded bg-gray-200 text-xs font-medium">
          {po.status}
        </span>
        {po.status === "DRAFT" && (
          <ApprovePurchaseOrderButton purchaseOrderId={po.id} />
        )}
        {["APPROVED", "PARTIAL", "RECEIVED"].includes(po.status) && (
          <Link
            href={`/goods-receipts/create?purchaseOrderId=${po.id}`}
            className="text-xs text-blue-600 underline"
          >
            Créer une réception dédiée
          </Link>
        )}
      </div>
      {po.status === "RECEIVED" && !closedSuccess && (
        <div className="mt-3 border border-blue-200 bg-blue-50 rounded px-4 py-3 text-xs text-blue-800 space-y-2">
          <div className="font-medium">
            Réception complète confirmée. Vous pouvez enregistrer la facture
            fournisseur associée.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/incoming-invoices/create"
              className="px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Ouvrir l'entrée de facture
            </Link>
            <span className="text-[11px] text-blue-700">
              Cette facture ne peut être saisie qu'après réception de toutes les
              lignes du bon.
            </span>
          </div>
        </div>
      )}
      {po.status === "STAGED" && (
        <div className="mt-3 border border-purple-200 bg-purple-50 rounded px-4 py-3 text-xs text-purple-900 space-y-2">
          <div className="font-medium">
            Réceptions en cours de traitement. Certains articles sont encore en
            zone de contrôle ou de rangement.
          </div>
          <div className="text-[11px] text-purple-800">
            Terminez le contrôle qualité et le rangement dans les réceptions
            ci-dessous pour permettre le passage à l'état "RECEIVED" puis à la
            facturation.
          </div>
        </div>
      )}
      {closedSuccess && (
        <div className="mt-3 border border-green-200 bg-green-50 rounded px-4 py-3 text-xs text-green-800 space-y-2">
          <div className="font-medium">
            {closedAlready
              ? "Ce bon de commande était déjà clôturé."
              : "Bon de commande clôturé avec succès."}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/incoming-invoices/create"
              className="px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700"
            >
              Créer une facture fournisseur
            </Link>
            <Link
              href="/purchase-orders"
              className="px-2 py-1 rounded border border-green-500 text-green-700 hover:bg-green-100"
            >
              Retour à la liste des bons de commande
            </Link>
          </div>
        </div>
      )}
      {po.status === "DRAFT" && (
        <div className="text-[11px] bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded">
          Ce bon est en statut <strong>DRAFT</strong>. Tant qu'il n'est pas
          approuvé, il n'apparaîtra pas dans l'écran de création de réceptions.
          Cliquez sur <em>Approuver</em> lorsque le contenu est validé
          (fournisseur, lignes, quantités, prix). Aucune écriture comptable
          n'est générée à cette étape.
        </div>
      )}
      <div className="text-sm space-y-1">
        <div>
          <span className="font-medium">Fournisseur:</span>{" "}
          {po.supplier?.name || "-"}
        </div>
        <div>
          <span className="font-medium">Émise le:</span>{" "}
          {po.issueDate ? new Date(po.issueDate).toLocaleDateString() : "-"}
        </div>
        <div>
          <span className="font-medium">Échéance:</span>{" "}
          {po.expectedDate
            ? new Date(po.expectedDate).toLocaleDateString()
            : "-"}
        </div>
        <div>
          <span className="font-medium">Devise:</span> {po.currency}
        </div>
        {po.notes && <div className="italic">{po.notes}</div>}
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">Lignes</h2>
        <table className="min-w-full text-xs border">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-1 py-1 text-left">Produit</th>
              <th className="border px-1 py-1">Commandé</th>
              <th className="border px-1 py-1">Reçu</th>
              <th className="border px-1 py-1">Reste</th>
              <th className="border px-1 py-1">PU</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((l) => {
              const remainingQty = Number(l.orderedQty) - Number(l.receivedQty);
              const returnedQty = Number(l.returnedQty || 0);
              return (
                <tr
                  key={l.id}
                  className={remainingQty <= 1e-9 ? "bg-green-50" : ""}
                >
                  <td className="border px-1 py-1">
                    {l.product?.name || l.productId}
                  </td>
                  <td className="border px-1 py-1 text-right">
                    {Number(l.orderedQty)}
                  </td>
                  <td className="border px-1 py-1 text-right">
                    {Number(l.receivedQty)}
                  </td>
                  <td className="border px-1 py-1 text-right font-mono">
                    {remainingQty.toFixed(3)}
                  </td>
                  <td className="border px-1 py-1 text-right">
                    {Number(l.unitPrice).toFixed(2)}
                  </td>
                  {returnedQty > 0 && (
                    <td className="border px-1 py-1 text-right">
                      <span className="inline-block bg-orange-200 text-orange-800 text-[10px] px-1.5 py-0.5 rounded-full align-middle">
                        ↩ {returnedQty}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {remaining && (
        <section className="space-y-2">
          <h2 className="font-semibold">Restant à recevoir</h2>
          {remaining.remainingLines.length === 0 ? (
            <div className="text-xs text-green-600">
              Aucune quantité restante.
            </div>
          ) : (
            <table className="min-w-full text-xs border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-1 py-1 text-left">Produit</th>
                  <th className="border px-1 py-1">Reste</th>
                </tr>
              </thead>
              <tbody>
                {remaining.remainingLines.map((l) => (
                  <tr key={l.id}>
                    <td className="border px-1 py-1">
                      {l.product?.name || l.productId}
                    </td>
                    <td className="border px-1 py-1 text-right font-mono">
                      {Number(l.remainingQty).toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="text-xs text-gray-600">
            Total restant: {remaining.summary.totalRemainingQty.toFixed(3)}
          </div>
        </section>
      )}

      <ClosePurchaseOrderButton
        purchaseOrderId={po.id}
        disabled={!closeEnabled}
      />

      {remaining && remaining.remainingLines.length > 0 && (
        <ReceiveForm poId={po.id} remaining={remaining} />
      )}

      <div>
        <a href={csvHref} className="text-xs text-blue-600 underline">
          Exporter CSV
        </a>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">Réceptions</h2>
        {po.goodsReceipts.length === 0 && (
          <div className="text-xs text-gray-600">Aucune réception.</div>
        )}
        {po.goodsReceipts.length > 0 && (
          <div className="space-y-4">
            {po.goodsReceipts.map((gr) => (
              <GoodsReceiptDetail
                key={gr.id}
                receipt={gr}
                purchaseOrderId={po.id}
              />
            ))}
          </div>
        )}
      </section>

      {po.statusLogs && (
        <section className="space-y-2">
          <h2 className="font-semibold">Historique des statuts</h2>
          {po.statusLogs.length === 0 && (
            <div className="text-xs text-gray-600">Aucune transition.</div>
          )}
          {po.statusLogs.length > 0 && (
            <table className="min-w-full text-xs border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-1 py-1">Date</th>
                  <th className="border px-1 py-1">Ancien</th>
                  <th className="border px-1 py-1">Nouveau</th>
                  <th className="border px-1 py-1">Note</th>
                </tr>
              </thead>
              <tbody>
                {po.statusLogs
                  .sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt))
                  .map((log) => (
                    <tr key={log.id}>
                      <td className="border px-1 py-1">
                        {new Date(log.changedAt).toLocaleString()}
                      </td>
                      <td className="border px-1 py-1">
                        {log.oldStatus || "-"}
                      </td>
                      <td className="border px-1 py-1 font-semibold">
                        {log.newStatus}
                      </td>
                      <td className="border px-1 py-1 text-xs">
                        {log.note || ""}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      <div>
        <Link
          href="/purchase-orders"
          className="text-blue-600 underline text-sm"
        >
          ← Retour liste
        </Link>
      </div>
    </div>
  );
}


