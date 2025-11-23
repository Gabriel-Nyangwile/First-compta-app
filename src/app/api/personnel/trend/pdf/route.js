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

export async function GET(req){
  const url = new URL(req.url);
  const monthsParam = parseInt(url.searchParams.get('months')||'6',10);
  const monthsWindow = Number.isNaN(monthsParam)?6:Math.min(Math.max(monthsParam,1),24);
  const authResp = exportAuth(req); if(authResp) return authResp;
  const now = new Date();
  const months = [];
  for (let i=monthsWindow-1;i>=0;i--){ const d=new Date(now.getFullYear(), now.getMonth()-i,1); months.push({ year:d.getFullYear(), month:d.getMonth()+1 }); }
  const rows = [];
  for (const m of months){
    const monthStart = new Date(m.year, m.month-1,1);
    const monthEnd = new Date(m.year, m.month,0,23,59,59,999);
    const [activeStart, activeEnd, hires, exits] = await Promise.all([
      prisma.employee.count({ where:{ status:'ACTIVE', hireDate:{ lte: monthStart }, OR:[{ endDate:null }, { endDate:{ gt: monthStart } }] } }),
      prisma.employee.count({ where:{ status:'ACTIVE', hireDate:{ lte: monthEnd }, OR:[{ endDate:null }, { endDate:{ gt: monthEnd } }] } }),
      prisma.employee.count({ where:{ hireDate:{ gte: monthStart, lte: monthEnd } } }),
      prisma.employee.count({ where:{ endDate:{ gte: monthStart, lte: monthEnd } } }),
    ]);
    const avgHeadcount = (activeStart + activeEnd)/2;
    const hiresRatePct = avgHeadcount ? (hires/avgHeadcount)*100 : 0;
    const exitTurnoverPct = avgHeadcount ? (exits/avgHeadcount)*100 : 0;
    rows.push({ ...m, activeStart, activeEnd, avgHeadcount, hires, exits, hiresRatePct: Math.round(hiresRatePct*100)/100, exitTurnoverPct: Math.round(exitTurnoverPct*100)/100 });
  }
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.addPage([595,842]);
  const margin=36; let y=842-margin; const draw=(text,size=10,x=margin)=>{ page.drawText(text,{ x,y,size,font,color:rgb(0,0,0)}); y-=size+4; };
  draw(`Tendance Personnel (${monthsWindow} mois)`,14);
  draw('Colonnes: AAAA-MM | Actifs Début | Actifs Fin | Moyenne | Embauches | Sorties | Hires% | ExitTurnover%');
  y-=4;
  rows.forEach(r=>{ draw(`${r.year}-${String(r.month).padStart(2,'0')} | ${r.activeStart} | ${r.activeEnd} | ${r.avgHeadcount} | ${r.hires} | ${r.exits} | ${r.hiresRatePct}% | ${r.exitTurnoverPct}%`); });
  const bytes = await pdfDoc.save();
  return new Response(bytes,{ status:200, headers:{ 'Content-Type':'application/pdf', 'Content-Disposition':'attachment; filename="personnel_trend_last6.pdf"' } });
}
