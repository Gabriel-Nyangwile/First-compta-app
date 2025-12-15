import Link from 'next/link';
import { absoluteUrl } from '@/lib/url';

export const dynamic = 'force-dynamic';

async function fetchList() {
  try {
    const url = await absoluteUrl('/api/asset-purchase-orders');
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) return res.json();
  } catch {}
  return [];
}

export default async function Page() {
  const pos = await fetchList();
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">BC Immobilisations</h1>
        <Link href="/asset-purchase-orders/create" className="px-3 py-2 bg-blue-600 text-white rounded text-sm">Nouveau BC</Link>
      </div>
      <div className="border rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Numéro</th>
              <th className="px-3 py-2 text-left">Fournisseur</th>
              <th className="px-3 py-2 text-left">Statut</th>
              <th className="px-3 py-2 text-left">Émise le</th>
              <th className="px-3 py-2 text-left">Reçue le</th>
              <th className="px-3 py-2 text-left">Échéance</th>
              <th className="px-3 py-2 text-left">Lignes</th>
            </tr>
          </thead>
          <tbody>
            {pos.map(po => (
              <tr key={po.id} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">
                  <Link href={`/asset-purchase-orders/${po.id}`} className="underline text-blue-600">{po.number}</Link>
                </td>
                <td className="px-3 py-2">{po.supplier?.name || '—'}</td>
                <td className="px-3 py-2">{po.status}</td>
                <td className="px-3 py-2">{po.issueDate ? new Date(po.issueDate).toISOString().slice(0,10) : '—'}</td>
                <td className="px-3 py-2">{po.receivedAt ? new Date(po.receivedAt).toISOString().slice(0,10) : '—'}</td>
                <td className="px-3 py-2">{po.expectedDate ? new Date(po.expectedDate).toISOString().slice(0,10) : '—'}</td>
                <td className="px-3 py-2 text-xs">
                  {(po.lines || []).map(l => (
                    <div key={l.id}>{l.label} · {l.assetCategory?.code || ''} · {Number(l.unitPrice).toFixed(2)}</div>
                  ))}
                </td>
              </tr>
            ))}
            {!pos.length && (
              <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-500">Aucun BC immobilisation.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
