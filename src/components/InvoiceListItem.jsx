'use client'; // <-- Ceci est crucial, indique que c'est un Client Component

import Link from 'next/link';
import { updateInvoiceStatus } from '@/lib/serverActions/clientAndInvoice';
import Amount from './Amount';

export default function InvoiceListItem({ invoice }) {
  // Fonctions utilitaires locales pour le rendu
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusClasses = (status) => {
    switch (status) {
      case 'PAID': return 'bg-green-100 text-green-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'OVERDUE': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <li className="p-4 bg-white rounded-md shadow-sm border border-gray-100 flex justify-between items-start hover:bg-gray-50 transition duration-150 ease-in-out">
      {/* Colonne principale cliquable (sans actions secondaires) */}
      <div className="flex-grow min-w-0">
        <Link href={`/invoices/${invoice.id}`} className="block focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-sm">
          <p className="text-sm font-medium text-gray-900">N°: {invoice.invoiceNumber}</p>
          {(() => { const total=Number(invoice.totalAmount||0); const paid=Number(invoice.paidAmount||0); const remaining = Number(invoice.outstandingAmount ?? (total - paid)); const pct = total>0 ? Math.min(100, Math.round(paid/total*100)) : 0; return (
            <div className="text-xs text-gray-600 space-y-1">
              <p>Montant: <Amount value={total} /> • Payé: <Amount value={paid}/> • Reste: <Amount value={remaining} /></p>
              <div className="h-1.5 bg-gray-200 rounded overflow-hidden"><div className={"h-full " + (pct===100? 'bg-green-500':'bg-indigo-500')} style={{width:`${pct}%`}}></div></div>
            </div>
          ); })()}
          <p className="text-xs text-gray-600 mt-1">
            Client: <span className="font-semibold">{invoice.client ? invoice.client.name : 'N/A'}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Émise le: {formatDate(invoice.issueDate)}
          </p>
          <p className="text-xs text-gray-500">
            Échéance: {formatDate(invoice.dueDate)}
          </p>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 
            ${getStatusClasses(invoice.status)}`}
          >
            {invoice.status === 'PAID' ? 'Payée' : 
             invoice.status === 'PENDING' ? 'En attente' : 
             invoice.status === 'PARTIAL' ? 'Partielle' : 'En retard'}
          </span>
          {Array.isArray(invoice.moneyMovements) && invoice.moneyMovements.length > 0 && (() => { 
            const last = invoice.moneyMovements[invoice.moneyMovements.length - 1]; 
            return (
              <p className="text-[10px] text-gray-500 mt-1">Dernière pièce: <Link href={`/treasury/movements/${last.id}`} className="font-mono underline text-indigo-600">{last.voucherRef}</Link></p>
            ); })()}
        </Link>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <a
            href={`/api/invoice/${invoice.id}/pdf`}
            className="text-xs text-indigo-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Télécharger PDF
          </a>
          {invoice.status !== 'PAID' && (
            <form action={updateInvoiceStatus} className="flex items-center gap-2">
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <input type="hidden" name="newStatus" value="PAID" />
              <button
                type="submit"
                className="px-2 py-1 bg-indigo-600 text-white rounded-md text-xs hover:bg-indigo-700 transition duration-150 ease-in-out"
              >
                Marquer payée
              </button>
            </form>
          )}
          {invoice.status !== 'PAID' && Number(invoice.outstandingAmount ?? (Number(invoice.totalAmount||0) - Number(invoice.paidAmount||0))) > 0 && (
            <a href={`/treasury?quickInvoice=${invoice.id}`} className="text-xs text-emerald-600 underline">Encaisser restant</a>
          )}
        </div>
      </div>
    </li>
  );
}