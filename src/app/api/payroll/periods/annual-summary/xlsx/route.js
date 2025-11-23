import { featureFlags } from '@/lib/features';
import { aggregateAnnualPayroll } from '@/lib/payroll/aggregateAnnual';
import ExcelJS from 'exceljs';

export async function GET(req) {
  if (!featureFlags.payroll) return new Response('Payroll disabled', { status:403 });
  const url = new URL(req.url);
  const yearParam = url.searchParams.get('year');
  const year = yearParam ? Number(yearParam) : new Date().getFullYear();
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return new Response('Invalid year', { status:400 });
  const annual = await aggregateAnnualPayroll(year);
  const wb = new ExcelJS.Workbook();
  const meta = wb.addWorksheet('Résumé');
  meta.columns = [ { header:'Clé', key:'k', width:28 }, { header:'Valeur', key:'v', width:22 } ];
  const totals = annual.months.reduce((acc, m) => { acc.gross += m.grossTotal; acc.net += m.netTotal; acc.cnssEmp += m.cnssEmployerTotal; acc.cnssSal += m.cnssEmployeeTotal; acc.ipr += m.iprTaxTotal; acc.onem += m.onemTotal; acc.inpp += m.inppTotal; acc.charges += m.employerChargesTotal; acc.ot += m.overtimeTotal; return acc; }, { gross:0, net:0, cnssEmp:0, cnssSal:0, ipr:0, onem:0, inpp:0, charges:0, ot:0 });
  meta.addRows([
    ['Année', year],
    ['Brut Total (incl corrections)', totals.gross],
    ['Corrections Brut Négatives', totals.corrGross],
    ['Net Total (incl corrections)', totals.net],
    ['Corrections Net Négatives', totals.corrNet],
    ['CNSS Salarié Total', totals.cnssSal],
    ['IPR Total', totals.ipr],
    ['CNSS Employeur Total', totals.cnssEmp],
    ['ONEM Total', totals.onem],
    ['INPP Total', totals.inpp],
    ['Charges Employeur Totales', totals.charges],
    ['Heures Suppl Totales', totals.ot],
    ['Mois Inclus', annual.months.length],
  ].map(([k,v]) => ({ k, v })));
  const ws = wb.addWorksheet('Mois');
  ws.columns = [
    { header:'Mois', key:'month', width:8 },
    { header:'Brut', key:'grossTotal', width:12 },
    { header:'Corr Brut', key:'grossNegative', width:12 },
    { header:'Net', key:'netTotal', width:12 },
    { header:'Corr Net', key:'netNegative', width:12 },
    { header:'CNSS Sal', key:'cnssEmployeeTotal', width:14 },
    { header:'IPR', key:'iprTaxTotal', width:12 },
    { header:'CNSS Emp', key:'cnssEmployerTotal', width:14 },
    { header:'ONEM', key:'onemTotal', width:12 },
    { header:'INPP', key:'inppTotal', width:12 },
    { header:'Charges Emp', key:'employerChargesTotal', width:16 },
    { header:'HS', key:'overtimeTotal', width:10 },
    { header:'Cumul Brut', key:'ytdGross', width:14 },
    { header:'Cumul Net', key:'ytdNet', width:14 },
    { header:'YTD Corr Brut', key:'ytdCorrectionsGross', width:14 },
    { header:'YTD Corr Net', key:'ytdCorrectionsNet', width:14 },
  ];
  for (const m of annual.months) ws.addRow(m);
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, { status:200, headers:{ 'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="annual_payroll_${year}.xlsx"` } });
}
