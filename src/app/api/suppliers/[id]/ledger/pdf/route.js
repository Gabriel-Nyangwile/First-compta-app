import { NextResponse } from 'next/server';
import { PDFDocument, rgb } from 'pdf-lib';
import { getSupplierLedger } from '@/lib/serverActions/ledgers';
import { requireCompanyId } from '@/lib/tenant';
import { A4, drawBox, drawFooter, drawRightText, loadPrimaryFont, truncateToWidth } from '@/lib/pdf/utils';

function drawHeader(page, font, title, info) {
  page.drawText(title, { x: 40, y: 805, size: 17, font, color: rgb(0.15,0.15,0.6) });
  drawBox(page, { x: 40, y: 760, w: 515, h: 30, fill: rgb(0.985, 0.99, 1), border: rgb(0.82, 0.88, 0.94) });
  page.drawText(truncateToWidth(font, info, 9, 490), { x: 52, y: 773, size: 9, font, color: rgb(0.3,0.3,0.3) });
}

function drawTableHeader(page, font, y) {
  drawBox(page, { x: 40, y: y - 5, w: 515, h: 20, fill: rgb(0.94, 0.97, 1), border: rgb(0.75, 0.82, 0.9) });
  page.drawText('Date', { x:46, y, size:8.5, font });
  page.drawText('Compte', { x:92, y, size:8.5, font });
  page.drawText('Libellé', { x:148, y, size:8.5, font });
  page.drawText('Pièce', { x:285, y, size:8.5, font });
  page.drawText('Statut', { x:335, y, size:8.5, font });
  drawRightText(page, 'Débit', { xRight: 430, y, size:8.5, font });
  drawRightText(page, 'Crédit', { xRight: 490, y, size:8.5, font });
  drawRightText(page, 'Solde', { xRight: 545, y, size:8.5, font });
}

export async function GET(req, { params }) {
  try {
    const companyId = requireCompanyId(req);
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const dateStart = searchParams.get('dateStart') || undefined;
    const dateEnd = searchParams.get('dateEnd') || undefined;
    const includeDetails = searchParams.get('includeDetails') === '1';
  const ledger = await getSupplierLedger({ id, companyId, dateStart, dateEnd, includeDetails });
    const pdf = await PDFDocument.create();
    const font = await loadPrimaryFont(pdf);
    const pages = [];
    let page = pdf.addPage(A4);
    pages.push(page);
    let y = 732;
  const info = `Fournisseur: ${ledger.partyName || ledger.partyId}${ledger.partyAccountNumber ? ' | Compte: '+ledger.partyAccountNumber : ''}${ledger.partyAccountLabel ? ' ('+ledger.partyAccountLabel+')' : ''}`;
  drawHeader(page, font, 'Grand Livre Fournisseur', info);
    drawBox(page, { x: 40, y: 708, w: 515, h: 18, fill: rgb(0.98, 1, 0.98), border: rgb(0.8, 0.9, 0.8) });
    page.drawText('Ouverture', { x: 52, y: 714, size: 9, font, color: rgb(0,0.4,0) });
    drawRightText(page, `${ledger.opening.toFixed(2)} €`, { xRight: 545, y: 714, size: 9, font, color: rgb(0,0.4,0) });
    y = 686;
    drawTableHeader(page, font, y);
    y -= 22;
    for (const r of ledger.rows) {
  if (y < 70) { page = pdf.addPage(A4); pages.push(page); y = 732; drawHeader(page, font, 'Grand Livre Fournisseur (suite)', info); drawTableHeader(page, font, y); y -= 22; }
      drawBox(page, { x: 40, y: y - 4, w: 515, h: 16, border: rgb(0.92, 0.94, 0.96) });
      page.drawText(new Date(r.date).toLocaleDateString('fr-FR'), { x:46, y, size:7.5, font });
      page.drawText(truncateToWidth(font, r.accountNumber || '', 7.5, 50), { x:92, y, size:7.5, font });
      page.drawText(truncateToWidth(font, r.description || '', 7.5, 128), { x:148, y, size:7.5, font });
      page.drawText(truncateToWidth(font, r.invoiceRef || '', 7.5, 45), { x:285, y, size:7.5, font });
      page.drawText(truncateToWidth(font, r.invoiceStatus || '', 7.5, 45), { x:335, y, size:7.5, font });
      if (r.debit) drawRightText(page, r.debit.toFixed(2), { xRight: 430, y, size:7.5, font });
      if (r.credit) drawRightText(page, r.credit.toFixed(2), { xRight: 490, y, size:7.5, font });
      drawRightText(page, r.running.toFixed(2), { xRight: 545, y, size:7.5, font });
      y -= 16;
    }
    if (y < 70) { page = pdf.addPage(A4); pages.push(page); y = 732; drawHeader(page, font, 'Grand Livre Fournisseur (suite)', info); }
    drawBox(page, { x: 40, y: y - 8, w: 515, h: 22, fill: rgb(1, 0.98, 0.98), border: rgb(0.9, 0.8, 0.8) });
    page.drawText('Clôture', { x: 52, y, size: 10, font, color: rgb(0.5,0,0) });
    drawRightText(page, `${ledger.closing.toFixed(2)} €`, { xRight: 545, y, size: 10, font, color: rgb(0.5,0,0) });
    pages.forEach((p, idx) => drawFooter(p, { font, pageNumber: idx + 1, totalPages: pages.length, legal: 'Grand livre fournisseur' }));
    const bytes = await pdf.save();
  const safeName = (ledger.partyName || 'fournisseur').replace(/[^a-z0-9]+/gi,'_').toLowerCase();
  return new NextResponse(bytes, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="supplier-ledger-${safeName}.pdf"` } });
  } catch (e) {
    return new NextResponse('Erreur: ' + e.message, { status: 400 });
  }
}
