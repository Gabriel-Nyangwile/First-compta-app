import prisma from '@/lib/prisma';
import { featureFlags } from '@/lib/features';
import { calculatePayslipForEmployee } from '@/lib/payroll/engine';
import { sanitizePlain } from '@/lib/sanitizePlain';

export async function GET(_req, { params }) {
  if (!featureFlags.payroll) return new Response(JSON.stringify({ ok:false, error:'Payroll disabled'}), { status:403 });
  const { id } = await params;
  if (!id) return new Response(JSON.stringify({ ok:false, error:'Missing period id'}), { status:400 });
  const period = await prisma.payrollPeriod.findUnique({ where:{ id } });
  if (!period) return new Response(JSON.stringify({ ok:false, error:'Period not found'}), { status:404 });
  if (period.status !== 'OPEN') return new Response(JSON.stringify({ ok:false, error:'Period must be OPEN for preview'}), { status:409 });
  const employees = await prisma.employee.findMany({ where:{ status:'ACTIVE' }, include:{ position:{ include:{ bareme:true } } } });
  const results = [];
  for (const e of employees) {
    const calc = await calculatePayslipForEmployee(e, period);
    const cnssEmpLine = calc.lines.find(l => l.code === 'CNSS_EMP');
    const iprLine = calc.lines.find(l => l.code === 'IPR');
    const cnssErLine = calc.lines.find(l => l.code === 'CNSS_ER');
    const onemLine = calc.lines.find(l => l.code === 'ONEM');
    const inppLine = calc.lines.find(l => l.code === 'INPP');
    const overtimeLine = calc.lines.find(l => l.code === 'OT');
    // Aggregated numeric details (positive values for deductions)
    const cnssEmployee = Math.abs(cnssEmpLine?.amount ?? 0);
    const iprTax = Math.abs(iprLine?.amount ?? 0);
    const riBase = iprLine?.baseAmount ?? null;
    const riCDF = iprLine?.meta?.riCDF ?? null;
    const fxRate = iprLine?.meta?.fxRate ?? null;
    const cnssEmployer = Math.abs(cnssErLine?.amount ?? 0);
    const onem = Math.abs(onemLine?.amount ?? 0);
    const inpp = Math.abs(inppLine?.amount ?? 0);
    const overtime = overtimeLine?.amount ?? 0;
    results.push(sanitizePlain({
      employeeId: e.id,
      employeeName: `${e.firstName} ${e.lastName}`.trim(),
      gross: calc.grossAmount,
      net: calc.netAmount,
      employerCharges: calc.employerChargesTotal,
      cnssEmployee,
      iprTax,
      riBase,
      riCDF,
      fxRate,
      cnssEmployer,
      onem,
      inpp,
      overtime,
      lines: calc.lines,
    }));
  }
  return Response.json({ ok:true, count: results.length, period: { id: period.id, ref: period.ref, month: period.month, year: period.year }, results });
}
