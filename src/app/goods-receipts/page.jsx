import Link from 'next/link';
import { absoluteUrl } from '@/lib/url';

async function fetchReceipts() {
  const url = await absoluteUrl('/api/goods-receipts');
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}

export const dynamic = 'force-dynamic';

export default async function GoodsReceiptsPage() {
  const receipts = await fetchReceipts();
  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Réceptions</h1>
      <div className="mb-4"><Link href="/goods-receipts/create" className="text-sm bg-blue-600 text-white px-3 py-2 rounded">Nouvelle réception</Link></div>
      <table className="w-full text-sm border rounded overflow-hidden">
        <thead className="bg-slate-100 text-left"><tr><th className="p-2">Numéro</th><th className="p-2">Statut</th><th className="p-2">Lignes</th></tr></thead>
        <tbody>
          {receipts.map(r => <tr key={r.id} className="border-t"><td className="p-2 font-mono text-xs">{r.number}</td><td className="p-2">{r.status}</td><td className="p-2 text-right">{r.lines.length}</td></tr>)}
          {!receipts.length && <tr><td colSpan={3} className="p-4 text-center text-slate-500 text-xs">Aucune réception</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
