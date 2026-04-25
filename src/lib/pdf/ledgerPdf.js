import { PDFDocument, rgb } from 'pdf-lib';
import { formatAmountPlain } from '@/lib/utils';
import {
  A4,
  cleanPdfText,
  drawBox,
  drawFooter,
  drawPageHeader,
  drawRightText,
  formatDateFR,
  loadPrimaryFont,
  truncateToWidth,
} from '@/lib/pdf/utils';

function toNumber(value) {
  if (value?.toNumber) return value.toNumber();
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function generateLedgerPdf({ account, transactions = [] }) {
  const pdfDoc = await PDFDocument.create();
  const font = await loadPrimaryFont(pdfDoc);
  let page = pdfDoc.addPage(A4);
  const pages = [page];
  let y = 780;

  const headerTitle = account
    ? `Grand livre - ${account.number || ''} ${account.label || ''}`.trim()
    : 'Grand livre';

  const newPage = () => {
    page = pdfDoc.addPage(A4);
    pages.push(page);
    y = 780;
    drawPageHeader(page, { font, title: headerTitle });
    drawTableHeader();
  };

  const drawTableHeader = () => {
    drawBox(page, { x: 40, y: y - 5, w: 515, h: 20, fill: rgb(0.94, 0.97, 1), border: rgb(0.75, 0.82, 0.9) });
    page.drawText('Date', { x: 46, y, size: 9, font });
    page.drawText('Pièce', { x: 110, y, size: 9, font });
    page.drawText('Référence', { x: 210, y, size: 9, font });
    drawRightText(page, 'Débit', { xRight: 390, y, size: 9, font });
    drawRightText(page, 'Crédit', { xRight: 470, y, size: 9, font });
    drawRightText(page, 'Solde', { xRight: 545, y, size: 9, font });
    y -= 22;
  };

  drawPageHeader(page, { font, title: headerTitle });
  drawBox(page, { x: 40, y: 744, w: 515, h: 44, fill: rgb(1, 1, 1), border: rgb(0.82, 0.86, 0.9) });
  page.drawText('Compte', { x: 52, y: 770, size: 9, font, color: rgb(0.35, 0.35, 0.35) });
  page.drawText(truncateToWidth(font, `${account?.number || '-'} ${account?.label || ''}`, 11, 480), {
    x: 52,
    y: 754,
    size: 11,
    font,
    color: rgb(0.12, 0.18, 0.42),
  });
  y = 720;
  drawTableHeader();

  let totalDebit = 0;
  let totalCredit = 0;
  let running = 0;

  for (const trx of transactions) {
    if (y < 80) newPage();
    const debit = toNumber(trx.debit);
    const credit = toNumber(trx.credit);
    totalDebit += debit;
    totalCredit += credit;
    running += debit - credit;

    drawBox(page, { x: 40, y: y - 4, w: 515, h: 16, border: rgb(0.92, 0.94, 0.96) });
    page.drawText(formatDateFR(trx.date) || '-', { x: 46, y, size: 8, font });
    const piece = trx.journalEntry?.number || trx.moneyMovement?.voucherRef || '';
    if (piece) page.drawText(truncateToWidth(font, cleanPdfText(piece), 8, 90), { x: 110, y, size: 8, font });

    const ref =
      trx.invoice?.invoiceNumber ||
      trx.incomingInvoice?.entryNumber ||
      trx.client?.name ||
      trx.supplier?.name;
    if (ref) page.drawText(truncateToWidth(font, ref, 8, 140), { x: 210, y, size: 8, font });
    if (debit) drawRightText(page, formatAmountPlain(debit), { xRight: 390, y, size: 8, font });
    if (credit) drawRightText(page, formatAmountPlain(credit), { xRight: 470, y, size: 8, font });
    drawRightText(page, formatAmountPlain(running), { xRight: 545, y, size: 8, font });
    y -= 16;
  }

  if (y < 80) newPage();
  const balance = totalDebit - totalCredit;
  drawBox(page, { x: 230, y: y - 36, w: 325, h: 50, fill: rgb(0.98, 0.99, 1), border: rgb(0.75, 0.82, 0.9) });
  page.drawText('Totaux', { x: 242, y, size: 10, font, color: rgb(0.15, 0.15, 0.35) });
  drawRightText(page, formatAmountPlain(totalDebit), { xRight: 390, y, size: 10, font });
  drawRightText(page, formatAmountPlain(totalCredit), { xRight: 470, y, size: 10, font });
  drawRightText(page, formatAmountPlain(balance), { xRight: 545, y, size: 10, font });
  y -= 18;
  page.drawText(`Solde ${balance >= 0 ? 'débiteur' : 'créditeur'}`, { x: 242, y, size: 10, font });
  drawRightText(page, formatAmountPlain(Math.abs(balance)), { xRight: 545, y, size: 10, font, color: rgb(0.1, 0.18, 0.42) });

  const totalPages = pages.length;
  pages.forEach((p, idx) => drawFooter(p, { font, pageNumber: idx + 1, totalPages, legal: 'Grand livre' }));
  return Buffer.from(await pdfDoc.save());
}
