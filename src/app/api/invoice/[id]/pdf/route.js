
import { PDFDocument, rgb } from 'pdf-lib';
import { NextResponse } from 'next/server';
import { fetchInvoiceById } from '@/lib/serverActions/clientAndInvoice';
import { requireCompanyId } from '@/lib/tenant';
import {
  cleanPdfText,
  computeVatBreakdown,
  drawBox,
  drawCompanyIdentity,
  drawDraftWatermark,
  drawFooter,
  drawLinesTable,
  drawPageHeader,
  drawRecapBreakdown,
  drawSectionTitle,
  embedLogo,
  formatDateFR,
  loadPrimaryFont,
  truncateToWidth,
} from '@/lib/pdf/utils';
import prisma from '@/lib/prisma';
import { isDemoCompany } from '@/lib/demoCompany';

export async function GET(req, { params }) {
  const companyId = requireCompanyId(req);
  const { id } = await params;
  const invoice = await fetchInvoiceById(id, companyId);
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

  // Identité société (base + fallback env)
  const dbCompany = await prisma.company.findUnique({ where: { id: companyId } });
  const company = {
    name: dbCompany?.name || process.env.COMPANY_NAME || 'Ma Société SAS',
    address: dbCompany?.address || process.env.COMPANY_ADDRESS || '12 Rue Exemple\n75000 Paris',
    siret: process.env.COMPANY_SIRET || '',
    vat: process.env.COMPANY_VAT || '',
    rccm: dbCompany?.rccmNumber || '',
    idNat: dbCompany?.idNatNumber || '',
    taxNumber: dbCompany?.taxNumber || '',
    cnss: dbCompany?.cnssNumber || '',
    onem: dbCompany?.onemNumber || '',
    inpp: dbCompany?.inppNumber || '',
  };
  drawCompanyIdentity(page, { font, company });

  page.drawText('FACTURE', { x: 210, y: 800, size: 24, font, color: rgb(0.1, 0.1, 0.7) });

  const fDate = formatDateFR;

  drawSectionTitle(page, 'Informations facture', { x: 40, y: 760, w: 260, font });
  drawBox(page, { x: 40, y: 686, w: 260, h: 60 });
  page.drawText(`Numéro : ${cleanPdfText(invoice.invoiceNumber)}`, { x: 52, y: 730, size: 10, font });
  page.drawText(`Date d'émission : ${fDate(invoice.issueDate)}`, { x: 52, y: 714, size: 10, font });
  page.drawText(`Date d'échéance : ${fDate(invoice.dueDate)}`, { x: 52, y: 698, size: 10, font });

  drawSectionTitle(page, 'Client', { x: 40, y: 670, w: 515, font });
  drawBox(page, { x: 40, y: 604, w: 515, h: 52 });
  page.drawText(`Nom : ${truncateToWidth(font, client.name, 10, 220)}`, { x: 52, y: 640, size: 10, font });
  page.drawText(`Email : ${truncateToWidth(font, client.email || '-', 10, 220)}`, { x: 52, y: 624, size: 10, font });
  page.drawText(`Catégorie : ${truncateToWidth(font, client.category || '-', 10, 180)}`, { x: 320, y: 640, size: 10, font });
  if (client.address) {
    page.drawText(`Adresse : ${truncateToWidth(font, client.address, 10, 220)}`, { x: 320, y: 624, size: 10, font });
  }

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
  const tableResult = drawLinesTable(rows, { pdfDoc, page, font, startY: 580, onNewPage: (p, pageIndex) => {
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

  y -= 20; lastPage.drawText(`Statut : ${cleanPdfText(invoice.status)}`, { x: 40, y, size: 10, font });

  // Footers with page numbers
  const totalPages = pages.length;
  pages.forEach((p, idx) => {
    drawFooter(p, { font, pageNumber: idx + 1, totalPages, legal: 'Document généré automatiquement' });
  });

  // Watermark si statut non émis (ex: DRAFT)
  if (isDemoCompany(dbCompany)) {
    pages.forEach(p => drawDraftWatermark(p, { font, text: 'ECHANTILLON' }));
  } else if (invoice.status === 'DRAFT') {
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
