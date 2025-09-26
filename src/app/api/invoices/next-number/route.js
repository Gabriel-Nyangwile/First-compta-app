import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

// GET /api/invoices/next-number
export async function GET() {
  const now = new Date();
  const year = now.getFullYear();
  // Chercher la dernière facture de l'année en cours
  const lastInvoice = await prisma.invoice.findFirst({
    where: {
      invoiceNumber: {
        startsWith: `Numero-${year}/`,
      },
    },
    orderBy: {
      invoiceNumber: 'desc',
    },
  });
  let nextNumber = 1;
  if (lastInvoice) {
    // Extraire le numéro courant
    const match = lastInvoice.invoiceNumber.match(/Numero-\d{4}\/(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }
  const padded = String(nextNumber).padStart(4, '0');
  const invoiceNumber = `Numero-${year}/${padded}`;
  return NextResponse.json({ invoiceNumber });
}
