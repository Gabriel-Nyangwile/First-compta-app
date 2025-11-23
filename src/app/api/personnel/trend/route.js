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

// GET /api/personnel/trend
// Retourne les 6 derniers mois (incluant courant) avec actifs fin de mois, embauches et sorties.
export async function GET(req) {
  try {
    const url = new URL(req.url);
    const format = url.searchParams.get('format');
    const monthsParam = parseInt(url.searchParams.get('months') || '6', 10);
    const monthsWindow = Number.isNaN(monthsParam) ? 6 : Math.min(Math.max(monthsParam,1),24);
    const now = new Date();
    const months = [];
    for (let i = monthsWindow-1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1, 0, 0, 0, 0);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }

    const results = [];
    for (const m of months) {
      const monthStart = new Date(m.year, m.month - 1, 1, 0, 0, 0, 0);
      const monthEnd = new Date(m.year, m.month, 0, 23, 59, 59, 999); // dernier jour du mois
      const [activeStart, activeEnd, hires, exits] = await Promise.all([
        prisma.employee.count({
          where:{ status:'ACTIVE', hireDate:{ lte: monthStart }, OR:[ { endDate:null }, { endDate:{ gt: monthStart } } ] }
        }),
        prisma.employee.count({
          where: {
            status: "ACTIVE",
            hireDate: { lte: monthEnd },
            OR: [ { endDate: null }, { endDate: { gt: monthEnd } } ],
          }
        }),
        prisma.employee.count({ where: { hireDate: { gte: monthStart, lte: monthEnd } } }),
        prisma.employee.count({ where: { endDate: { gte: monthStart, lte: monthEnd } } }),
      ]);
      const avgHeadcount = (activeStart + activeEnd)/2;
      const hiresRatePct = avgHeadcount ? (hires / avgHeadcount)*100 : 0;
      const exitTurnoverPct = avgHeadcount ? (exits / avgHeadcount)*100 : 0;
      results.push({ ...m, activeStart, activeEnd, avgHeadcount, hires, exits, hiresRatePct: Math.round(hiresRatePct*100)/100, exitTurnoverPct: Math.round(exitTurnoverPct*100)/100 });
    }

    if (format === 'csv') {
      const authResp = exportAuth(req);
      if(authResp) return authResp;
      const headers = ['year','month','activeStart','activeEnd','avgHeadcount','hires','exits','hiresRatePct','exitTurnoverPct'];
      const rows = results.map(r => headers.map(h => r[h]));
      const csvRows = [headers.join(','), ...rows.map(row => row.map(v => '"'+String(v).replace(/"/g,'""')+'"').join(','))];
      const csv = csvRows.join('\n');
      return new Response(csv, { status:200, headers:{ 'Content-Type':'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="personnel_trend_last6.csv"' } });
    }
    return NextResponse.json({ months: results, window: monthsWindow });
  } catch (e) {
    console.error("GET /api/personnel/trend error", e);
    return NextResponse.json({ error: "Erreur trend personnel." }, { status: 500 });
  }
}
