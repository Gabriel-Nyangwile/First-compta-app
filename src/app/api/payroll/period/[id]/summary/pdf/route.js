import { featureFlags } from '@/lib/features';
import { aggregatePeriodSummary } from '@/lib/payroll/aggregatePeriod';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { requireCompanyId } from '@/lib/tenant';

const fmt = (value, decimals = 2) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toFixed(decimals) : (0).toFixed(decimals);
};

function truncateToWidth(font, text, size, maxWidth) {
  const value = String(text ?? '').replace(/[\u00a0\u202f]/g, ' ');
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  let out = value;
  while (out.length > 0 && font.widthOfTextAtSize(`${out}...`, size) > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}...`;
}

function drawRightText(page, text, { xRight, y, size, font, color = rgb(0, 0, 0) }) {
  const value = String(text ?? '');
  const width = font.widthOfTextAtSize(value, size);
  page.drawText(value, { x: xRight - width, y, size, font, color });
}

function drawBlock(page, { x, y, width, height, title, font }) {
  page.drawRectangle({
    x,
    y: y - height,
    width,
    height,
    borderColor: rgb(0.78, 0.82, 0.88),
    borderWidth: 0.75,
    color: rgb(0.985, 0.99, 1),
  });
  page.drawText(title, { x: x + 10, y: y - 16, size: 9, font, color: rgb(0.12, 0.2, 0.42) });
}

export async function GET(req, { params }) {
  if (!featureFlags.payroll) return new Response('Payroll disabled', { status:403 });
  const companyId = requireCompanyId(req);
  const { id } = await params;
  if (!id) return new Response('Missing period id', { status:400 });
  const summary = await aggregatePeriodSummary(id, companyId);
  if (!summary) return new Response('Not found', { status:404 });
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = [];
  const pageSize = [842, 595]; // A4 landscape
  let page = pdfDoc.addPage(pageSize);
  pages.push(page);
  const { width, height } = page.getSize();
  const margin = 32;
  const newPage = (title = `Résumé Période Paie ${summary.period.ref}`) => {
    page = pdfDoc.addPage(pageSize);
    pages.push(page);
    page.drawText(title, { x: margin, y: height - margin, size: 12, font, color: rgb(0.1, 0.18, 0.42) });
    page.drawLine({
      start: { x: margin, y: height - margin - 10 },
      end: { x: width - margin, y: height - margin - 10 },
      thickness: 0.7,
      color: rgb(0.78, 0.82, 0.9),
    });
    return height - margin - 30;
  };

  let y = height - margin;
  page.drawText(`Résumé Période Paie ${summary.period.ref}`, { x: margin, y, size: 14, font, color: rgb(0.1, 0.18, 0.42) });
  drawRightText(page, `Statut: ${summary.period.status} | Règlement: ${summary.period.settlementStatus}`, {
    xRight: width - margin,
    y: y + 2,
    size: 9,
    font,
    color: rgb(0.35, 0.38, 0.48),
  });
  y -= 26;
  page.drawText(
    `Devise traitement: ${summary.period.processingCurrency || '-'} | Devise fiscale: ${summary.period.fiscalCurrency || '-'} | Taux fiscal: ${summary.period.fxRate ?? '-'}`,
    { x: margin, y, size: 9, font, color: rgb(0.35, 0.38, 0.48) }
  );
  y -= 18;
  const t = summary.totals;
  const lt = summary.liabilityTotals;

  drawBlock(page, { x: margin, y, width: 250, height: 82, title: 'Totaux salariés', font });
  page.drawText('Brut total', { x: margin + 12, y: y - 34, size: 8.5, font });
  page.drawText('Net total', { x: margin + 12, y: y - 48, size: 8.5, font });
  page.drawText('Réglé', { x: margin + 12, y: y - 62, size: 8.5, font });
  drawRightText(page, fmt(t.grossTotal), { xRight: margin + 238, y: y - 34, size: 8.5, font });
  drawRightText(page, fmt(t.netTotal), { xRight: margin + 238, y: y - 48, size: 8.5, font });
  drawRightText(page, fmt(t.settledTotal), { xRight: margin + 238, y: y - 62, size: 8.5, font });

  drawBlock(page, { x: margin + 270, y, width: 250, height: 82, title: 'Cotisations et impôts', font });
  page.drawText('CNSS sal.', { x: margin + 282, y: y - 34, size: 8.5, font });
  page.drawText('IPR', { x: margin + 282, y: y - 48, size: 8.5, font });
  page.drawText('Charges employeur', { x: margin + 282, y: y - 62, size: 8.5, font });
  drawRightText(page, fmt(t.cnssEmployeeTotal), { xRight: margin + 508, y: y - 34, size: 8.5, font });
  drawRightText(page, fmt(t.iprTaxTotal), { xRight: margin + 508, y: y - 48, size: 8.5, font });
  drawRightText(page, fmt(t.employerChargesTotal), { xRight: margin + 508, y: y - 62, size: 8.5, font });

  drawBlock(page, { x: margin + 540, y, width: 238, height: 82, title: 'Passifs paie', font });
  page.drawText('Total', { x: margin + 552, y: y - 34, size: 8.5, font });
  page.drawText('Réglé', { x: margin + 552, y: y - 48, size: 8.5, font });
  page.drawText('Reste', { x: margin + 552, y: y - 62, size: 8.5, font });
  drawRightText(page, fmt(lt.overallTotal), { xRight: width - margin - 12, y: y - 34, size: 8.5, font });
  drawRightText(page, fmt(lt.settledTotal), { xRight: width - margin - 12, y: y - 48, size: 8.5, font });
  drawRightText(page, fmt(lt.remainingTotal), { xRight: width - margin - 12, y: y - 62, size: 8.5, font });

  y -= 112;
  page.drawText('Passifs par nature', { x: margin, y, size: 11, font, color: rgb(0.1, 0.18, 0.42) });
  y -= 18;
  const drawLiabilityHeader = () => {
    page.drawRectangle({ x: margin, y: y - 4, width: width - 2 * margin, height: 16, color: rgb(0.94, 0.96, 0.99) });
    page.drawText('Libellé', { x: margin + 6, y, size: 8.5, font });
    drawRightText(page, 'Total', { xRight: 520, y, size: 8.5, font });
    drawRightText(page, 'Réglé', { xRight: 610, y, size: 8.5, font });
    drawRightText(page, 'Reste', { xRight: 700, y, size: 8.5, font });
    page.drawText('Statut', { x: 720, y, size: 8.5, font });
    y -= 18;
  };
  drawLiabilityHeader();
  for (const liability of summary.liabilities) {
    if (y < 70) {
      y = newPage('Résumé Période Paie - Passifs');
      drawLiabilityHeader();
    }
    page.drawText(truncateToWidth(font, liability.label, 8, 350), { x: margin + 6, y, size: 8, font });
    drawRightText(page, fmt(liability.total), { xRight: 520, y, size: 8, font });
    drawRightText(page, fmt(liability.settled), { xRight: 610, y, size: 8, font });
    drawRightText(page, fmt(liability.remaining), { xRight: 700, y, size: 8, font });
    page.drawText(truncateToWidth(font, liability.settlementStatus, 8, 90), { x: 720, y, size: 8, font });
    y -= 13;
  }

  y -= 18;
  if (y < 110) y = newPage('Résumé Période Paie - Employés');
  page.drawText('Employés', { x: margin, y, size: 11, font, color: rgb(0.1, 0.18, 0.42) });
  y -= 18;
  const headerCols = ['Ref','Nom','Brut','Net','Réglé','Reste','CNSS Sal','IPR','CNSS Emp','Charges Emp'];
  const cols = [
    { x: margin + 6, width: 55 },
    { x: 95, width: 165 },
    { right: 320 },
    { right: 385 },
    { right: 450 },
    { right: 515 },
    { right: 585 },
    { right: 640 },
    { right: 710 },
    { right: 795 },
  ];
  const drawEmployeeHeader = () => {
    page.drawRectangle({ x: margin, y: y - 4, width: width - 2 * margin, height: 16, color: rgb(0.94, 0.96, 0.99) });
    page.drawText(headerCols[0], { x: cols[0].x, y, size: 8.5, font });
    page.drawText(headerCols[1], { x: cols[1].x, y, size: 8.5, font });
    for (let i = 2; i < headerCols.length; i += 1) {
      drawRightText(page, headerCols[i], { xRight: cols[i].right, y, size: 8.5, font });
    }
    y -= 18;
  };
  drawEmployeeHeader();
  for (const e of summary.employees) {
    if (y < 60) {
      y = newPage('Résumé Période Paie - Employés');
      drawEmployeeHeader();
    }
    page.drawText(truncateToWidth(font, e.ref, 8, cols[0].width), { x: cols[0].x, y, size: 8, font });
    page.drawText(truncateToWidth(font, e.employeeName, 8, cols[1].width), { x: cols[1].x, y, size: 8, font });
    const row = [e.gross, e.net, e.settledAmount, e.remainingAmount, e.cnssEmployee, e.iprTax, e.cnssEmployer, e.employerCharges];
    row.forEach((value, index) => {
      drawRightText(page, fmt(value, 0), { xRight: cols[index + 2].right, y, size: 8, font });
    });
    y -= 12;
  }
  pages.forEach((p, index) => {
    p.drawText(`Page ${index + 1}/${pages.length}`, {
      x: margin,
      y: 24,
      size: 8,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });
  });
  const bytes = await pdfDoc.save();
  return new Response(bytes, { status:200, headers:{ 'Content-Type':'application/pdf', 'Content-Disposition': `attachment; filename="period_summary_${summary.period.ref}.pdf"` } });
}
