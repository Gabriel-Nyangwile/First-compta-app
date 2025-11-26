import { PDFDocument, rgb } from 'pdf-lib';
import { formatAmountPlain } from '@/lib/utils';
import { formatDateFR, loadPrimaryFont, drawFooter, drawPageHeader } from '@/lib/pdf/utils';

const pageSize = [595.28, 841.89]; // A4

function toNumber(value) {
  if (value?.toNumber) return value.toNumber();
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function generateJournalPdf({ entries = [] }) {
  const pdfDoc = await PDFDocument.create();
  const font = await loadPrimaryFont(pdfDoc);
  let page = pdfDoc.addPage(pageSize);
  const pages = [page];
  let y = 810;

  const newPage = (title) => {
    page = pdfDoc.addPage(pageSize);
    pages.push(page);
    y = 810;
    drawPageHeader(page, { font, title });
  };

  drawPageHeader(page, { font, title: 'Journal des ecritures' });

  for (const entry of entries) {
    if (y < 140) newPage('Journal des ecritures');
    page.drawText(`Ecriture ${entry.number || entry.id || ''}`, { x: 40, y, size: 11, font, color: rgb(0.15, 0.15, 0.4) });
    y -= 14;
    if (entry.date) {
      page.drawText(`Date: ${formatDateFR(entry.date)}`, { x: 40, y, size: 9, font });
      y -= 12;
    }
    if (entry.label) {
      page.drawText(`Libelle: ${entry.label}`, { x: 40, y, size: 9, font });
      y -= 12;
    }

    page.drawText('Compte', { x: 40, y, size: 9, font });
    page.drawText('Debit', { x: 280, y, size: 9, font });
    page.drawText('Credit', { x: 360, y, size: 9, font });
    page.drawText('Ref', { x: 440, y, size: 9, font });
    y -= 12;

    for (const line of entry.lines || []) {
      if (y < 80) newPage('Journal des ecritures');
      page.drawText(line.account?.number ? `${line.account.number} ${line.account.label || ''}` : '-', { x: 40, y, size: 9, font });

      const debit = toNumber(line.debit);
      const credit = toNumber(line.credit);
      if (debit) page.drawText(formatAmountPlain(debit), { x: 280, y, size: 9, font });
      if (credit) page.drawText(formatAmountPlain(credit), { x: 360, y, size: 9, font });

      const ref =
        line.invoice?.invoiceNumber ||
        line.incomingInvoice?.entryNumber ||
        line.moneyMovement?.voucherRef ||
        line.client?.name ||
        line.supplier?.name;
      if (ref) page.drawText(String(ref).slice(0, 28), { x: 440, y, size: 8, font });
      y -= 12;
    }
    y -= 10;
  }

  const totalPages = pages.length;
  pages.forEach((p, idx) => drawFooter(p, { font, pageNumber: idx + 1, totalPages, legal: 'Export journal' }));
  return Buffer.from(await pdfDoc.save());
}
