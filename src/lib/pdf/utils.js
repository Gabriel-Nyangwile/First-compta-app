// Shared PDF utilities for invoice generation (client & incoming invoices)
// Centralize formatting, logo embedding, and table drawing to reduce duplication.

import fs from 'fs';
import path from 'path';
import { rgb, StandardFonts } from 'pdf-lib';
import { formatAmountPlain, formatRatePercent } from '@/lib/utils';

export const A4 = [595.28, 841.89];

export function cleanPdfText(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncateToWidth(font, value, size, maxWidth) {
  const text = cleanPdfText(value);
  if (!text) return '';
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

export function drawRightText(page, value, { xRight, y, size, font, color = rgb(0, 0, 0) }) {
  const text = cleanPdfText(value);
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: xRight - width, y, size, font, color });
}

export function drawBox(page, { x, y, w, h, border = rgb(0.82, 0.86, 0.9), fill = rgb(1, 1, 1) }) {
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    borderColor: border,
    borderWidth: 0.8,
    color: fill,
  });
}

export function drawSectionTitle(page, title, { x, y, w, font }) {
  drawBox(page, { x, y: y - 18, w, h: 24, fill: rgb(0.94, 0.97, 1), border: rgb(0.72, 0.8, 0.9) });
  page.drawText(cleanPdfText(title), { x: x + 8, y: y - 10, size: 10, font, color: rgb(0.1, 0.18, 0.42) });
}

/**
 * Attempt to embed logo.png from /public. Returns { image, scaled } or null.
 */
export async function embedLogo(pdfDoc) {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo.png');
    if (!fs.existsSync(logoPath)) return null;
    const logoBytes = fs.readFileSync(logoPath);
    const logoImage = await pdfDoc.embedPng(logoBytes);
    const scaled = logoImage.scale(0.18);
    return { image: logoImage, scaled };
  } catch {
    return null;
  }
}

/** Format date in French (dd/mm/yyyy) */
export function formatDateFR(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('fr-FR');
}

/** Draw a standardized lines table.
 * rows: array of { accountNumber, description, quantity, unitPrice, total }
 * opts: { page, font, startY, headerColor }
 * Returns last y position after drawing.
 */
/** Draw lines with automatic pagination. Returns { lastPage, y, pages }. */
export function drawLinesTable(rows, { pdfDoc, page, font, startY = 600, headerColor = rgb(0.1,0.1,0.7), onNewPage }) {
  let currentPage = page;
  let y = startY;
  const pages = [currentPage];

  const drawHeader = () => {
    drawSectionTitle(currentPage, 'Lignes', { x: 40, y, w: 515, font });
    y -= 32;
    drawBox(currentPage, { x: 40, y: y - 5, w: 515, h: 18, fill: rgb(0.97, 0.98, 0.99) });
    currentPage.drawText('Compte', { x: 46, y, size: 9, font });
    currentPage.drawText('Description', { x: 112, y, size: 9, font });
    drawRightText(currentPage, 'Qté', { xRight: 350, y, size: 9, font });
    drawRightText(currentPage, 'PU', { xRight: 430, y, size: 9, font });
    drawRightText(currentPage, 'Total', { xRight: 545, y, size: 9, font });
    y -= 18;
  };

  drawHeader();
  const minY = 80; // bottom margin threshold

  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    if (y < minY) {
      // create new page and continue
      currentPage = pdfDoc.addPage(A4);
      y = 800; // top area for continuation pages
      pages.push(currentPage);
      if (onNewPage) onNewPage(currentPage, pages.length);
      drawHeader();
    }
    drawBox(currentPage, { x: 40, y: y - 4, w: 515, h: 16, border: rgb(0.92, 0.94, 0.96), fill: rgb(1, 1, 1) });
    currentPage.drawText(truncateToWidth(font, r.accountNumber || '', 8, 58), { x: 46, y, size: 8, font });
    currentPage.drawText(truncateToWidth(font, r.description || '', 8, 190), { x: 112, y, size: 8, font });
    drawRightText(currentPage, r.quantity, { xRight: 350, y, size: 8, font });
    drawRightText(currentPage, r.unitPrice, { xRight: 430, y, size: 8, font });
    drawRightText(currentPage, r.total, { xRight: 545, y, size: 8, font });
    y -= 16;
  }
  return { lastPage: currentPage, y, pages };
}

/** Draw recap totals block (HT / TVA / TTC). */
export function drawRecap({ page, font, startY, totalHt, vatRate, vatAmount, totalTtc }) {
  let y = startY - 24;
  page.drawText('Récapitulatif', { x: 300, y, size: 12, font, color: rgb(0.1,0.1,0.7) });
  y -= 14; page.drawText(`Total HT: ${formatAmountPlain(totalHt)} €`, { x: 300, y, size: 10, font });
  y -= 12; page.drawText(`TVA (${formatRatePercent(vatRate*100)}%): ${formatAmountPlain(vatAmount)} €`, { x: 300, y, size: 10, font });
  y -= 12; page.drawText(`Total TTC: ${formatAmountPlain(totalTtc)} €`, { x: 300, y, size: 11, font, color: rgb(0,0.45,0) });
  return y - 10;
}

/** Charge une police TTF locale si disponible, sinon Helvetica standard. */
export async function loadPrimaryFont(pdfDoc) {
  try {
    const fontPath = process.env.PDF_FONT_PATH || path.join(process.cwd(), 'public', 'fonts', 'Inter-Regular.ttf');
    if (fs.existsSync(fontPath)) {
      const bytes = fs.readFileSync(fontPath);
      return await pdfDoc.embedFont(bytes);
    }
  } catch (e) {
    // ignore -> fallback
  }
  return await pdfDoc.embedFont(StandardFonts.Helvetica);
}

