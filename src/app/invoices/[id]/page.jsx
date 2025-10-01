// app/invoices/[id]/page.jsx

import { fetchInvoiceById } from '@/lib/serverActions/clientAndInvoice';
import { notFound } from 'next/navigation'; // Pour gérer le cas où la facture n'est pas trouvée
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatDateFR, getStatusClasses, getStatusLabel, formatAmount } from '@/lib/utils';
export default async function InvoiceDetailsPage({ params, searchParams }) {
  /* const invoiceId = await params.id; // L'ID est extrait des paramètres de la route */
  const { id } = await params; // ← await ici
  const invoiceId = id;

  const invoice = await fetchInvoiceById(invoiceId);

  // Si la facture n'est pas trouvée, afficher la page 404 de Next.js
  if (!invoice) {
    notFound();
  }



  const sp = await searchParams;
  const returnTo = sp?.returnTo ? decodeURIComponent(sp.returnTo) : null;
  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-50">
      <div className="w-full max-w-2xl bg-white p-8 rounded-lg shadow-md border border-gray-200">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Facture N° {invoice.invoiceNumber}</h1>
          {returnTo ? (
            <Link
              href={returnTo}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-150 ease-in-out"
            >Retour autorisation</Link>
          ) : (
            <Link
              href="/invoices"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-150 ease-in-out"
            >Retour aux factures</Link>
          )}
        </div>

        <div className="space-y-6">
          {/* Détails du client */}
          <div className="border-b pb-4">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Informations Client</h2>
            <p className="text-gray-700"><strong className="font-medium">Nom :</strong> {invoice.client.name}</p>
            <p className="text-gray-700"><strong className="font-medium">Email :</strong> {invoice.client.email}</p>
            {invoice.client.address && (
              <p className="text-gray-700"><strong className="font-medium">Adresse :</strong> {invoice.client.address}</p>
            )}
            <p className="text-gray-700"><strong className="font-medium">Catégorie :</strong> {invoice.client.category}</p>
          </div>

          {/* Détails de la facture */}
          <div className="border-b pb-4">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Détails de la Facture</h2>
            <p className="text-gray-700"><strong className="font-medium">Numéro :</strong> {invoice.invoiceNumber}</p>
            <p className="text-gray-700"><strong className="font-medium">Montant Total :</strong> {formatAmount(invoice.totalAmount.toString())}</p>
            <p className="text-gray-700"><strong className="font-medium">Payé :</strong> {formatAmount((invoice.paidAmount||0).toString())}</p>
            <p className="text-gray-700"><strong className="font-medium">Reste :</strong> {formatAmount((invoice.outstandingAmount ?? invoice.totalAmount.minus(invoice.paidAmount||0)).toString())}</p>
            <p className="text-gray-700"><strong className="font-medium">Date d'émission :</strong> {formatDateFR(invoice.issueDate)}</p>
            <p className="text-gray-700"><strong className="font-medium">Date d'échéance :</strong> {formatDateFR(invoice.dueDate)}</p>
            <p className="text-gray-700">
              <strong className="font-medium">Statut :</strong> 
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ml-2 ${getStatusClasses(invoice.status)}`}>
                {getStatusLabel(invoice.status)}
              </span>
            </p>
            {Array.isArray(invoice.moneyMovements) && invoice.moneyMovements.length > 0 && (
              <div className="mt-4 bg-gray-50 border rounded p-3">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Pièces de paiement (voucherRef)</h3>
                <ul className="space-y-1 text-sm">
                  {invoice.moneyMovements.map(mv => (
                    <li key={mv.id} className="flex justify-between">
                      <span className="text-gray-600">{formatDateFR(mv.date)} • {mv.moneyAccount?.label || 'Compte'} • {mv.direction === 'IN' ? 'Encaissement' : 'Décaissement'}</span>
                      <span className="font-mono text-gray-900">{mv.voucherRef}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Bouton de téléchargement PDF côté serveur */}
          <div className="flex justify-end space-x-4 pt-4">
            <a
              href={`/api/invoice/${invoice.id}/pdf`}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition duration-150 ease-in-out"
              target="_blank"
              rel="noopener noreferrer"
            >
              Télécharger le PDF
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}