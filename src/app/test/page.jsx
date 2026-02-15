import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { getCompanyIdFromCookies } from '@/lib/tenant';

// Simple test page (deduplicated). Remove this file in production if not needed.
export default async function TestPage() {
  const cookieStore = await cookies();
  const companyId = getCompanyIdFromCookies(cookieStore);
  if (!companyId) {
    return <main style={{ padding: '2rem' }}>companyId requis (cookie company-id ou DEFAULT_COMPANY_ID).</main>;
  }
  const [clients, invoices] = await Promise.all([
    prisma.client.findMany({ where: { companyId } }),
    prisma.invoice.findMany({ where: { companyId }, include: { client: true } })
  ]);

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Données de Test</h1>

      <h2>Clients</h2>
      {clients.length === 0 ? (
        <p>Aucun client trouvé.</p>
      ) : (
        <ul>
          {clients.map(c => (
            <li key={c.id}>{c.name} - {c.email}</li>
          ))}
        </ul>
      )}

      <h2>Factures</h2>
      {invoices.length === 0 ? (
        <p>Aucune facture trouvée.</p>
      ) : (
        <ul>
          {invoices.map(inv => (
            <li key={inv.id}>
              Facture #{inv.invoiceNumber} - Client: {inv.client ? inv.client.name : 'N/A'} - Montant: {inv.totalAmount.toString()}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
