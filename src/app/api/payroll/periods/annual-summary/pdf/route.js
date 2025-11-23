import { featureFlags } from '@/lib/features';
import { aggregateAnnualPayroll } from '@/lib/payroll/aggregateAnnual';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function GET(req) {
  if (!featureFlags.payroll) return new Response('Payroll disabled', { status:403 });
  const url = new URL(req.url);
  const yearParam = url.searchParams.get('year');
  const year = yearParam ? Number(yearParam) : new Date().getFullYear();
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return new Response('Invalid year', { status:400 });
  const annual = await aggregateAnnualPayroll(year);
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.addPage([842, 595]); // A4 landscape
  const { width, height } = page.getSize();
  const margin = 32;
  let y = height - margin;
  const draw = (text, size=10, x=margin) => { page.drawText(text, { x, y, size, font, color: rgb(0,0,0) }); y -= size + 4; };
  draw(`Résumé Annuel Paie: ${year}`, 14);
  const totals = annual.months.reduce((acc, m) => {
    acc.gross += m.grossTotal; acc.net += m.netTotal; acc.cnssEmp += m.cnssEmployerTotal; acc.cnssSal += m.cnssEmployeeTotal; acc.ipr += m.iprTaxTotal; acc.onem += m.onemTotal; acc.inpp += m.inppTotal; acc.charges += m.employerChargesTotal; acc.ot += m.overtimeTotal; acc.corrGross += m.grossNegative; acc.corrNet += m.netNegative; return acc; }, { gross:0, net:0, cnssEmp:0, cnssSal:0, ipr:0, onem:0, inpp:0, charges:0, ot:0, corrGross:0, corrNet:0 });
  draw(`Brut: ${totals.gross.toFixed(2)} (Corr-${totals.corrGross.toFixed(2)}) | Net: ${totals.net.toFixed(2)} (Corr-${totals.corrNet.toFixed(2)}) | CNSS Sal: ${totals.cnssSal.toFixed(2)} | IPR: ${totals.ipr.toFixed(2)}`);
  draw(`CNSS Emp: ${totals.cnssEmp.toFixed(2)} | ONEM: ${totals.onem.toFixed(2)} | INPP: ${totals.inpp.toFixed(2)} | Charges Emp: ${totals.charges.toFixed(2)} | HS: ${totals.ot.toFixed(2)}`);
  y -= 2;
  draw('Mois:', 12);
  const header = ['Mois','Brut','CorrBrut','Net','CorrNet','CNSS Sal','IPR','CNSS Emp','ONEM','INPP','Charges Emp','HS','Cumul Brut','Cumul Net','YTD Corr Brut','YTD Corr Net'];
  const colWidths = [40,55,50,55,50,65,50,65,50,50,75,50,70,70,70,70];
  let x = margin;
  const startY = y;
  for (let i=0;i<header.length;i++) { page.drawText(header[i], { x, y:startY, size:9, font }); x += colWidths[i]; }
  let rowY = startY - 14;
  for (const m of annual.months) {
    x = margin;
    const row = [m.month, m.grossTotal.toFixed(0), m.grossNegative.toFixed(0), m.netTotal.toFixed(0), m.netNegative.toFixed(0), m.cnssEmployeeTotal.toFixed(0), m.iprTaxTotal.toFixed(0), m.cnssEmployerTotal.toFixed(0), m.onemTotal.toFixed(0), m.inppTotal.toFixed(0), m.employerChargesTotal.toFixed(0), m.overtimeTotal.toFixed(0), m.ytdGross.toFixed(0), m.ytdNet.toFixed(0), m.ytdCorrectionsGross.toFixed(0), m.ytdCorrectionsNet.toFixed(0)];
    for (let i=0;i<row.length;i++) { page.drawText(String(row[i]), { x, y:rowY, size:8, font }); x += colWidths[i]; }
    rowY -= 12;
    if (rowY < 60) { // new page
      const newPage = pdfDoc.addPage([842,595]);
      y = 595 - margin;
      x = margin;
      rowY = 595 - margin - 20;
    }
  }
  const bytes = await pdfDoc.save();
  return new Response(bytes, { status:200, headers:{ 'Content-Type':'application/pdf', 'Content-Disposition': `attachment; filename="annual_payroll_${year}.pdf"` } });
}
