import Link from 'next/link';
import ReceiveForm from './ReceiveForm';
import GoodsReceiptCancelForm from './GoodsReceiptCancelForm';
import { absoluteUrl } from '@/lib/url';

async function fetchPO(id) {
  const url = await absoluteUrl(`/api/purchase-orders/${id}`);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}
async function fetchRemaining(id) {
  const url = await absoluteUrl(`/api/purchase-orders/${id}/remaining`);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export const dynamic = 'force-dynamic';

export default async function PurchaseOrderDetail(props) {
  const awaited = await props.params; // handle potential async params in Next 15
  const { id } = awaited;
  const [po, remaining] = await Promise.all([
    fetchPO(id),
    fetchRemaining(id)
  ]);
  if (!po) return <div className="p-6">PO introuvable.</div>;

  const closeEnabled = po.status === 'RECEIVED' || (remaining && remaining.summary.withRemaining === 0 && ['APPROVED','PARTIAL'].includes(po.status));

  // CSV export helper (server-side streaming minimal)
  const csvHref = `/api/purchase-orders/${po.id}/export.csv`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">Bon de commande {po.number}</h1>
        <span className="px-2 py-1 rounded bg-gray-200 text-xs font-medium">{po.status}</span>
      </div>
      <div className="text-sm space-y-1">
        <div><span className="font-medium">Fournisseur:</span> {po.supplier?.name || '-'}</div>
        <div><span className="font-medium">Émise le:</span> {po.issueDate ? new Date(po.issueDate).toLocaleDateString() : '-'}</div>
        <div><span className="font-medium">Échéance:</span> {po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : '-'}</div>
        <div><span className="font-medium">Devise:</span> {po.currency}</div>
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
            {po.lines.map(l => {
              const remainingQty = (Number(l.orderedQty) - Number(l.receivedQty));
              return (
                <tr key={l.id} className={remainingQty <= 1e-9 ? 'bg-green-50' : ''}>
                  <td className="border px-1 py-1">{l.product?.name || l.productId}</td>
                  <td className="border px-1 py-1 text-right">{Number(l.orderedQty)}</td>
                  <td className="border px-1 py-1 text-right">{Number(l.receivedQty)}</td>
                  <td className="border px-1 py-1 text-right font-mono">{remainingQty.toFixed(3)}</td>
                  <td className="border px-1 py-1 text-right">{Number(l.unitPrice).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {remaining && (
        <section className="space-y-2">
          <h2 className="font-semibold">Restant à recevoir</h2>
          {remaining.remainingLines.length === 0 ? <div className="text-xs text-green-600">Aucune quantité restante.</div> : (
            <table className="min-w-full text-xs border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-1 py-1 text-left">Produit</th>
                  <th className="border px-1 py-1">Reste</th>
                </tr>
              </thead>
              <tbody>
                {remaining.remainingLines.map(l => (
                  <tr key={l.id}>
                    <td className="border px-1 py-1">{l.product?.name || l.productId}</td>
                    <td className="border px-1 py-1 text-right font-mono">{Number(l.remainingQty).toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="text-xs text-gray-600">Total restant: {remaining.summary.totalRemainingQty.toFixed(3)}</div>
        </section>
      )}

      <form action={`/api/purchase-orders/${po.id}/close`} method="post" className="space-y-2">
        <button disabled={!closeEnabled} className={`px-3 py-1 rounded text-white text-sm ${closeEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}>Clôturer</button>
      </form>

      {remaining && remaining.remainingLines.length > 0 && (
        <ReceiveForm poId={po.id} remaining={remaining} />
      )}

      <div>
        <a href={csvHref} className="text-xs text-blue-600 underline">Exporter CSV</a>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">Réceptions</h2>
        {po.goodsReceipts.length === 0 && <div className="text-xs text-gray-600">Aucune réception.</div>}
        {po.goodsReceipts.length > 0 && (
          <div className="space-y-4">
            {po.goodsReceipts.map(gr => (
              <div key={gr.id} className="border rounded">
                <div className="px-3 py-2 flex flex-wrap gap-4 items-center bg-gray-50 text-xs">
                  <div className="font-mono">{gr.number}</div>
                  <div className="px-2 py-0.5 rounded bg-gray-200">{gr.status}</div>
                  <div>{new Date(gr.receiptDate).toLocaleDateString()}</div>
                  <div>{gr.lines.length} ligne(s)</div>
                </div>
                <div className="p-3 space-y-2">
                  <table className="w-full text-[11px] border">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border px-1 py-1 text-left">Produit</th>
                        <th className="border px-1 py-1">Qté reçue</th>
                        <th className="border px-1 py-1">PU coût</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gr.lines.map(l => (
                        <tr key={l.id}>
                          <td className="border px-1 py-1">{l.product?.name || l.productId}</td>
                          <td className="border px-1 py-1 text-right font-mono">{Number(l.qtyReceived).toFixed(3)}</td>
                          <td className="border px-1 py-1 text-right">{Number(l.unitCost).toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {gr.status === 'OPEN' && <GoodsReceiptCancelForm receipt={gr} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {po.statusLogs && (
        <section className="space-y-2">
          <h2 className="font-semibold">Historique des statuts</h2>
          {po.statusLogs.length === 0 && <div className="text-xs text-gray-600">Aucune transition.</div>}
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
                {po.statusLogs.sort((a,b)=> new Date(b.changedAt)-new Date(a.changedAt)).map(log => (
                  <tr key={log.id}>
                    <td className="border px-1 py-1">{new Date(log.changedAt).toLocaleString()}</td>
                    <td className="border px-1 py-1">{log.oldStatus || '-'}</td>
                    <td className="border px-1 py-1 font-semibold">{log.newStatus}</td>
                    <td className="border px-1 py-1 text-xs">{log.note || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      <div>
        <Link href="/purchase-orders" className="text-blue-600 underline text-sm">← Retour liste</Link>
      </div>
    </div>
  );
}
