import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function exportAuth(req){
  if(process.env.NODE_ENV !== 'production') return null;
  const adminToken = process.env.ADMIN_TOKEN || process.env.NEXT_PUBLIC_ADMIN_TOKEN;
  if(adminToken && req.headers.get('x-admin-token') !== adminToken){
    return new Response(JSON.stringify({ error:'Unauthorized' }), { status:401, headers:{ 'Content-Type':'application/json' } });
  }
  return null;
}

// GET /api/personnel/summary
// Fournit des métriques RH basiques pour le dashboard (effectif, statuts, mouvements YTD, rémunération moyenne)
export async function GET(req) {
  try {
    const url = new URL(req.url);
    const format = url.searchParams.get('format');
    const yearParam = url.searchParams.get('year');
    const monthParam = url.searchParams.get('month');
    let now = new Date();
    if(yearParam && monthParam){
      const y = parseInt(yearParam,10); const m = parseInt(monthParam,10);
      if(!Number.isNaN(y) && !Number.isNaN(m) && m>=1 && m<=12){
        // use end of specified month
        now = new Date(y, m, 0, 23,59,59,999);
      }
    }
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const yearStart = new Date(year, 0, 1, 0, 0, 0, 0);
    const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const monthEnd = now; // fin du mois sélectionné (ou aujourd'hui si courant)

    // Headcount & status counts
    const [totalEmployees, activeEmployees, statusGroups, hiresYtd, exitsYtd, contractGroups, hiresMonth, exitsMonth, activeAtYearStart, activeAtMonthStart, activeWithHireDates, activeWithBirthDates] = await Promise.all([
      prisma.employee.count(),
      prisma.employee.count({
        where: {
          status: "ACTIVE",
          OR: [
            { endDate: null },
            { endDate: { gt: now } }
          ],
        },
      }),
      prisma.employee.groupBy({ by: ["status"], _count: { status: true } }),
      prisma.employee.count({ where: { hireDate: { gte: yearStart, lte: now } } }),
      prisma.employee.count({ where: { endDate: { gte: yearStart, lte: now } } }),
      prisma.employee.groupBy({ by: ["contractType"], _count: { contractType: true } }),
      prisma.employee.count({ where: { hireDate: { gte: monthStart, lte: monthEnd } } }),
      prisma.employee.count({ where: { endDate: { gte: monthStart, lte: monthEnd } } }),
      prisma.employee.count({ // actifs au début d'année
        where: {
          status: "ACTIVE",
          hireDate: { lte: yearStart },
          OR: [ { endDate: null }, { endDate: { gt: yearStart } } ],
        }
      }),
      prisma.employee.count({ // actifs au début de mois
        where: {
          status: "ACTIVE",
          hireDate: { lte: monthStart },
          OR: [ { endDate: null }, { endDate: { gt: monthStart } } ],
        }
      }),
      prisma.employee.findMany({ // actifs avec date d'embauche pour tenure
        where: {
          status: "ACTIVE",
          hireDate: { not: null, lte: now },
          OR: [ { endDate: null }, { endDate: { gt: now } } ],
        },
        select: { hireDate: true }
      }),
      prisma.employee.findMany({ // actifs avec birthDate pour age
        where: {
          status: "ACTIVE",
          birthDate: { not: null, lte: now },
          OR: [ { endDate: null }, { endDate: { gt: now } } ],
        },
        select: { birthDate: true }
      }),
    ]);

    const statusCounts = { ACTIVE: 0, INACTIVE: 0, SUSPENDED: 0, EXITED: 0 };
    for (const g of statusGroups) {
      statusCounts[g.status] = g._count.status;
    }

    const contractTotals = { CDI: 0, CDD: 0, CI: 0, UNKNOWN: 0 };
    const contractDistribution = contractGroups.map(g => {
      const key = g.contractType ?? "UNKNOWN";
      contractTotals[key] = g._count.contractType;
      return { contractType: key, count: g._count.contractType };
    });

    // Percentages (par rapport au total employés)
    const pct = {};
    const denom = totalEmployees || 1;
    for (const k of Object.keys(contractTotals)) {
      pct[k] = Math.round((contractTotals[k] / denom) * 10000) / 100; // 2 décimales
    }

    // Tenure moyenne (jours & mois) pour actifs avec hireDate
    let averageDays = 0;
    if (activeWithHireDates.length) {
      const totalDays = activeWithHireDates.reduce((acc, e) => {
        const days = Math.floor((now - e.hireDate) / (1000 * 60 * 60 * 24));
        return acc + (days > 0 ? days : 0);
      }, 0);
      averageDays = totalDays / activeWithHireDates.length;
    }
    const averageMonths = Math.round((averageDays / 30) * 100) / 100;

    // Tenure buckets
    const tenureBuckets = { '<6m':0,'6-12m':0,'1-2y':0,'2-5y':0,'5y+':0 };
    activeWithHireDates.forEach(e => {
      const months = (now - e.hireDate) / (1000*60*60*24*30.4375);
      if (months < 6) tenureBuckets['<6m']++; else if (months < 12) tenureBuckets['6-12m']++; else if (months < 24) tenureBuckets['1-2y']++; else if (months < 60) tenureBuckets['2-5y']++; else tenureBuckets['5y+']++;
    });

    // Age calculations
    const agesYears = activeWithBirthDates.map(e => Math.floor((now - e.birthDate) / (1000*60*60*24*365.25))).filter(a => a >= 0);
    let averageAgeYears = 0; let medianAgeYears = 0;
    if (agesYears.length){
      averageAgeYears = agesYears.reduce((a,b)=>a+b,0)/agesYears.length;
      const sorted = [...agesYears].sort((a,b)=>a-b);
      const mid = Math.floor(sorted.length/2);
      medianAgeYears = sorted.length % 2 === 0 ? (sorted[mid-1]+sorted[mid])/2 : sorted[mid];
    }
    averageAgeYears = Math.round(averageAgeYears*100)/100;
    medianAgeYears = Math.round(medianAgeYears*100)/100;
    const ageBuckets = { '<25':0,'25-34':0,'35-44':0,'45-54':0,'55+':0 };
    agesYears.forEach(a => { if (a <25) ageBuckets['<25']++; else if (a<35) ageBuckets['25-34']++; else if (a<45) ageBuckets['35-44']++; else if (a<55) ageBuckets['45-54']++; else ageBuckets['55+']++; });

    // Payslips month & YTD aggregates
    const [monthPayslips, ytdPayslips] = await Promise.all([
      prisma.payslip.findMany({
        where: { period: { month, year } },
        select: { grossAmount: true, netAmount: true },
      }),
      prisma.payslip.findMany({
        where: { period: { year } },
        select: { grossAmount: true, netAmount: true },
      }),
    ]);

    const sumAmounts = (arr, field) => arr.reduce((acc, ps) => acc + (ps[field]?.toNumber?.() ?? 0), 0);
    const totalGrossMonth = sumAmounts(monthPayslips, "grossAmount");
    const totalNetMonth = sumAmounts(monthPayslips, "netAmount");
    const totalGrossYtd = sumAmounts(ytdPayslips, "grossAmount");
    const totalNetYtd = sumAmounts(ytdPayslips, "netAmount");

    const avgGrossMonth = monthPayslips.length ? totalGrossMonth / monthPayslips.length : 0;
    const avgNetMonth = monthPayslips.length ? totalNetMonth / monthPayslips.length : 0;
    const avgGrossYtd = ytdPayslips.length ? totalGrossYtd / ytdPayslips.length : 0;
    const avgNetYtd = ytdPayslips.length ? totalNetYtd / ytdPayslips.length : 0;

    // Turnover calculs (exits / average headcount) * 100
    const activeAtYearEnd = activeEmployees;
    const turnoverYtd = (exitsYtd && (activeAtYearStart + activeAtYearEnd) > 0)
      ? (exitsYtd / ((activeAtYearStart + activeAtYearEnd) / 2)) * 100
      : 0;
    const activeAtMonthEnd = activeEmployees; // approximation (point actuel)
    const turnoverMonth = (exitsMonth && (activeAtMonthStart + activeAtMonthEnd) > 0)
      ? (exitsMonth / ((activeAtMonthStart + activeAtMonthEnd) / 2)) * 100
      : 0;

    const jsonPayload = {
      headcount: {
        total: totalEmployees,
        active: activeEmployees,
        status: statusCounts,
        hiresYtd,
        exitsYtd,
        hiresMonth,
        exitsMonth,
        turnoverMonth: Math.round(turnoverMonth * 100) / 100,
        turnoverYtd: Math.round(turnoverYtd * 100) / 100,
      },
      contracts: {
        distribution: contractDistribution,
        totals: contractTotals,
        percentages: pct,
      },
      compensation: {
        month: {
          totalGross: Math.round(totalGrossMonth * 100) / 100,
          avgGross: Math.round(avgGrossMonth * 100) / 100,
          totalNet: Math.round(totalNetMonth * 100) / 100,
          avgNet: Math.round(avgNetMonth * 100) / 100,
        },
        ytd: {
          totalGross: Math.round(totalGrossYtd * 100) / 100,
          avgGross: Math.round(avgGrossYtd * 100) / 100,
          totalNet: Math.round(totalNetYtd * 100) / 100,
          avgNet: Math.round(avgNetYtd * 100) / 100,
        },
      },
      tenure: {
        averageDays: Math.round(averageDays * 100) / 100,
        averageMonths,
        activeSample: activeWithHireDates.length,
        buckets: tenureBuckets,
      },
      age: {
        averageYears: averageAgeYears,
        medianYears: medianAgeYears,
        activeSample: agesYears.length,
        buckets: ageBuckets,
      },
      meta: { month, year },
    };

    if (format === 'csv') {
      const authResp = exportAuth(req); if(authResp) return authResp;
      const headers = [
        'headcount_total','headcount_active','hires_month','exits_month','hires_ytd','exits_ytd','turnover_month_pct','turnover_ytd_pct',
        'cdi_count','cdd_count','ci_count','unknown_count','cdi_pct','cdd_pct','ci_pct','unknown_pct',
        'avg_tenure_days','avg_tenure_months','tenure_<6m','tenure_6_12m','tenure_1_2y','tenure_2_5y','tenure_5y_plus',
        'avg_age_years','median_age_years','age_<25','age_25_34','age_35_44','age_45_54','age_55_plus',
        'month','year',
        'totalGrossMonth','avgGrossMonth','totalNetMonth','avgNetMonth','totalGrossYtd','avgGrossYtd','totalNetYtd','avgNetYtd'
      ];
      const h = jsonPayload.headcount;
      const c = jsonPayload.contracts;
      const t = jsonPayload.tenure;
      const a = jsonPayload.age;
      const comp = jsonPayload.compensation;
      const row = [
        h.total,h.active,h.hiresMonth,h.exitsMonth,h.hiresYtd,h.exitsYtd,h.turnoverMonth,h.turnoverYtd,
        c.totals.CDI || 0,c.totals.CDD || 0,c.totals.CI || 0,c.totals.UNKNOWN || 0,
        c.percentages.CDI || 0,c.percentages.CDD || 0,c.percentages.CI || 0,c.percentages.UNKNOWN || 0,
        t.averageDays,t.averageMonths,t.buckets['<6m'],t.buckets['6-12m'],t.buckets['1-2y'],t.buckets['2-5y'],t.buckets['5y+'],
        a.averageYears,a.medianYears,a.buckets['<25'],a.buckets['25-34'],a.buckets['35-44'],a.buckets['45-54'],a.buckets['55+'],
        jsonPayload.meta.month,jsonPayload.meta.year,
        comp.month.totalGross,comp.month.avgGross,comp.month.totalNet,comp.month.avgNet,
        comp.ytd.totalGross,comp.ytd.avgGross,comp.ytd.totalNet,comp.ytd.avgNet
      ];
      const csv = [headers.join(','), row.map(v => '"'+String(v).replace(/"/g,'""')+'"').join(',')].join('\n');
      return new Response(csv, { status:200, headers:{ 'Content-Type':'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="personnel_summary_${year}_${month}.csv"` } });
    }
    return NextResponse.json(jsonPayload);
  } catch (e) {
    console.error("GET /api/personnel/summary error", e);
    return NextResponse.json({ error: "Erreur métriques personnel." }, { status: 500 });
  }
}
