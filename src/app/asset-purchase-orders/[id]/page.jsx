import Link from 'next/link';
import { absoluteUrl } from '@/lib/url';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { createAsset } from '@/lib/assets';

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
    throw new Error(d.error || 'Maj statut echouee');
  }
  revalidatePath(`/asset-purchase-orders/${poId}`);
  redirect(`/asset-purchase-orders/${poId}`);
}

async function invoiceAction(poId, formData) {
  'use server';
  const supplierInvoiceNumber = formData.get('supplierInvoiceNumber')?.toString().trim();
  const receiptDate = formData.get('receiptDate')?.toString();
  const issueDate = formData.get('issueDate')?.toString();
  const dueDate = formData.get('dueDate')?.toString();
  const paymentTermDays = formData.get('paymentTermDays')?.toString();
  const url = await absoluteUrl(`/api/asset-purchase-orders/${poId}/invoice`);
  const payload = {
    supplierInvoiceNumber,
    receiptDate,
    issueDate,
    dueDate,
    paymentTermDays: paymentTermDays || undefined,
  };
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Creation facture echouee');
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

async function createAssetsAction(poId) {
  'use server';
  const po = await prisma.assetPurchaseOrder.findUnique({
    where: { id: poId },
    include: { lines: { include: { assetCategory: true } } },
  });
  if (!po) throw new Error('BC immob introuvable');
  const created = [];
  for (const line of po.lines || []) {
    if (!line.assetCategoryId) continue;
    const qty = Number(line.quantity?.toNumber?.() ?? line.quantity ?? 1);
    const unit = Number(line.unitPrice?.toNumber?.() ?? line.unitPrice ?? 0);
    const cost = qty * unit;
    const ul = line.assetCategory?.durationMonths || 36;
    const acquisitionDate = po.issueDate || new Date();
    const inServiceDate = po.expectedDate || acquisitionDate;
    const asset = await createAsset({
      label: line.label || po.number,
      categoryId: line.assetCategoryId,
      acquisitionDate,
      inServiceDate,
      cost,
      salvage: 0,
      usefulLifeMonths: ul,
      method: 'LINEAR',
      status: 'ACTIVE',
      meta: {
        source: 'ASSET_PO',
        assetPurchaseOrderId: po.id,
        assetPurchaseOrderNumber: po.number,
        assetPurchaseOrderLineId: line.id,
      },
    });
    created.push(asset);
  }
  revalidatePath('/assets');
  revalidatePath(`/asset-purchase-orders/${poId}`);
  if (created.length) {
    redirect('/assets');
  } else {
    redirect(`/asset-purchase-orders/${poId}`);
  }
}

export default async function Page({ params }) {
  const { id } = await params;
  const po = await fetchDetail(id);
  if (!po) return <div className="p-6">BC immobilisation introuvable.</div>;
  const totalHt = (po.lines || []).reduce((s, l) => s + Number(l.unitPrice) * Number(l.quantity || 1), 0);
  const actions = [
    po.status === 'DRAFT' && { label: 'Approuver', status: 'APPROVED' },
    po.status === 'APPROVED' && { label: 'Marquer recu', status: 'RECEIVED' },
  ].filter(Boolean);
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <Link href="/asset-purchase-orders" className="text-sm text-blue-600 underline">&#8617; Retour liste</Link>
        <span className="text-xs bg-gray-100 px-2 py-1 rounded">Statut: {po.status}</span>
      </div>
      <div className="border rounded p-4 space-y-2">
        <div className="font-semibold text-lg">{po.number}</div>
        <div className="text-sm text-gray-600">Fournisseur : {po.supplier?.name || '-'}</div>
        <div className="text-sm text-gray-600">Echeance cible : {po.expectedDate ? new Date(po.expectedDate).toISOString().slice(0, 10) : '-'}</div>
        <div className="text-sm text-gray-600">Montant HT : {totalHt.toFixed(2)}</div>
        {po.incomingInvoice && (
          <div className="text-sm">
            Facture générée :
            <Link href={`/incoming-invoices/${po.incomingInvoice.id}`} className="ml-1 text-blue-600 underline">
              {po.incomingInvoice.entryNumber || po.incomingInvoice.supplierInvoiceNumber || 'Voir facture'}
            </Link>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <form key={a.status} action={statusAction.bind(null, id, a.status)}>
              <button type="submit" className="px-3 py-1 bg-blue-600 text-white text-xs rounded">{a.label}</button>
            </form>
          ))}
          {po.status === 'RECEIVED' && (
            <form action={invoiceAction.bind(null, id)} className="flex flex-wrap gap-2 items-end bg-gray-50 border rounded px-3 py-2">
              <div className="flex flex-col">
                <label className="text-[11px] text-gray-700">Numero facture fournisseur *</label>
                <input name="supplierInvoiceNumber" className="border rounded px-2 py-1 text-sm" defaultValue="" required />
              </div>
              <div className="flex flex-col">
                <label className="text-[11px] text-gray-700">Date reception</label>
                <input name="receiptDate" type="date" className="border rounded px-2 py-1 text-sm" defaultValue={todayIso} />
              </div>
              <div className="flex flex-col">
                <label className="text-[11px] text-gray-700">Date emission</label>
                <input name="issueDate" type="date" className="border rounded px-2 py-1 text-sm" defaultValue={todayIso} />
              </div>
              <div className="flex flex-col">
                <label className="text-[11px] text-gray-700">Echeance</label>
                <select name="paymentTermDays" className="border rounded px-2 py-1 text-sm" defaultValue="30">
                  <option value="0">Comptant</option>
                  <option value="15">15 jours</option>
                  <option value="30">30 jours</option>
                  <option value="45">45 jours</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[11px] text-gray-700">Date d'echeance (option)</label>
                <input name="dueDate" type="date" className="border rounded px-2 py-1 text-sm" />
              </div>
              <button type="submit" className="px-3 py-1 bg-emerald-600 text-white text-xs rounded">Creer facture fournisseur</button>
            </form>
          )}
          {po.status === 'INVOICED' && (
            <div className="text-xs text-gray-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Facture deja generee. Retrouver-la dans le menu Incoming invoices.
            </div>
          )}
          {po.status === 'INVOICED' && (
            <form action={createAssetsAction.bind(null, id)}>
              <button type="submit" className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded">
                Créer immobilisation(s) depuis ce BC
              </button>
            </form>
          )}
        </div>
      </div>
      <div className="border rounded">
        <div className="p-3 border-b font-medium">Lignes</div>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Libelle</th>
              <th className="px-3 py-2 text-left">Categorie</th>
              <th className="px-3 py-2 text-left">Qte</th>
              <th className="px-3 py-2 text-left">PU</th>
              <th className="px-3 py-2 text-left">TVA</th>
            </tr>
          </thead>
          <tbody>
            {(po.lines || []).map((l) => (
              <tr key={l.id} className="border-t">
                <td className="px-3 py-2">{l.label}</td>
                <td className="px-3 py-2">{l.assetCategory?.code}</td>
                <td className="px-3 py-2">{Number(l.quantity).toFixed(3)}</td>
                <td className="px-3 py-2">{Number(l.unitPrice).toFixed(2)}</td>
                <td className="px-3 py-2">{l.vatRate != null ? Number(l.vatRate).toFixed(2) : '-'}</td>
              </tr>
            ))}
            {!po.lines?.length && <tr><td colSpan={5} className="px-3 py-3 text-center text-gray-500">Aucune ligne</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
