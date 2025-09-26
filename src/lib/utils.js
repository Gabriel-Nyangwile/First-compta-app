// src/lib/utils.js

// Formate une date en français (ex: 13 septembre 2025)
export function formatDateFR(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Retourne la classe CSS pour le badge de statut
export function getStatusClasses(status) {
  switch (status) {
    case 'PAID': return 'bg-green-100 text-green-800';
    case 'PENDING': return 'bg-yellow-100 text-yellow-800';
    case 'OVERDUE': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

// Retourne le label français du statut
export function getStatusLabel(status) {
  switch (status) {
    case 'PAID': return 'Payée';
    case 'PENDING': return 'En attente';
    case 'OVERDUE': return 'En retard';
    default: return status;
  }
}

// Formate un montant avec devise (EUR par défaut) en style comptable fr-FR
export function formatAmount(amount, currency = 'EUR') {
  if (amount == null) return '';
  const num = typeof amount === 'string' ? Number(amount) : (amount.toNumber ? amount.toNumber() : Number(amount));
  if (isNaN(num)) return amount.toString?.() || '';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(num);
}

// Format technique (pour CSV / PDF calc) : nombre à 2 décimales (string) sans symbole devise.
export function formatAmountPlain(amount) {
  if (amount == null) return '';
  const num = typeof amount === 'string' ? Number(amount) : (amount.toNumber ? amount.toNumber() : Number(amount));
  if (isNaN(num)) return '';
  return num.toFixed(2);
}

// Variante pour pourcentage (taux) avec trimming si .00
export function formatRatePercent(rate) {
  if (rate == null) return '';
  const num = Number(rate);
  if (isNaN(num)) return '';
  const s = num.toFixed(2);
  return s.endsWith('.00') ? s.slice(0, -3) : s;
}

// Ajoute un paramètre returnTo pour permettre un retour direct après consultation d'une facture
export function buildInvoiceLink(invoiceId, authorizationId) {
  if (!invoiceId) return '#';
  const ret = authorizationId ? encodeURIComponent(`/authorizations/${authorizationId}`) : '';
  return `/invoices/${invoiceId}` + (ret ? `?returnTo=${ret}` : '');
}

export function buildIncomingInvoiceLink(invoiceId, authorizationId) {
  if (!invoiceId) return '#';
  const ret = authorizationId ? encodeURIComponent(`/authorizations/${authorizationId}`) : '';
  return `/incoming-invoices/${invoiceId}` + (ret ? `?returnTo=${ret}` : '');
}
