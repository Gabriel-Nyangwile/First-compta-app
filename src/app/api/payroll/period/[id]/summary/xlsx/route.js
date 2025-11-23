import { featureFlags } from '@/lib/features';
import { aggregatePeriodSummary } from '@/lib/payroll/aggregatePeriod';
import ExcelJS from 'exceljs';

export async function GET(_req, { params }) {
  if (!featureFlags.payroll) return new Response('Payroll disabled', { status:403 });
  const { id } = await params;
  if (!id) return new Response('Missing period id', { status:400 });
  const summary = await aggregatePeriodSummary(id);
  if (!summary) return new Response('Not found', { status:404 });
  const wb = new ExcelJS.Workbook();
  const meta = wb.addWorksheet('Résumé');
  meta.columns = [ { header:'Clé', key:'k', width:28 }, { header:'Valeur', key:'v', width:22 } ];
  const t = summary.totals;
  meta.addRows([
    ['Période', summary.period.ref],
    ['Statut', summary.period.status],
    ['Brut Total', t.grossTotal],
    ['Net Total', t.netTotal],
    ['CNSS Salarié Total', t.cnssEmployeeTotal],
    ['IPR Total', t.iprTaxTotal],
    ['CNSS Employeur Total', t.cnssEmployerTotal],
    ['ONEM Total', t.onemTotal],
    ['INPP Total', t.inppTotal],
    ['Charges Employeur Totales', t.employerChargesTotal],
    ['Heures Suppl Totales', t.overtimeTotal],
    ['Bulletins', t.payslipCount],
  ].map(([k,v]) => ({ k, v })));
  const ws = wb.addWorksheet('Employés');
  ws.columns = [
    { header:'Ref', key:'ref', width:14 },
    { header:'Employé', key:'employeeName', width:30 },
    { header:'Brut', key:'gross', width:10 },
    { header:'Net', key:'net', width:10 },
    { header:'CNSS Sal', key:'cnssEmployee', width:12 },
    { header:'IPR', key:'iprTax', width:10 },
    { header:'CNSS Emp', key:'cnssEmployer', width:12 },
    { header:'ONEM', key:'onem', width:10 },
    { header:'INPP', key:'inpp', width:10 },
    { header:'Charges Emp', key:'employerCharges', width:14 },
    { header:'HS', key:'overtime', width:8 },
    { header:'Lignes', key:'linesCount', width:8 },
  ];
  for (const e of summary.employees) ws.addRow(e);
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, { status:200, headers:{ 'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="period_summary_${summary.period.ref}.xlsx"` } });
}
