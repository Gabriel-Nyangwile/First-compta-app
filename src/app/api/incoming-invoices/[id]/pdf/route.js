import { PDFDocument, rgb } from 'pdf-lib';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { embedLogo, formatDateFR, drawLinesTable, drawRecapBreakdown, drawPageHeader, drawFooter, drawCompanyIdentity, drawDraftWatermark, loadPrimaryFont, computeVatBreakdown } from '@/lib/pdf/utils';
import { requireCompanyId } from '@/lib/tenant';

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

  const company = {
    name: process.env.COMPANY_NAME || 'Ma Société SAS',
    address: process.env.COMPANY_ADDRESS || '12 Rue Exemple\n75000 Paris',
    siret: process.env.COMPANY_SIRET || '000 000 000 00000',
    vat: process.env.COMPANY_VAT || 'FR00XXXXXXXXX'
  };
  drawCompanyIdentity(page, { font, company });

  const fDate = (d) => d ? formatDateFR(d) : '-';

  page.drawText('FACTURE FOURNISSEUR', { x: 200, y: 800, size: 16, font, color: rgb(0.15,0.15,0.55) });
  page.drawText(`Référence interne: ${invoice.entryNumber}`, { x: 40, y: 760, size: 12, font });
  page.drawText(`Numéro fournisseur: ${invoice.supplierInvoiceNumber}`, { x: 40, y: 745, size: 12, font });
  if (invoice.purchaseOrder) {
    page.drawText(`Bon de commande lié: ${invoice.purchaseOrder.number}`, { x: 40, y: 730, size: 12, font });
  }
  const baseY = invoice.purchaseOrder ? 715 : 730;
  page.drawText(`Date réception: ${fDate(invoice.receiptDate)}`, { x: 40, y: baseY, size: 12, font });
  page.drawText(`Date émission: ${fDate(invoice.issueDate)}`, { x: 40, y: baseY - 15, size: 12, font });
  page.drawText(`Date échéance: ${fDate(invoice.dueDate)}`, { x: 40, y: baseY - 30, size: 12, font });

  // Supplier block
  let y = (invoice.purchaseOrder ? baseY - 60 : 670);
  page.drawText('Fournisseur:', { x: 40, y, size: 13, font, color: rgb(0.15,0.15,0.55) });
  y -= 15; page.drawText(invoice.supplier?.name || '-', { x: 40, y, size: 11, font });
  if (invoice.supplier?.email) { y -= 12; page.drawText(invoice.supplier.email, { x: 40, y, size: 10, font }); }
  if (invoice.supplier?.address) { y -= 12; page.drawText(invoice.supplier.address, { x: 40, y, size: 10, font }); }

  y -= 25;
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
