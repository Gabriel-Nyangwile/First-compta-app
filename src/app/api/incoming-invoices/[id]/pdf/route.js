import { PDFDocument, rgb } from 'pdf-lib';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { embedLogo, formatDateFR, drawLinesTable, drawRecapBreakdown, drawPageHeader, drawFooter, drawCompanyIdentity, drawDraftWatermark, loadPrimaryFont, computeVatBreakdown } from '@/lib/pdf/utils';

export async function GET(req, { params }) {
  const { id } = await params;
  const invoice = await prisma.incomingInvoice.findUnique({
    where: { id },
    include: {
      supplier: true,
      lines: { include: { account: { select: { number: true, label: true } } } }
    }
  });
  if (!invoice) return new NextResponse('Incoming invoice not found', { status: 404 });

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await loadPrimaryFont(pdfDoc);

  const maybeLogo = await embedLogo(pdfDoc);
  if (maybeLogo) {
    page.drawImage(maybeLogo.image, { x: 40, y: 800, width: maybeLogo.scaled.width, height: maybeLogo.scaled.height });
  }

  const company = {
    name: process.env.COMPANY_NAME || 'Ma Société SAS',
    address: process.env.COMPANY_ADDRESS || '12 Rue Exemple\n75000 Paris',
    siret: process.env.COMPANY_SIRET || '000 000 000 00000',
    vat: process.env.COMPANY_VAT || 'FR00XXXXXXXXX'
  };
  drawCompanyIdentity(page, { font, company });

  const fDate = (d) => d ? formatDateFR(d) : '-';

  page.drawText('FACTURE FOURNISSEUR', { x: 200, y: 800, size: 16, font, color: rgb(0.15,0.15,0.55) });
  page.drawText(`Entry #: ${invoice.entryNumber}`, { x: 40, y: 760, size: 12, font });
  page.drawText(`Numéro fournisseur: ${invoice.supplierInvoiceNumber}`, { x: 40, y: 745, size: 12, font });
  page.drawText(`Date réception: ${fDate(invoice.receiptDate)}`, { x: 40, y: 730, size: 12, font });
  page.drawText(`Date émission: ${fDate(invoice.issueDate)}`, { x: 40, y: 715, size: 12, font });
  page.drawText(`Date échéance: ${fDate(invoice.dueDate)}`, { x: 40, y: 700, size: 12, font });

  // Supplier block
  let y = 670;
  page.drawText('Fournisseur:', { x: 40, y, size: 13, font, color: rgb(0.15,0.15,0.55) });
  y -= 15; page.drawText(invoice.supplier?.name || '-', { x: 40, y, size: 11, font });
  if (invoice.supplier?.email) { y -= 12; page.drawText(invoice.supplier.email, { x: 40, y, size: 10, font }); }
  if (invoice.supplier?.address) { y -= 12; page.drawText(invoice.supplier.address, { x: 40, y, size: 10, font }); }

  y -= 25;
  const rows = invoice.lines.map(l => ({
    accountNumber: l.account?.number || '',
    description: l.description,
    quantity: Number(l.quantity).toFixed(2),
    unitPrice: Number(l.unitPrice).toFixed(2) + ' €',
    total: Number(l.lineTotal).toFixed(2) + ' €'
  }));
  const tableRes = drawLinesTable(rows, { pdfDoc, page, font, startY: y, onNewPage: (p, pageIndex) => {
    drawPageHeader(p, { font, title: 'FACTURE FOURNISSEUR (suite)', subTitle: invoice.entryNumber });
    drawCompanyIdentity(p, { font, company });
  }});
  let { lastPage, y: afterLinesY, pages } = tableRes;
  const breakdown = computeVatBreakdown(rows.map(r => ({
    quantity: Number(r.quantity),
    unitPrice: Number(r.unitPrice.replace(' €','')),
    vatRate: undefined // incoming invoice pour l'instant: utilisera vat global si pas stocké ligne
  })), { defaultRate: Number(invoice.vat || 0) });
  drawRecapBreakdown({ page: lastPage, font, startY: afterLinesY, breakdown });

  const totalPages = pages.length;
  pages.forEach((p, idx) => drawFooter(p, { font, pageNumber: idx + 1, totalPages, legal: 'Document interne fournisseur' }));
  if (invoice.status === 'DRAFT') {
    pages.forEach(p => drawDraftWatermark(p, { font }));
  }

  const pdfBytes = await pdfDoc.save();
  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="incoming-invoice-${invoice.entryNumber}.pdf"`
    }
  });
}
