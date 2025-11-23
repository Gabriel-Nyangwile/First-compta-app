import ExcelJS from 'exceljs';
import prisma from '@/lib/prisma';

function exportAuth(req){
  if(process.env.NODE_ENV !== 'production') return null;
  const adminToken = process.env.ADMIN_TOKEN || process.env.NEXT_PUBLIC_ADMIN_TOKEN;
  if(adminToken && req.headers.get('x-admin-token') !== adminToken){
    return new Response(JSON.stringify({ error:'Unauthorized' }), { status:401, headers:{ 'Content-Type':'application/json' } });
  }
  return null;
}

export async function GET(req){
  const url = new URL(req.url);
  const yearParam = url.searchParams.get('year');
  const monthParam = url.searchParams.get('month');
  const authResp = exportAuth(req); if(authResp) return authResp;
  let now = new Date();
  if(yearParam && monthParam){
    const y = parseInt(yearParam,10); const m = parseInt(monthParam,10);
    if(!Number.isNaN(y) && !Number.isNaN(m) && m>=1 && m<=12){
      now = new Date(y, m, 0, 23,59,59,999);
    }
  }
  const month = now.getMonth()+1; const year = now.getFullYear();
  const yearStart = new Date(year,0,1); const monthStart = new Date(year,month-1,1); const monthEnd = now;
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
  const statusCounts={ ACTIVE:0, INACTIVE:0, SUSPENDED:0, EXITED:0 }; statusGroups.forEach(g=> statusCounts[g.status]=g._count.status);
  const contractTotals={ CDI:0, CDD:0, CI:0, UNKNOWN:0 }; contractGroups.forEach(g=> contractTotals[g.contractType ?? 'UNKNOWN']=g._count.contractType);
  const pct={}; const denom= totalEmployees||1; Object.keys(contractTotals).forEach(k=> pct[k] = Math.round((contractTotals[k]/denom)*10000)/100);
  const activeAtYearStart = await prisma.employee.count({ where:{ status:'ACTIVE', hireDate:{ lte: yearStart }, OR:[{ endDate:null }, { endDate:{ gt: yearStart } }] } });
  const activeAtMonthStart = await prisma.employee.count({ where:{ status:'ACTIVE', hireDate:{ lte: monthStart }, OR:[{ endDate:null }, { endDate:{ gt: monthStart } }] } });
  const turnoverYtd = exitsYtd && (activeAtYearStart + activeEmployees) ? (exitsYtd / ((activeAtYearStart + activeEmployees)/2))*100 : 0;
  const turnoverMonth = exitsMonth && (activeAtMonthStart + activeEmployees) ? (exitsMonth / ((activeAtMonthStart + activeEmployees)/2))*100 : 0;
  // Tenure & Age
  const tenureBuckets = { '<6m':0,'6-12m':0,'1-2y':0,'2-5y':0,'5y+':0 }; let totalDays=0;
  activeWithHireDates.forEach(e=>{ const days=Math.floor((now - e.hireDate)/(1000*60*60*24)); totalDays+=days>0?days:0; const months=days/30.4375; if(months<6) tenureBuckets['<6m']++; else if(months<12) tenureBuckets['6-12m']++; else if(months<24) tenureBuckets['1-2y']++; else if(months<60) tenureBuckets['2-5y']++; else tenureBuckets['5y+']++; });
  const avgTenureDays = activeWithHireDates.length ? totalDays/activeWithHireDates.length : 0;
  const avgTenureMonths = Math.round((avgTenureDays/30.4375)*100)/100;
  const agesYears = activeWithBirthDates.map(e=> Math.floor((now - e.birthDate)/(1000*60*60*24*365.25))).filter(a=>a>=0);
  const ageBuckets={'<25':0,'25-34':0,'35-44':0,'45-54':0,'55+':0}; agesYears.forEach(a=>{ if(a<25) ageBuckets['<25']++; else if(a<35) ageBuckets['25-34']++; else if(a<45) ageBuckets['35-44']++; else if(a<55) ageBuckets['45-54']++; else ageBuckets['55+']++; });
  let avgAge=0, medAge=0; if(agesYears.length){ avgAge=agesYears.reduce((a,b)=>a+b,0)/agesYears.length; const s=[...agesYears].sort((a,b)=>a-b); const mid=Math.floor(s.length/2); medAge= s.length%2? s[mid] : (s[mid-1]+s[mid])/2; }
  avgAge = Math.round(avgAge*100)/100; medAge = Math.round(medAge*100)/100;
  // Compensation
  const [monthPayslips, ytdPayslips] = await Promise.all([
    prisma.payslip.findMany({ where:{ period:{ month, year } }, select:{ grossAmount:true, netAmount:true } }),
    prisma.payslip.findMany({ where:{ period:{ year } }, select:{ grossAmount:true, netAmount:true } }),
  ]);
  const sum=(arr,f)=> arr.reduce((acc,p)=> acc + (p[f]?.toNumber?.() ?? 0),0);
  const totalGrossMonth=sum(monthPayslips,'grossAmount'); const totalNetMonth=sum(monthPayslips,'netAmount');
  const totalGrossYtd=sum(ytdPayslips,'grossAmount'); const totalNetYtd=sum(ytdPayslips,'netAmount');
  const avgGrossMonth = monthPayslips.length? totalGrossMonth/monthPayslips.length:0;
  const avgNetMonth = monthPayslips.length? totalNetMonth/monthPayslips.length:0;
  const avgGrossYtd = ytdPayslips.length? totalGrossYtd/ytdPayslips.length:0;
  const avgNetYtd = ytdPayslips.length? totalNetYtd/ytdPayslips.length:0;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Synthèse');
  ws.columns = [ { header:'Clé', key:'k', width:30 }, { header:'Valeur', key:'v', width:22 } ];
  ws.addRows([
    ['Période', `${year}-${String(month).padStart(2,'0')}`],
    ['Effectif Total', totalEmployees],
    ['Actifs', activeEmployees],
    ['Embauches Mois', hiresMonth],
    ['Sorties Mois', exitsMonth],
    ['Embauches YTD', hiresYtd],
    ['Sorties YTD', exitsYtd],
    ['Turnover Mois %', Math.round(turnoverMonth*100)/100],
    ['Turnover YTD %', Math.round(turnoverYtd*100)/100],
    ['Tenure Moy (mois)', avgTenureMonths],
    ['Age Moy (ans)', avgAge],
    ['Age Médiane (ans)', medAge],
    ['Brut Mois Total', totalGrossMonth],
    ['Brut Mois Avg', avgGrossMonth],
    ['Net Mois Total', totalNetMonth],
    ['Net Mois Avg', avgNetMonth],
    ['Brut YTD Total', totalGrossYtd],
    ['Brut YTD Avg', avgGrossYtd],
    ['Net YTD Total', totalNetYtd],
    ['Net YTD Avg', avgNetYtd],
  ].map(([k,v])=>({ k,v })));

  const wsContracts = wb.addWorksheet('Contrats');
  wsContracts.columns = [ { header:'Type', key:'type', width:14 }, { header:'Count', key:'count', width:10 }, { header:'%', key:'pct', width:8 } ];
  Object.keys(contractTotals).forEach(k=> wsContracts.addRow({ type:k, count:contractTotals[k], pct:pct[k] }));

  const wsTenure = wb.addWorksheet('Tenure');
  wsTenure.columns = [ { header:'Bucket', key:'b', width:12 }, { header:'Count', key:'c', width:10 } ];
  Object.keys(tenureBuckets).forEach(b=> wsTenure.addRow({ b, c: tenureBuckets[b] }));

  const wsAge = wb.addWorksheet('Age');
  wsAge.columns = [ { header:'Tranche', key:'t', width:12 }, { header:'Count', key:'c', width:10 } ];
  Object.keys(ageBuckets).forEach(b=> wsAge.addRow({ t:b, c: ageBuckets[b] }));

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf,{ status:200, headers:{ 'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="personnel_summary_${year}_${month}.xlsx"` } });
}
