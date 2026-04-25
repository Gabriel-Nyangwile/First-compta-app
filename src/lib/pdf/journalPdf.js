import { PDFDocument, rgb } from 'pdf-lib';
import { formatAmountPlain } from '@/lib/utils';
import {
  A4,
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

export async function generateJournalPdf({ entries = [] }) {
  const pdfDoc = await PDFDocument.create();
  const font = await loadPrimaryFont(pdfDoc);
  let page = pdfDoc.addPage(A4);
  const pages = [page];
  let y = 810;

  const newPage = (title) => {
    page = pdfDoc.addPage(A4);
    pages.push(page);
    y = 810;
    drawPageHeader(page, { font, title });
  };

  drawPageHeader(page, { font, title: 'Journal des ecritures' });

  for (const entry of entries) {
    if (y < 140) newPage('Journal des ecritures');
    drawBox(page, { x: 40, y: y - 36, w: 515, h: 50, fill: rgb(0.985, 0.99, 1), border: rgb(0.78, 0.84, 0.92) });
    page.drawText(`Écriture ${entry.number || entry.id || ''}`, { x: 52, y, size: 11, font, color: rgb(0.15, 0.15, 0.4) });
    if (entry.date) {
      page.drawText(`Date: ${formatDateFR(entry.date)}`, { x: 52, y: y - 15, size: 9, font });
    }
    if (entry.label) {
      page.drawText(`Libellé: ${truncateToWidth(font, entry.label, 9, 360)}`, { x: 165, y: y - 15, size: 9, font });
    }
    y -= 58;

    drawBox(page, { x: 40, y: y - 5, w: 515, h: 20, fill: rgb(0.94, 0.97, 1), border: rgb(0.75, 0.82, 0.9) });
    page.drawText('Compte', { x: 46, y, size: 9, font });
    page.drawText('Référence', { x: 280, y, size: 9, font });
    drawRightText(page, 'Débit', { xRight: 430, y, size: 9, font });
    drawRightText(page, 'Crédit', { xRight: 545, y, size: 9, font });
    y -= 22;

    for (const line of entry.lines || []) {
      if (y < 80) newPage('Journal des ecritures');
      drawBox(page, { x: 40, y: y - 4, w: 515, h: 16, border: rgb(0.92, 0.94, 0.96) });
      page.drawText(truncateToWidth(font, line.account?.number ? `${line.account.number} ${line.account.label || ''}` : '-', 8, 220), { x: 46, y, size: 8, font });

      const debit = toNumber(line.debit);
      const credit = toNumber(line.credit);

      const ref =
        line.invoice?.invoiceNumber ||
        line.incomingInvoice?.entryNumber ||
        line.moneyMovement?.voucherRef ||
        line.client?.name ||
        line.supplier?.name;
      if (ref) page.drawText(truncateToWidth(font, ref, 8, 130), { x: 280, y, size: 8, font });
      if (debit) drawRightText(page, formatAmountPlain(debit), { xRight: 430, y, size: 8, font });
      if (credit) drawRightText(page, formatAmountPlain(credit), { xRight: 545, y, size: 8, font });
      y -= 16;
    }
    y -= 12;
  }

  const totalPages = pages.length;
  pages.forEach((p, idx) => drawFooter(p, { font, pageNumber: idx + 1, totalPages, legal: 'Export journal' }));
  return Buffer.from(await pdfDoc.save());
}
