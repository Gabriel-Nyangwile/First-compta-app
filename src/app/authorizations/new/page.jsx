import { createAuthorization } from '@/lib/serverActions/authorization';
import { redirect } from 'next/navigation';
import React from 'react';
import InvoiceLinker from '@/components/authorizations/InvoiceLinker';

// Note: la logique dynamique facture est gérée côté client dans InvoiceLinker (composant séparé)

async function create(formData) {
  'use server';
  const docType = formData.get('docType');
  const flow = docType === 'PCR' ? 'IN' : 'OUT';
  const scope = docType === 'OP' ? 'BANK' : 'CASH';
  const amount = formData.get('amount');
  const currency = formData.get('currency') || 'EUR';
  const purpose = formData.get('purpose') || null;
  const invoiceId = formData.get('invoiceId') || null;
  const incomingInvoiceId = formData.get('incomingInvoiceId') || null;
  await createAuthorization({ docType, flow, scope, amount, currency, purpose, invoiceId, incomingInvoiceId });
  redirect('/authorizations');
}

export default function NewAuthorizationPage() {
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
      <h1 className="text-2xl font-bold">Nouvelle Autorisation</h1>
      <form action={create} className="space-y-4 max-w-lg bg-white border rounded p-4 text-sm" data-enhanced>
        <div className="flex flex-col gap-1">
          <label className="font-medium">Type</label>
          <select name="docType" required className="border rounded px-2 py-1">
            <option value="PCD">PCD (Caisse Dépense)</option>
            <option value="PCR">PCR (Caisse Recette)</option>
            <option value="OP">OP (Ordre Paiement Banque)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium">Montant</label>
          <input type="number" step="0.01" name="amount" required className="border rounded px-2 py-1" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium">Devise</label>
          <input name="currency" defaultValue="EUR" className="border rounded px-2 py-1" />
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
        <button className="bg-blue-600 text-white px-4 py-2 rounded">Créer</button>
      </form>
    </main>
  );
}
