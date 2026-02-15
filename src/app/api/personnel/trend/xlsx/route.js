import prisma from '@/lib/prisma';
import Excel from 'exceljs';
import { requireCompanyId } from '@/lib/tenant';

function exportAuth(req){
  if(process.env.NODE_ENV !== 'production') return null;
  const adminToken = process.env.ADMIN_TOKEN || process.env.NEXT_PUBLIC_ADMIN_TOKEN;
  if(adminToken && req.headers.get('x-admin-token') !== adminToken){
    return new Response(JSON.stringify({ error:'Unauthorized' }), { status:401, headers:{ 'Content-Type':'application/json' } });
  }
  return null;
}

export async function GET(req){
  try {
    const companyId = requireCompanyId(req);
    const url = new URL(req.url);
    const monthsParam = parseInt(url.searchParams.get('months') || '6',10);
    const monthsWindow = Number.isNaN(monthsParam)?6:Math.min(Math.max(monthsParam,1),24);
    const now = new Date();
    const months = [];
    for (let i=monthsWindow-1;i>=0;i--){
      const d = new Date(now.getFullYear(), now.getMonth()-i,1,0,0,0,0);
      months.push({ year:d.getFullYear(), month:d.getMonth()+1 });
    }
    const rows = [];
    for (const m of months){
      const monthStart = new Date(m.year, m.month-1,1,0,0,0,0);
      const monthEnd = new Date(m.year, m.month,0,23,59,59,999);
      const [activeStart, activeEnd, hires, exits] = await Promise.all([
        prisma.employee.count({ where:{ companyId, status:'ACTIVE', hireDate:{ lte: monthStart }, OR:[{ endDate:null }, { endDate:{ gt: monthStart } }] } }),
        prisma.employee.count({ where:{ companyId, status:'ACTIVE', hireDate:{ lte: monthEnd }, OR:[{ endDate:null }, { endDate:{ gt: monthEnd } }] } }),
        prisma.employee.count({ where:{ companyId, hireDate:{ gte: monthStart, lte: monthEnd } } }),
        prisma.employee.count({ where:{ companyId, endDate:{ gte: monthStart, lte: monthEnd } } }),
      ]);
      const avgHeadcount = (activeStart + activeEnd)/2;
      const hiresRatePct = avgHeadcount ? (hires/avgHeadcount)*100 : 0;
      const exitTurnoverPct = avgHeadcount ? (exits/avgHeadcount)*100 : 0;
      rows.push({ ...m, activeStart, activeEnd, avgHeadcount, hires, exits, hiresRatePct: Math.round(hiresRatePct*100)/100, exitTurnoverPct: Math.round(exitTurnoverPct*100)/100 });
    }
    const authResp = exportAuth(req); if(authResp) return authResp;
    const wb = new Excel.Workbook();
    const ws = wb.addWorksheet('Trend');
    ws.columns = [
      { header:'Year', key:'year', width:8 },
      { header:'Month', key:'month', width:8 },
      { header:'ActiveStart', key:'activeStart', width:12 },
      { header:'ActiveEnd', key:'activeEnd', width:12 },
      { header:'AvgHeadcount', key:'avgHeadcount', width:14 },
      { header:'Hires', key:'hires', width:8 },
      { header:'Exits', key:'exits', width:8 },
      { header:'HiresRatePct', key:'hiresRatePct', width:12 },
      { header:'ExitTurnoverPct', key:'exitTurnoverPct', width:14 },
    ];
    rows.forEach(r=> ws.addRow(r));
    const buf = await wb.xlsx.writeBuffer();
    return new Response(buf, { status:200, headers:{ 'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition':'attachment; filename="personnel_trend_last6.xlsx"' } });
  } catch(e){
    console.error('GET /api/personnel/trend/xlsx error', e);
    return new Response('Erreur generation XLSX trend personnel', { status:500 });
  }
}
