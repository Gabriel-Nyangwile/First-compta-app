import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import prisma from '@/lib/prisma';

function exportAuth(req){
  if(process.env.NODE_ENV !== 'production') return null;
  const adminToken = process.env.ADMIN_TOKEN || process.env.NEXT_PUBLIC_ADMIN_TOKEN;
  if(adminToken && req.headers.get('x-admin-token') !== adminToken){
    return new Response(JSON.stringify({ error:'Unauthorized' }), { status:401, headers:{ 'Content-Type':'application/json' } });
  }
  return null;
}

export async function GET(req) {
  const url = new URL(req.url);
  const yearParam = url.searchParams.get('year');
  const monthParam = url.searchParams.get('month');
  const authResp = exportAuth(req); if(authResp) return authResp;
  // Recalcule synthèse (éviter fetch interne)
  let now = new Date();
  if(yearParam && monthParam){
    const y = parseInt(yearParam,10); const m = parseInt(monthParam,10);
    if(!Number.isNaN(y) && !Number.isNaN(m) && m>=1 && m<=12){
      now = new Date(y, m, 0, 23,59,59,999);
    }
  }
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const yearStart = new Date(year,0,1);
  const monthStart = new Date(year, month-1,1);
  const monthEnd = now;
  const [totalEmployees, activeEmployees, statusGroups, contractGroups, hiresMonth, exitsMonth, hiresYtd, exitsYtd, activeWithHireDates, activeWithBirthDates] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where:{ status:'ACTIVE', OR:[{ endDate:null }, { endDate:{ gt: now } }] } }),
    prisma.employee.groupBy({ by:['status'], _count:{ status:true } }),
    prisma.employee.groupBy({ by:['contractType'], _count:{ contractType:true } }),
    prisma.employee.count({ where:{ hireDate:{ gte: monthStart, lte: monthEnd } } }),
    prisma.employee.count({ where:{ endDate:{ gte: monthStart, lte: monthEnd } } }),
    prisma.employee.count({ where:{ hireDate:{ gte: yearStart, lte: now } } }),
    prisma.employee.count({ where:{ endDate:{ gte: yearStart, lte: now } } }),
    prisma.employee.findMany({ where:{ status:'ACTIVE', hireDate:{ not:null, lte: now }, OR:[{ endDate:null }, { endDate:{ gt: now } }] }, select:{ hireDate:true } }),
    prisma.employee.findMany({ where:{ status:'ACTIVE', birthDate:{ not:null, lte: now }, OR:[{ endDate:null }, { endDate:{ gt: now } }] }, select:{ birthDate:true } }),
  ]);
  const statusCounts = { ACTIVE:0, INACTIVE:0, SUSPENDED:0, EXITED:0 };
  statusGroups.forEach(g => statusCounts[g.status] = g._count.status);
  const contractTotals = { CDI:0, CDD:0, CI:0, UNKNOWN:0 };
  contractGroups.forEach(g => contractTotals[g.contractType ?? 'UNKNOWN'] = g._count.contractType);
  const pct = {}; const denom = totalEmployees || 1; Object.keys(contractTotals).forEach(k => pct[k] = Math.round((contractTotals[k]/denom)*10000)/100);
  // Turnover
  const activeAtYearStart = await prisma.employee.count({ where:{ status:'ACTIVE', hireDate:{ lte: yearStart }, OR:[{ endDate:null }, { endDate:{ gt: yearStart } }] } });
  const activeAtMonthStart = await prisma.employee.count({ where:{ status:'ACTIVE', hireDate:{ lte: monthStart }, OR:[{ endDate:null }, { endDate:{ gt: monthStart } }] } });
  const turnoverYtd = exitsYtd && (activeAtYearStart + activeEmployees) ? (exitsYtd / ((activeAtYearStart + activeEmployees)/2))*100 : 0;
  const turnoverMonth = exitsMonth && (activeAtMonthStart + activeEmployees) ? (exitsMonth / ((activeAtMonthStart + activeEmployees)/2))*100 : 0;
  // Tenure buckets
  const tenureBuckets = { '<6m':0,'6-12m':0,'1-2y':0,'2-5y':0,'5y+':0 };
  let totalDays = 0;
  activeWithHireDates.forEach(e => {
    const days = Math.floor((now - e.hireDate)/(1000*60*60*24));
    totalDays += days>0?days:0;
    const months = days/30.4375;
    if (months < 6) tenureBuckets['<6m']++; else if (months < 12) tenureBuckets['6-12m']++; else if (months < 24) tenureBuckets['1-2y']++; else if (months < 60) tenureBuckets['2-5y']++; else tenureBuckets['5y+']++;
  });
  const averageTenureDays = activeWithHireDates.length ? totalDays/activeWithHireDates.length : 0;
  const averageTenureMonths = Math.round((averageTenureDays/30.4375)*100)/100;
  // Age
  const agesYears = activeWithBirthDates.map(e => Math.floor((now - e.birthDate)/(1000*60*60*24*365.25))).filter(a=>a>=0);
  const ageBuckets = { '<25':0,'25-34':0,'35-44':0,'45-54':0,'55+':0 };
  agesYears.forEach(a => { if (a<25) ageBuckets['<25']++; else if (a<35) ageBuckets['25-34']++; else if (a<45) ageBuckets['35-44']++; else if (a<55) ageBuckets['45-54']++; else ageBuckets['55+']++; });
  let avgAge=0, medAge=0; if (agesYears.length){ avgAge = agesYears.reduce((a,b)=>a+b,0)/agesYears.length; const s=[...agesYears].sort((a,b)=>a-b); const mid=Math.floor(s.length/2); medAge = s.length%2? s[mid] : (s[mid-1]+s[mid])/2; }
  avgAge = Math.round(avgAge*100)/100; medAge = Math.round(medAge*100)/100;
  // Compensation quick aggregate (reuse payslips)
  const [monthPayslips, ytdPayslips] = await Promise.all([
    prisma.payslip.findMany({ where:{ period:{ month, year } }, select:{ grossAmount:true, netAmount:true } }),
    prisma.payslip.findMany({ where:{ period:{ year } }, select:{ grossAmount:true, netAmount:true } }),
  ]);
  const sumAmounts = (arr,f) => arr.reduce((acc,p)=> acc + (p[f]?.toNumber?.() ?? 0),0);
  const totalGrossMonth = sumAmounts(monthPayslips,'grossAmount');
  const totalNetMonth = sumAmounts(monthPayslips,'netAmount');
  const totalGrossYtd = sumAmounts(ytdPayslips,'grossAmount');
  const totalNetYtd = sumAmounts(ytdPayslips,'netAmount');
  const avgGrossMonth = monthPayslips.length ? totalGrossMonth/monthPayslips.length : 0;
  const avgNetMonth = monthPayslips.length ? totalNetMonth/monthPayslips.length : 0;
  const avgGrossYtd = ytdPayslips.length ? totalGrossYtd/ytdPayslips.length : 0;
  const avgNetYtd = ytdPayslips.length ? totalNetYtd/ytdPayslips.length : 0;

  // PDF generation
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.addPage([595,842]); // A4 portrait switched
  const margin = 36; let y = 842 - margin;
  const draw = (text,size=10,x=margin)=>{ page.drawText(text,{ x, y, size, font, color: rgb(0,0,0)}); y -= size + 4; };
  draw(`Synthèse Personnel ${year}-${String(month).padStart(2,'0')}`,14);
  draw(`Effectif Total: ${totalEmployees} | Actifs: ${activeEmployees} | Hires Mois: ${hiresMonth} | Exits Mois: ${exitsMonth}`);
  draw(`Hires YTD: ${hiresYtd} | Exits YTD: ${exitsYtd} | Turnover Mois: ${turnoverMonth.toFixed(2)}% | Turnover YTD: ${turnoverYtd.toFixed(2)}%`);
  draw(`Contrats (count / %): CDI ${contractTotals.CDI}/${pct.CDI}% | CDD ${contractTotals.CDD}/${pct.CDD}% | CI ${contractTotals.CI}/${pct.CI}% | N/A ${contractTotals.UNKNOWN}/${pct.UNKNOWN}%`);
  draw(`Tenure Moy: ${averageTenureMonths.toFixed(2)} mois (n=${activeWithHireDates.length}) | Age Moy: ${avgAge} ans (med ${medAge})`);
  draw('Tenure Buckets: <6m '+tenureBuckets['<6m']+' | 6-12m '+tenureBuckets['6-12m']+' | 1-2y '+tenureBuckets['1-2y']+' | 2-5y '+tenureBuckets['2-5y']+' | 5y+ '+tenureBuckets['5y+']);
  draw('Age Buckets: <25 '+ageBuckets['<25']+' | 25-34 '+ageBuckets['25-34']+' | 35-44 '+ageBuckets['35-44']+' | 45-54 '+ageBuckets['45-54']+' | 55+ '+ageBuckets['55+']);
  draw(`Comp Mois Brut ${totalGrossMonth.toFixed(2)} (Avg ${avgGrossMonth.toFixed(2)}) | Net ${totalNetMonth.toFixed(2)} (Avg ${avgNetMonth.toFixed(2)})`);
  draw(`Comp YTD Brut ${totalGrossYtd.toFixed(2)} (Avg ${avgGrossYtd.toFixed(2)}) | Net ${totalNetYtd.toFixed(2)} (Avg ${avgNetYtd.toFixed(2)})`);
  const bytes = await pdfDoc.save();
  return new Response(bytes, { status:200, headers:{ 'Content-Type':'application/pdf', 'Content-Disposition': `attachment; filename="personnel_summary_${year}_${month}.pdf"` } });
}
