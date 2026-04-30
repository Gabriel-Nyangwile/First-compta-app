import { createAuthorization } from '@/lib/serverActions/authorization';
import { redirect } from 'next/navigation';
import React from 'react';
import InvoiceLinker from '@/components/authorizations/InvoiceLinker';
import { cookies } from 'next/headers';
import { getCompanyIdFromCookies } from '@/lib/tenant';
import { getCompanyCurrency } from '@/lib/companyContext';

// Note: la logique dynamique facture est gérée côté client dans InvoiceLinker (composant séparé)

async function create(formData) {
  'use server';
  const docType = formData.get('docType');
  const requestedFlow = formData.get('flow');
  const requestedScope = formData.get('scope');
  const flow =
    docType === 'PCR'
      ? 'IN'
      : docType === 'OP'
        ? (requestedFlow === 'IN' ? 'IN' : 'OUT')
        : 'OUT';
  const scope =
    docType === 'OP'
      ? 'BANK'
      : requestedScope === 'BANK'
        ? 'BANK'
        : 'CASH';
  const amount = formData.get('amount');
  const companyId = getCompanyIdFromCookies(await cookies());
  const companyCurrency = await getCompanyCurrency(companyId);
  const currency = formData.get('currency') || companyCurrency;
  const purpose = formData.get('purpose') || null;
  const invoiceId = formData.get('invoiceId') || null;
  const incomingInvoiceId = formData.get('incomingInvoiceId') || null;
  await createAuthorization({ companyId, docType, flow, scope, amount, currency, purpose, invoiceId, incomingInvoiceId });
  redirect(`/authorizations?scope=${scope}&flow=${flow}`);
}

export default async function NewAuthorizationPage({ searchParams }) {
  const companyId = getCompanyIdFromCookies(await cookies());
  const companyCurrency = await getCompanyCurrency(companyId);
  const sp = await searchParams;
  const docType = sp?.docType || 'PCD';
  const requestedFlow = sp?.flow === 'IN' ? 'IN' : 'OUT';
  const resolvedScope = docType === 'OP' ? 'BANK' : 'CASH';
  const resolvedFlow = docType === 'PCR' ? 'IN' : docType === 'OP' ? requestedFlow : 'OUT';
  const pageTitle =
    docType === 'PCR'
      ? 'Nouvel encaissement caisse'
      : docType === 'OP' && resolvedFlow === 'IN'
        ? 'Nouvel encaissement banque'
        : docType === 'OP'
          ? 'Nouveau décaissement banque'
          : 'Nouveau décaissement caisse';
  // Suggestions d'objet basées sur le type choisi (fallback simple côté client via datalist)
  const purposeSuggestions = [
    'Paiement facture fournisseur',
    'Règlement acompte',
    'Encaissement recette',
    'Achat consommables',
    'Frais déplacement',
    'Frais administratifs',
    'Versement salaires',
    'Remboursement note de frais'
  ];
  return (
    <main className="u-main-container u-padding-content-container space-y-6">
      <h1 className="text-2xl font-bold">{pageTitle}</h1>
      <form action={create} className="space-y-4 max-w-lg bg-white border rounded p-4 text-sm" data-enhanced>
        <input type="hidden" name="scope" value={resolvedScope} />
        <input type="hidden" name="flow" value={resolvedFlow} />
        <div className="flex flex-col gap-1">
          <label className="font-medium">Type</label>
          <select name="docType" defaultValue={docType} required className="border rounded px-2 py-1">
            <option value="PCD">PCD (Caisse Dépense)</option>
            <option value="PCR">PCR (Caisse Recette)</option>
            <option value="OP">OP (Banque)</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="font-medium">Périmètre</label>
            <div className="border rounded px-2 py-1 bg-slate-50">{resolvedScope === 'BANK' ? 'Banque' : 'Caisse'}</div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-medium">Sens</label>
            <div className="border rounded px-2 py-1 bg-slate-50">{resolvedFlow === 'IN' ? 'Encaissement / Entrée' : 'Paiement / Sortie'}</div>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium">Montant</label>
          <input type="number" step="0.01" name="amount" required className="border rounded px-2 py-1" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium">Devise</label>
          <input name="currency" defaultValue={companyCurrency} className="border rounded px-2 py-1" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium flex items-center gap-2">Purpose / Objet
            <span className="text-[10px] text-slate-500 font-normal">Choisir une formulation claire (proposée ci-dessous).</span>
          </label>
          <input name="purpose" list="purpose-suggestions" className="border rounded px-2 py-1" placeholder="Ex: Paiement facture fournisseur" />
          <datalist id="purpose-suggestions">
            {purposeSuggestions.map(s => <option value={s} key={s}>{s}</option>)}
          </datalist>
          <p className="text-[11px] text-slate-500 leading-snug">Ce champ décrit la finalité : ex: "Paiement facture fournisseur", "Frais déplacement". Le système propose des modèles fréquents; ajustez si besoin.</p>
        </div>
        <InvoiceLinker />
        <button className="bg-blue-600 text-white px-4 py-2 rounded">Enregistrer l'autorisation</button>
      </form>
    </main>
  );
}
