import { PDFDocument, rgb } from 'pdf-lib';
import { formatAmountPlain } from '@/lib/utils';
import { formatDateFR, loadPrimaryFont, drawFooter, drawPageHeader } from '@/lib/pdf/utils';

const pageSize = [595.28, 841.89]; // A4

function toNumber(value) {
  if (value?.toNumber) return value.toNumber();
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function generateLedgerPdf({ account, transactions = [] }) {
  const pdfDoc = await PDFDocument.create();
  const font = await loadPrimaryFont(pdfDoc);
  let page = pdfDoc.addPage(pageSize);
  const pages = [page];
  let y = 810;

  const headerTitle = account
    ? `Grand livre - ${account.number || ''} ${account.label || ''}`.trim()
    : 'Grand livre';

  const newPage = () => {
    page = pdfDoc.addPage(pageSize);
    pages.push(page);
    y = 810;
    drawPageHeader(page, { font, title: headerTitle });
  };

  drawPageHeader(page, { font, title: headerTitle });

  page.drawText(`Compte: ${account?.number || '-'} ${account?.label || ''}`, { x: 40, y, size: 11, font, color: rgb(0.15, 0.15, 0.4) });
  y -= 16;
  page.drawText('Date', { x: 40, y, size: 9, font });
  page.drawText('Piece', { x: 120, y, size: 9, font });
  page.drawText('Debit', { x: 280, y, size: 9, font });
  page.drawText('Credit', { x: 360, y, size: 9, font });
  page.drawText('Ref', { x: 440, y, size: 9, font });
  y -= 12;

  let totalDebit = 0;
  let totalCredit = 0;

  for (const trx of transactions) {
    if (y < 80) newPage();
    const debit = toNumber(trx.debit);
    const credit = toNumber(trx.credit);
    totalDebit += debit;
    totalCredit += credit;

    page.drawText(formatDateFR(trx.date) || '-', { x: 40, y, size: 9, font });
    const piece = trx.journalEntry?.number || trx.moneyMovement?.voucherRef || '';
    if (piece) page.drawText(String(piece), { x: 120, y, size: 9, font });
    if (debit) page.drawText(formatAmountPlain(debit), { x: 280, y, size: 9, font });
    if (credit) page.drawText(formatAmountPlain(credit), { x: 360, y, size: 9, font });

    const ref =
      trx.invoice?.invoiceNumber ||
      trx.incomingInvoice?.entryNumber ||
      trx.client?.name ||
      trx.supplier?.name;
    if (ref) page.drawText(String(ref).slice(0, 28), { x: 440, y, size: 8, font });
    y -= 12;
  }

  if (y < 80) newPage();
  page.drawText('Totaux', { x: 200, y, size: 10, font, color: rgb(0.15, 0.15, 0.35) });
  page.drawText(formatAmountPlain(totalDebit), { x: 280, y, size: 10, font });
  page.drawText(formatAmountPlain(totalCredit), { x: 360, y, size: 10, font });
  y -= 14;
  const balance = totalDebit - totalCredit;
  page.drawText(`Solde (${balance >= 0 ? 'Debit' : 'Credit'}): ${formatAmountPlain(Math.abs(balance))}`, { x: 200, y, size: 10, font });

  const totalPages = pages.length;
  pages.forEach((p, idx) => drawFooter(p, { font, pageNumber: idx + 1, totalPages, legal: 'Grand livre' }));
  return Buffer.from(await pdfDoc.save());
}
