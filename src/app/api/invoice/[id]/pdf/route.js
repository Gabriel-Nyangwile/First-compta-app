
import { PDFDocument, rgb } from 'pdf-lib';
import { NextResponse } from 'next/server';
import { fetchInvoiceById } from '@/lib/serverActions/clientAndInvoice';
import { embedLogo, formatDateFR, drawLinesTable, drawRecapBreakdown, drawPageHeader, drawFooter, drawCompanyIdentity, drawDraftWatermark, loadPrimaryFont, computeVatBreakdown } from '@/lib/pdf/utils';

export async function GET(req, { params }) {
  const { id } = await params;
  const invoice = await fetchInvoiceById(id);
  if (!invoice) {
    return new NextResponse('Facture non trouvée', { status: 404 });
  }
  const client = invoice.client;
  const lines = invoice.invoiceLines || [];

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // Format A4 en points (1pt = 1/72in)
  const font = await loadPrimaryFont(pdfDoc);

  const maybeLogo = await embedLogo(pdfDoc);
  if (maybeLogo) {
    page.drawImage(maybeLogo.image, { x: 40, y: 800, width: maybeLogo.scaled.width, height: maybeLogo.scaled.height });
  }

  // Identité société (variables d'environnement ou fallback)
  const company = {
    name: process.env.COMPANY_NAME || 'Ma Société SAS',
    address: process.env.COMPANY_ADDRESS || '12 Rue Exemple\n75000 Paris',
    siret: process.env.COMPANY_SIRET || '000 000 000 00000',
    vat: process.env.COMPANY_VAT || 'FR00XXXXXXXXX'
  };
  drawCompanyIdentity(page, { font, company });

  // Titre principal
  page.drawText('FACTURE', { x: 250, y: 800, size: 28, font, color: rgb(0.1, 0.1, 0.7) });

  const fDate = formatDateFR;

  // Infos facture
  page.drawText(`Numéro : ${invoice.invoiceNumber}`, { x: 40, y: 760, size: 14, font });
  page.drawText(`Date d'émission : ${fDate(invoice.issueDate)}`, { x: 40, y: 740, size: 12, font });
  page.drawText(`Date d'échéance : ${fDate(invoice.dueDate)}`, { x: 40, y: 725, size: 12, font });

  // Infos client
  page.drawText('Client :', { x: 40, y: 700, size: 14, font, color: rgb(0.1, 0.1, 0.7) });
  page.drawText(`Nom : ${client.name}`, { x: 60, y: 685, size: 12, font });
  page.drawText(`Email : ${client.email}`, { x: 60, y: 670, size: 12, font });
  if (client.address) {
    page.drawText(`Adresse : ${client.address}`, { x: 60, y: 655, size: 12, font });
  }
  page.drawText(`Catégorie : ${client.category}`, { x: 60, y: 640, size: 12, font });

  const rows = lines.map(l => ({
    accountNumber: l.account?.number || '',
    description: l.description,
    quantity: Number(l.quantity).toFixed(2),
    unitPrice: Number(l.unitPrice).toFixed(2) + ' €',
    total: Number(l.lineTotal).toFixed(2) + ' €',
    rawQuantity: Number(l.quantity),
    rawUnitPrice: Number(l.unitPrice),
    vatRate: l.vatRate !== undefined ? Number(l.vatRate) : undefined
  }));
  const tableResult = drawLinesTable(rows, { pdfDoc, page, font, startY: 600, onNewPage: (p, pageIndex) => {
    drawPageHeader(p, { font, title: 'FACTURE (suite)', subTitle: `#${invoice.invoiceNumber}` });
    drawCompanyIdentity(p, { font, company });
  }});
  let { lastPage, y, pages } = tableResult;
  // Multi-taux: on recalcule à partir des quantités/unitPrice
  const breakdown = computeVatBreakdown(rows.map(r => ({
    quantity: r.rawQuantity,
    unitPrice: r.rawUnitPrice,
    vatRate: r.vatRate
  })), { defaultRate: Number(invoice.vat || 0) });
  y = drawRecapBreakdown({ page: lastPage, font, startY: y, breakdown });

  y -= 20; lastPage.drawText(`Statut : ${invoice.status}`, { x: 40, y, size: 12, font });

  // Footers with page numbers
  const totalPages = pages.length;
  pages.forEach((p, idx) => {
    drawFooter(p, { font, pageNumber: idx + 1, totalPages, legal: 'Document généré automatiquement' });
  });

  // Watermark si statut non émis (ex: DRAFT)
  if (invoice.status === 'DRAFT') {
    pages.forEach(p => drawDraftWatermark(p, { font }));
  }

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="facture-${invoice.invoiceNumber}.pdf"`,
    },
  });
}
