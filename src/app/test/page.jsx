import prisma from '@/lib/prisma';

// Simple test page (deduplicated). Remove this file in production if not needed.
export default async function TestPage() {
  const [clients, invoices] = await Promise.all([
    prisma.client.findMany(),
    prisma.invoice.findMany({ include: { client: true } })
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