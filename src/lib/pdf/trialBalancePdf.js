import { PDFDocument, rgb } from 'pdf-lib';
import { formatAmountPlain } from '@/lib/utils';
import {
  A4,
  drawBox,
  drawFooter,
  drawPageHeader,
  drawRightText,
  loadPrimaryFont,
  truncateToWidth,
} from '@/lib/pdf/utils';

function toNumber(value) {
  if (value?.toNumber) return value.toNumber();
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getAccountDisplay(row) {
  if (row?.account) return row.account;
  return row || {};
}

function getDebitCredit(row) {
  if (typeof row?.debit !== 'undefined' || typeof row?.credit !== 'undefined') {
    return {
      debit: toNumber(row?.debit),
      credit: toNumber(row?.credit),
    };
  }

  const transactions = row?.transactions || [];
  let debit = 0;
  let credit = 0;
  for (const tx of transactions) {
    const amount = toNumber(tx?.amount ?? tx?.debit ?? tx?.credit);
    if (tx?.direction === 'DEBIT') debit += amount;
    else if (tx?.direction === 'CREDIT') credit += amount;
    else {
      debit += toNumber(tx?.debit);
      credit += toNumber(tx?.credit);
    }
  }

  return { debit, credit };
}

export async function generateTrialBalancePdf({ rows = [] }) {
  const pdfDoc = await PDFDocument.create();
  const font = await loadPrimaryFont(pdfDoc);
  let page = pdfDoc.addPage(A4);
  const pages = [page];
  let y = 810;

  const drawTableHeader = () => {
    drawBox(page, { x: 40, y: y - 5, w: 515, h: 20, fill: rgb(0.94, 0.97, 1), border: rgb(0.75, 0.82, 0.9) });
    page.drawText('Compte', { x: 46, y, size: 9, font });
    drawRightText(page, 'Débit', { xRight: 300, y, size: 9, font });
    drawRightText(page, 'Crédit', { xRight: 390, y, size: 9, font });
    drawRightText(page, 'Solde', { xRight: 545, y, size: 9, font });
    y -= 22;
  };

  const newPage = () => {
    page = pdfDoc.addPage(A4);
    pages.push(page);
    y = 810;
    drawPageHeader(page, { font, title: 'Balance generale' });
    drawTableHeader();
  };

  drawPageHeader(page, { font, title: 'Balance generale' });
  drawTableHeader();

  let totalDebit = 0;
  let totalCredit = 0;

  for (const account of rows) {
    if (y < 80) newPage();
    const accountDisplay = getAccountDisplay(account);
    const { debit, credit } = getDebitCredit(account);
    const balance = debit - credit;

    totalDebit += debit;
    totalCredit += credit;

    drawBox(page, { x: 40, y: y - 4, w: 515, h: 16, border: rgb(0.92, 0.94, 0.96) });
    page.drawText(truncateToWidth(font, `${accountDisplay.number || ''} ${accountDisplay.label || ''}`.trim(), 8, 250), {
      x: 46,
      y,
      size: 8,
      font,
      color: rgb(0.1, 0.1, 0.4),
    });
    if (debit) drawRightText(page, formatAmountPlain(debit), { xRight: 300, y, size: 8, font });
    if (credit) drawRightText(page, formatAmountPlain(credit), { xRight: 390, y, size: 8, font });
    drawRightText(page, formatAmountPlain(balance), { xRight: 545, y, size: 8, font });
    y -= 16;
  }

  if (y < 80) newPage();
  const balanceTotal = totalDebit - totalCredit;
  drawBox(page, { x: 220, y: y - 8, w: 335, h: 24, fill: rgb(0.98, 0.99, 1), border: rgb(0.75, 0.82, 0.9) });
  page.drawText('Totaux', { x: 232, y, size: 10, font, color: rgb(0.15, 0.15, 0.35) });
  drawRightText(page, formatAmountPlain(totalDebit), { xRight: 300, y, size: 10, font });
  drawRightText(page, formatAmountPlain(totalCredit), { xRight: 390, y, size: 10, font });
  drawRightText(page, formatAmountPlain(balanceTotal), { xRight: 545, y, size: 10, font });

  const totalPages = pages.length;
  pages.forEach((p, idx) => drawFooter(p, { font, pageNumber: idx + 1, totalPages, legal: 'Balance generale' }));
  return Buffer.from(await pdfDoc.save());
}
