import Link from 'next/link';
import { absoluteUrl } from '@/lib/url';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

async function fetchDetail(id) {
  const url = await absoluteUrl(`/api/asset-purchase-orders/${id}`);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

async function statusAction(poId, status) {
  'use server';
  const url = await absoluteUrl(`/api/asset-purchase-orders/${poId}/status`);
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || 'Maj statut échouée');
  }
  revalidatePath(`/asset-purchase-orders/${poId}`);
  redirect(`/asset-purchase-orders/${poId}`);
}

async function invoiceAction(poId) {
  'use server';
  const url = await absoluteUrl(`/api/asset-purchase-orders/${poId}/invoice`);
  const res = await fetch(url, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Création facture échouée');
  }
  if (data.invoiceId) {
    redirect(`/incoming-invoices/${data.invoiceId}`);
  }
  if (data.entryNumber) {
    redirect(`/incoming-invoices?number=${encodeURIComponent(data.entryNumber)}`);
  }
  revalidatePath(`/asset-purchase-orders/${poId}`);
  redirect(`/asset-purchase-orders/${poId}`);
}

export default async function Page({ params }) {
  const { id } = await params;
  const po = await fetchDetail(id);
  if (!po) return <div className="p-6">BC immobilisation introuvable.</div>;
  const totalHt = (po.lines || []).reduce((s, l) => s + Number(l.unitPrice) * Number(l.quantity || 1), 0);
  const actions = [
    po.status === 'DRAFT' && { label: 'Approuver', status: 'APPROVED' },
    po.status === 'APPROVED' && { label: 'Marquer reçu', status: 'RECEIVED' },
  ].filter(Boolean);

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <Link href="/asset-purchase-orders" className="text-sm text-blue-600 underline">← Retour liste</Link>
        <span className="text-xs bg-gray-100 px-2 py-1 rounded">Statut: {po.status}</span>
      </div>
      <div className="border rounded p-4 space-y-2">
        <div className="font-semibold text-lg">{po.number}</div>
        <div className="text-sm text-gray-600">Fournisseur : {po.supplier?.name || '—'}</div>
        <div className="text-sm text-gray-600">Échéance : {po.expectedDate ? new Date(po.expectedDate).toISOString().slice(0,10) : '—'}</div>
        <div className="text-sm text-gray-600">Montant HT : {totalHt.toFixed(2)}</div>
        <div className="flex gap-2">
          {actions.map(a => (
            <form key={a.status} action={statusAction.bind(null, id, a.status)} >
              <button type="submit" className="px-3 py-1 bg-blue-600 text-white text-xs rounded">{a.label}</button>
            </form>
          ))}
          {po.status === 'RECEIVED' && (
            <form action={invoiceAction.bind(null, id)} >
              <button type="submit" className="px-3 py-1 bg-emerald-600 text-white text-xs rounded">Créer facture fournisseur</button>
            </form>
          )}
        </div>
      </div>
      <div className="border rounded">
        <div className="p-3 border-b font-medium">Lignes</div>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Libellé</th>
              <th className="px-3 py-2 text-left">Catégorie</th>
              <th className="px-3 py-2 text-left">Qté</th>
              <th className="px-3 py-2 text-left">PU</th>
              <th className="px-3 py-2 text-left">TVA</th>
            </tr>
          </thead>
          <tbody>
            {(po.lines || []).map(l => (
              <tr key={l.id} className="border-t">
                <td className="px-3 py-2">{l.label}</td>
                <td className="px-3 py-2">{l.assetCategory?.code}</td>
                <td className="px-3 py-2">{Number(l.quantity).toFixed(3)}</td>
                <td className="px-3 py-2">{Number(l.unitPrice).toFixed(2)}</td>
                <td className="px-3 py-2">{l.vatRate != null ? Number(l.vatRate).toFixed(2) : '—'}</td>
              </tr>
            ))}
            {!po.lines?.length && <tr><td colSpan={5} className="px-3 py-3 text-center text-gray-500">Aucune ligne</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

