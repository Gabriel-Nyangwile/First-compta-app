import Link from 'next/link';
import { absoluteUrl } from '@/lib/url';

async function fetchPOs(rawSearchParams) {
  // Next.js 15+ may supply an async/thenable searchParams; await defensively
  const searchParams = await rawSearchParams;
  const qs = new URLSearchParams();
  if (searchParams?.status) qs.set('status', searchParams.status);
  if (searchParams?.q) qs.set('q', searchParams.q);
  const path = `/api/purchase-orders${qs.toString() ? '?' + qs.toString() : ''}`;
  const url = await absoluteUrl(path);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}

export const dynamic = 'force-dynamic';

export default async function PurchaseOrdersPage(props) {
  const awaitedSearchParams = await props.searchParams;
  const pos = await fetchPOs(awaitedSearchParams);
  // Compute progress ratio for each PO (total received / total ordered)
  const withProgress = pos.map(po => {
    let ordered = 0; let received = 0;
    for (const l of po.lines) {
      ordered += Number(l.orderedQty);
      received += Number(l.receivedQty);
    }
    const progress = ordered > 0 ? received / ordered : 0;
    return { ...po, _progress: progress };
  });
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Bons de commande</h1>
      <div>
        <Link href="/purchase-orders/create" className="inline-block mb-2 px-3 py-1 bg-green-600 text-white text-xs rounded">Nouveau bon de commande</Link>
      </div>
    <form className="flex flex-wrap gap-2 text-xs bg-gray-50 p-3 rounded border">
  <input type="text" name="q" placeholder="Recherche numéro" defaultValue={awaitedSearchParams?.q||''} className="border px-2 py-1 rounded" />
  <select name="status" defaultValue={awaitedSearchParams?.status||''} className="border px-2 py-1 rounded">
          <option value="">Tous statuts</option>
          {['DRAFT','APPROVED','PARTIAL','RECEIVED','CLOSED','CANCELLED'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="px-3 py-1 bg-blue-600 text-white rounded">Filtrer</button>
        <a href="/purchase-orders" className="px-3 py-1 bg-gray-300 rounded">Réinitialiser</a>
      </form>
      <table className="min-w-full border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1 text-left">Numéro</th>
            <th className="border px-2 py-1">Fournisseur</th>
            <th className="border px-2 py-1">Statut</th>
            <th className="border px-2 py-1">Lignes</th>
            <th className="border px-2 py-1">Progression</th>
            <th className="border px-2 py-1"></th>
          </tr>
        </thead>
        <tbody>
          {withProgress.map(po => {
            const pct = (po._progress * 100).toFixed(1);
            return (
              <tr key={po.id} className="hover:bg-gray-50">
                <td className="border px-2 py-1 font-mono"><Link className="text-blue-600 underline" href={`/purchase-orders/${po.id}`}>{po.number}</Link></td>
                <td className="border px-2 py-1">{po.supplier?.name || '-'}</td>
                <td className="border px-2 py-1">{po.status}</td>
                <td className="border px-2 py-1">{po.lines.length}</td>
                <td className="border px-2 py-1">
                  <div className="w-full bg-gray-200 h-2 rounded overflow-hidden">
                    <div className="bg-blue-600 h-2" style={{ width: `${Math.min(100, po._progress*100)}%` }} />
                  </div>
                  <div className="text-[10px] text-right font-mono">{pct}%</div>
                </td>
                <td className="border px-2 py-1 text-right"><Link className="text-blue-600" href={`/purchase-orders/${po.id}`}>Détails →</Link></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
