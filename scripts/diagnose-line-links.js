// Script de diagnostic: détecte les transactions SALE/PURCHASE sans lien de ligne
// Usage: node scripts/diagnose-line-links.js
import prisma from '../src/lib/prisma.js';

async function run() {
  const orphelines = await prisma.transaction.findMany({
    where: {
      OR: [
        { kind: 'SALE', invoiceLineId: null },
        { kind: 'PURCHASE', incomingInvoiceLineId: null }
      ]
    },
    include: {
      invoice: { select: { id: true, invoiceNumber: true } },
      incomingInvoice: { select: { id: true, entryNumber: true } },
    }
  });
  console.log(`Transactions orphelines (SALE/PURCHASE sans lien ligne): ${orphelines.length}`);
  orphelines.slice(0,50).forEach(t => {
    console.log({ id: t.id, kind: t.kind, amount: t.amount.toString(), invoice: t.invoice?.invoiceNumber, incoming: t.incomingInvoice?.entryNumber });
  });

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