/** Calcule un breakdown multi-taux: lines avec (quantity, unitPrice, optional vatRate). */
export function computeVatBreakdown(lines, { defaultRate }) {
  const map = new Map();
  for (const l of lines) {
    const qty = Number(l.quantity || 0);
    const unit = Number(l.unitPrice || 0);
    const base = qty * unit;
    const rate = (l.vatRate !== undefined && l.vatRate !== null) ? Number(l.vatRate) : Number(defaultRate);
    if (!map.has(rate)) map.set(rate, { base: 0, vat: 0 });
    const entry = map.get(rate);
    entry.base += base;
  }
  // compute VAT per rate
  for (const [rate, entry] of map.entries()) {
    entry.vat = Math.round(entry.base * rate * 100) / 100; // arrondi banque
  }
  return [...map.entries()] // [ [rate, { base, vat }], ...]
    .sort((a,b)=> a[0]-b[0]);
}

/** Dessine un récap multi-taux TVA. */
export function drawRecapBreakdown({ page, font, startY, breakdown }) {
  let y = startY - 24;
  drawSectionTitle(page, 'Récapitulatif', { x: 300, y, w: 255, font });
  y -= 28;
  let totalBase = 0; let totalVat = 0;
  for (const [rate, { base, vat }] of breakdown) {
    totalBase += base; totalVat += vat;
    page.drawText(`Base (${formatRatePercent(rate*100)}%)`, { x: 310, y, size: 9, font });
    drawRightText(page, `${formatAmountPlain(base)} €`, { xRight: 545, y, size: 9, font });
    y -= 12;
    page.drawText(`TVA (${formatRatePercent(rate*100)}%)`, { x: 310, y, size: 9, font, color: rgb(0.2,0.2,0.2) });
    drawRightText(page, `${formatAmountPlain(vat)} €`, { xRight: 545, y, size: 9, font, color: rgb(0.2,0.2,0.2) });
    y -= 12;
  }
  const totalTtc = totalBase + totalVat;
  y -= 4;
  page.drawText('Total HT', { x: 310, y, size: 9.5, font }); drawRightText(page, `${formatAmountPlain(totalBase)} €`, { xRight: 545, y, size: 9.5, font }); y -= 12;
  page.drawText('Total TVA', { x: 310, y, size: 9.5, font }); drawRightText(page, `${formatAmountPlain(totalVat)} €`, { xRight: 545, y, size: 9.5, font }); y -= 12;
  page.drawText('Total TTC', { x: 310, y, size: 11, font, color: rgb(0,0.45,0) });
  drawRightText(page, `${formatAmountPlain(totalTtc)} €`, { xRight: 545, y, size: 11, font, color: rgb(0,0.45,0) });
  return y - 10;
}

/** Draw a repeating header on each new page (except maybe first if skipped). */
export function drawPageHeader(page, { font, title, subTitle }) {
  let y = 820;
  if (title) page.drawText(title, { x: 40, y, size: 12, font, color: rgb(0.25,0.25,0.5) });
  if (subTitle) page.drawText(subTitle, { x: 300, y, size: 10, font, color: rgb(0.4,0.4,0.6) });
}

/** Draw footer: page number / static legal text. */
export function drawFooter(page, { font, pageNumber, totalPages, legal }) {
  const y = 40;
  page.drawText(`Page ${pageNumber}/${totalPages}`, { x: 40, y, size: 9, font, color: rgb(0.4,0.4,0.4) });
  if (legal) page.drawText(legal.slice(0,80), { x: 300, y, size: 8, font, color: rgb(0.5,0.5,0.5) });
}

/** Dessine bloc identité société (coin haut droit). */
export function drawCompanyIdentity(page, { font, company }) {
  if (!company) return; // company = { name, address, siret, vat, rccm, idNat, taxNumber, cnss, onem, inpp }
  const startX = 350;
  let y = 820;
  drawBox(page, { x: 340, y: 700, w: 215, h: 135, fill: rgb(0.985, 0.99, 1), border: rgb(0.82, 0.88, 0.94) });
  const line = (txt, size = 9) => { page.drawText(truncateToWidth(font, txt, size, 190), { x: startX, y, size, font, color: rgb(0.15,0.15,0.25) }); y -= 12; };
  if (company.name) line(company.name, 10);
  if (company.address) company.address.split(/\n+/).forEach(a => line(a));
  if (company.siret) line(`SIRET: ${company.siret}`);
  if (company.vat) line(`TVA: ${company.vat}`);
  if (company.rccm) line(`RCCM: ${company.rccm}`);
  if (company.idNat) line(`ID NAT: ${company.idNat}`);
  if (company.taxNumber) line(`N° Impôt: ${company.taxNumber}`);
  if (company.cnss) line(`CNSS: ${company.cnss}`);
  if (company.onem) line(`ONEM: ${company.onem}`);
  if (company.inpp) line(`INPP: ${company.inpp}`);
}

/** Watermark diagonale pour factures brouillon. */
export function drawDraftWatermark(page, { font, text = 'BROUILLON' }) {
  const { width, height } = page.getSize();
  const fontSize = 80;
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const x = (width - textWidth) / 2;
  const y = height / 2 + 30;
  page.drawText(text, {
    x,
    y,
    size: fontSize,
    font,
    rotate: { type: 'degrees', angle: 45 },
    color: rgb(0.85,0.1,0.1),
    opacity: 0.12,
  });
}
