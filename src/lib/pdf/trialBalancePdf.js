import { PDFDocument, rgb } from 'pdf-lib';
import { formatAmountPlain } from '@/lib/utils';
import { loadPrimaryFont, drawFooter, drawPageHeader } from '@/lib/pdf/utils';

const pageSize = [595.28, 841.89]; // A4

function toNumber(value) {
  if (value?.toNumber) return value.toNumber();
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function generateTrialBalancePdf({ rows = [] }) {
  const pdfDoc = await PDFDocument.create();
  const font = await loadPrimaryFont(pdfDoc);
  let page = pdfDoc.addPage(pageSize);
  const pages = [page];
  let y = 810;

  const newPage = () => {
    page = pdfDoc.addPage(pageSize);
    pages.push(page);
    y = 810;
    drawPageHeader(page, { font, title: 'Balance generale' });
  };

  drawPageHeader(page, { font, title: 'Balance generale' });
  page.drawText('Compte', { x: 40, y, size: 9, font });
  page.drawText('Debit', { x: 240, y, size: 9, font });
  page.drawText('Credit', { x: 320, y, size: 9, font });
  page.drawText('Solde', { x: 420, y, size: 9, font });
  y -= 14;

  let totalDebit = 0;
  let totalCredit = 0;

  for (const account of rows) {
    if (y < 80) newPage();
    const debit = (account.transactions || []).reduce((sum, t) => sum + toNumber(t.debit), 0);
    const credit = (account.transactions || []).reduce((sum, t) => sum + toNumber(t.credit), 0);
    const balance = debit - credit;

    totalDebit += debit;
    totalCredit += credit;

    page.drawText(`${account.number || ''} ${account.label || ''}`.trim(), { x: 40, y, size: 9, font, color: rgb(0.1, 0.1, 0.4) });
    if (debit) page.drawText(formatAmountPlain(debit), { x: 240, y, size: 9, font });
    if (credit) page.drawText(formatAmountPlain(credit), { x: 320, y, size: 9, font });
    page.drawText(formatAmountPlain(balance), { x: 420, y, size: 9, font });
    y -= 12;
  }

  if (y < 80) newPage();
  page.drawText('Totaux', { x: 180, y, size: 10, font, color: rgb(0.15, 0.15, 0.35) });
  page.drawText(formatAmountPlain(totalDebit), { x: 240, y, size: 10, font });
  page.drawText(formatAmountPlain(totalCredit), { x: 320, y, size: 10, font });
  const balanceTotal = totalDebit - totalCredit;
  page.drawText(formatAmountPlain(balanceTotal), { x: 420, y, size: 10, font });

  const totalPages = pages.length;
  pages.forEach((p, idx) => drawFooter(p, { font, pageNumber: idx + 1, totalPages, legal: 'Balance generale' }));
  return Buffer.from(await pdfDoc.save());
}
