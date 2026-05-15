import { PDFDocument, rgb } from 'pdf-lib';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
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
import { requireCompanyId } from '@/lib/tenant';
import { isDemoCompany } from '@/lib/demoCompany';

export async function GET(req, { params }) {
  const companyId = requireCompanyId(req);
  const { id } = await params;
  const invoice = await prisma.incomingInvoice.findFirst({
    where: { id, companyId },
    include: {
      supplier: true,
      purchaseOrder: { select: { id: true, number: true } },
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

  const fDate = (d) => d ? formatDateFR(d) : '-';

  page.drawText('FACTURE FOURNISSEUR', { x: 170, y: 800, size: 18, font, color: rgb(0.15,0.15,0.55) });
  drawSectionTitle(page, 'Informations facture', { x: 40, y: 760, w: 280, font });
  drawBox(page, { x: 40, y: 658, w: 280, h: 88 });
  page.drawText(`Référence interne : ${cleanPdfText(invoice.entryNumber)}`, { x: 52, y: 730, size: 10, font });
  page.drawText(`Numéro fournisseur : ${cleanPdfText(invoice.supplierInvoiceNumber)}`, { x: 52, y: 714, size: 10, font });
  if (invoice.purchaseOrder) {
    page.drawText(`Bon de commande lié : ${cleanPdfText(invoice.purchaseOrder.number)}`, { x: 52, y: 698, size: 10, font });
  }
  const dateY = invoice.purchaseOrder ? 682 : 698;
  page.drawText(`Date réception : ${fDate(invoice.receiptDate)}`, { x: 52, y: dateY, size: 10, font });
  page.drawText(`Date émission : ${fDate(invoice.issueDate)}`, { x: 52, y: dateY - 16, size: 10, font });
  page.drawText(`Date échéance : ${fDate(invoice.dueDate)}`, { x: 52, y: dateY - 32, size: 10, font });

  drawSectionTitle(page, 'Fournisseur', { x: 40, y: 635, w: 515, font });
  drawBox(page, { x: 40, y: 582, w: 515, h: 40 });
  page.drawText(`Nom : ${truncateToWidth(font, invoice.supplier?.name || '-', 10, 220)}`, { x: 52, y: 606, size: 10, font });
  page.drawText(`Email : ${truncateToWidth(font, invoice.supplier?.email || '-', 10, 210)}`, { x: 52, y: 590, size: 10, font });
  if (invoice.supplier?.address) {
    page.drawText(`Adresse : ${truncateToWidth(font, invoice.supplier.address, 10, 220)}`, { x: 315, y: 606, size: 10, font });
  }

  let y = 560;
  // On conserve quantité / prix bruts (numériques) pour calcul précis multi-taux.
  // Chaque ligne peut porter son propre taux (l.vatRate) sinon fallback global invoice.vat.
  const rows = invoice.lines.map(l => ({
    accountNumber: l.account?.number || '',
    description: l.description,
    quantity: Number(l.quantity).toFixed(2),
    unitPrice: Number(l.unitPrice).toFixed(2) + ' €',
    total: Number(l.lineTotal).toFixed(2) + ' €',
    rawQuantity: Number(l.quantity),
    rawUnitPrice: Number(l.unitPrice),
    vatRate: (l.vatRate !== undefined && l.vatRate !== null) ? Number(l.vatRate) : undefined
  }));
  const tableRes = drawLinesTable(rows, { pdfDoc, page, font, startY: y, onNewPage: (p, pageIndex) => {
    drawPageHeader(p, { font, title: 'FACTURE FOURNISSEUR (suite)', subTitle: invoice.entryNumber });
    drawCompanyIdentity(p, { font, company });
  }});
  let { lastPage, y: afterLinesY, pages } = tableRes;
  // Recalcule breakdown en respectant réellement le vatRate de chaque ligne.
  const breakdown = computeVatBreakdown(rows.map(r => ({
    quantity: r.rawQuantity,
    unitPrice: r.rawUnitPrice,
    vatRate: r.vatRate // peut être undefined => fallback defaultRate plus bas
  })), { defaultRate: Number(invoice.vat || 0) });
  drawRecapBreakdown({ page: lastPage, font, startY: afterLinesY, breakdown });

  const totalPages = pages.length;
  pages.forEach((p, idx) => drawFooter(p, { font, pageNumber: idx + 1, totalPages, legal: 'Document interne fournisseur' }));
  if (isDemoCompany(dbCompany)) {
    pages.forEach(p => drawDraftWatermark(p, { font, text: 'ECHANTILLON' }));
  } else if (invoice.status === 'DRAFT') {
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
