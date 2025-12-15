import 'dotenv/config';
import prisma from '../src/lib/prisma.js';

async function main() {
  const pos = await prisma.assetPurchaseOrder.findMany({
    where: { incomingInvoiceId: null },
    select: { id: true, number: true },
  });
  const manualMap = {
    'APO-000005': 'EI-2025-0005',
    'APO-000006': 'EI-2025-0006',
  };
  if (!pos.length) {
    console.log('Aucun BC immobilisation à relier.');
    return;
  }

  let linked = 0;
  const unmatched = [];
  for (const po of pos) {
    // Stratégie: match manuel si connu, sinon supplierInvoiceNumber/entryNumber contenant le numéro du BC
    let inv = null;
    const manual = manualMap[po.number];
    if (manual) {
      inv = await prisma.incomingInvoice.findFirst({
        where: {
          OR: [
            { entryNumber: manual },
            { supplierInvoiceNumber: manual },
          ],
        },
        select: { id: true, entryNumber: true, supplierInvoiceNumber: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (!inv) {
      inv = await prisma.incomingInvoice.findFirst({
        where: {
          OR: [
            { supplierInvoiceNumber: { contains: po.number } },
            { entryNumber: { contains: po.number } },
          ],
        },
        select: { id: true, entryNumber: true, supplierInvoiceNumber: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (!inv) {
      unmatched.push(po);
    } else {
      await prisma.assetPurchaseOrder.update({
        where: { id: po.id },
        data: { incomingInvoiceId: inv.id, status: 'INVOICED' },
      });
      linked += 1;
      console.log(`Relie ${po.number} -> invoice ${inv.entryNumber || inv.supplierInvoiceNumber}`);
    }
  }
  console.log(`Terminé. Liens créés: ${linked}/${pos.length}`);
  if (unmatched.length) {
    console.log('BC immob sans facture trouvée :');
    unmatched.forEach((po) => console.log(` - ${po.number} (id=${po.id})`));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
