import { featureFlags } from '@/lib/features';
import { aggregatePeriodSummary } from '@/lib/payroll/aggregatePeriod';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { requireCompanyId } from '@/lib/tenant';

export async function GET(req, { params }) {
  if (!featureFlags.payroll) return new Response('Payroll disabled', { status:403 });
  const companyId = requireCompanyId(req);
  const { id } = await params;
  if (!id) return new Response('Missing period id', { status:400 });
  const summary = await aggregatePeriodSummary(id, companyId);
  if (!summary) return new Response('Not found', { status:404 });
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.addPage([842, 595]); // A4 landscape
  const { width, height } = page.getSize();
  const margin = 32;
  let y = height - margin;
  const drawText = (text, size=10, x=margin) => { page.drawText(text, { x, y, size, font, color: rgb(0,0,0) }); y -= size + 4; };
  drawText(`Résumé Période Paie: ${summary.period.ref} (Statut: ${summary.period.status} | Règlement: ${summary.period.settlementStatus})`, 14);
  const t = summary.totals;
  const lt = summary.liabilityTotals;
  drawText(`Brut Total: ${t.grossTotal.toFixed(2)} | Net Total: ${t.netTotal.toFixed(2)} | Réglé: ${t.settledTotal.toFixed(2)} | Reste: ${t.remainingTotal.toFixed(2)}`);
  drawText(`CNSS Sal: ${t.cnssEmployeeTotal.toFixed(2)} | IPR: ${t.iprTaxTotal.toFixed(2)}`);
  drawText(`CNSS Emp: ${t.cnssEmployerTotal.toFixed(2)} | ONEM: ${t.onemTotal.toFixed(2)} | INPP: ${t.inppTotal.toFixed(2)} | Charges Emp: ${t.employerChargesTotal.toFixed(2)} | HS: ${t.overtimeTotal.toFixed(2)}`);
  drawText(`Passifs paie: Total ${lt.overallTotal.toFixed(2)} | Réglé ${lt.settledTotal.toFixed(2)} | Reste ${lt.remainingTotal.toFixed(2)}`);
  y -= 6;
  drawText('Passifs par nature:', 12);
  for (const liability of summary.liabilities) {
    drawText(
      `${liability.label}: total ${liability.total.toFixed(2)} | réglé ${liability.settled.toFixed(2)} | reste ${liability.remaining.toFixed(2)} | statut ${liability.settlementStatus}`,
      9
    );
  }
  y -= 6;
  drawText('Employés:', 12);
  const headerCols = ['Ref','Nom','Brut','Net','Réglé','Reste','CNSS Sal','IPR','CNSS Emp','Charges Emp'];
  const colWidths = [60,140,50,50,55,55,55,45,55,65];
  const startX = margin;
  let rowY = y;
  // Header
  let x = startX;
  for (let i=0;i<headerCols.length;i++) { page.drawText(headerCols[i], { x, y: rowY, size:9, font }); x += colWidths[i]; }
  rowY -= 14;
  for (const e of summary.employees) {
    x = startX;
    const row = [e.ref, e.employeeName.slice(0,28), e.gross.toFixed(0), e.net.toFixed(0), e.settledAmount.toFixed(0), e.remainingAmount.toFixed(0), e.cnssEmployee.toFixed(0), e.iprTax.toFixed(0), e.cnssEmployer.toFixed(0), e.employerCharges.toFixed(0)];
    for (let i=0;i<row.length;i++) { page.drawText(row[i], { x, y: rowY, size:8, font }); x += colWidths[i]; }
    rowY -= 12;
    if (rowY < 60) { // new page
      y = height - margin;
      const p2 = pdfDoc.addPage([842,595]);
      rowY = 595 - margin - 20; // reset for new page
    }
  }
  const bytes = await pdfDoc.save();
  return new Response(bytes, { status:200, headers:{ 'Content-Type':'application/pdf', 'Content-Disposition': `attachment; filename="period_summary_${summary.period.ref}.pdf"` } });
}
