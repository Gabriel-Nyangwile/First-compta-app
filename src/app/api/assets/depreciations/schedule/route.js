import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function toNumber(x) {
  return x?.toNumber?.() ?? Number(x ?? 0) ?? 0;
}

async function buildRows(year) {
  const assets = await prisma.asset.findMany({
    include: {
      category: true,
      depreciationLines: {
        where: { year },
        orderBy: [{ month: 'asc' }],
      },
    },
  });
  const rows = [];
  for (const asset of assets) {
    if (!asset.depreciationLines?.length) continue;
    const months = Array(12).fill(0);
    for (const l of asset.depreciationLines) {
      if (l.month >= 1 && l.month <= 12 && l.status === 'POSTED') {
        months[l.month - 1] += toNumber(l.amount);
      }
    }
    const total = months.reduce((s, v) => s + v, 0);
    rows.push({
      assetRef: asset.ref,
      assetLabel: asset.label,
      category: asset.category?.code || '',
      cost: toNumber(asset.cost),
      months,
      total,
    });
  }
  return rows.sort((a, b) => a.assetRef.localeCompare(b.assetRef));
}

function toCsv(rows, year) {
  const header = ['assetRef', 'assetLabel', 'category', 'cost', ...Array.from({ length: 12 }, (_, i) => `M${i + 1}-${year}`), 'total'];
  const lines = rows.map((r) => [
    r.assetRef,
    r.assetLabel,
    r.category,
    r.cost.toFixed(2),
    ...r.months.map((m) => m.toFixed(2)),
    r.total.toFixed(2),
  ]);
  return [header.join(','), ...lines.map((l) => l.join(','))].join('\n');
}

async function buildXlsx(rows, year) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Amort ${year}`);
  ws.columns = [
    { header: 'Ref', key: 'assetRef', width: 14 },
    { header: 'Libelle', key: 'assetLabel', width: 32 },
    { header: 'Categorie', key: 'category', width: 12 },
    { header: 'Cout', key: 'cost', width: 12 },
    ...Array.from({ length: 12 }, (_, i) => ({ header: `M${i + 1}`, key: `m${i + 1}`, width: 10 })),
    { header: 'Total', key: 'total', width: 12 },
  ];
  rows.forEach((r) => {
    const row = {
      assetRef: r.assetRef,
      assetLabel: r.assetLabel,
      category: r.category,
      cost: r.cost,
      total: r.total,
    };
    r.months.forEach((m, idx) => {
      row[`m${idx + 1}`] = m;
    });
    ws.addRow(row);
  });
  ws.getRow(1).font = { bold: true };
  return wb.xlsx.writeBuffer();
}

async function buildPdf(rows, year) {
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([842, 595]); // A4 landscape
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const size = 9;
  const x = 40;
  let y = 550;
  const drawHeader = (pg) => {
    pg.drawText(`Tableau d'amortissement ${year}`, { x, y: 550, size: 12, font: fontBold });
    let headerY = 534;
    pg.drawText('Ref', { x, y: headerY, size, font: fontBold });
    pg.drawText('Libelle', { x: x + 60, y: headerY, size, font: fontBold });
    pg.drawText('Cat', { x: x + 210, y: headerY, size, font: fontBold });
    pg.drawText('Cout', { x: x + 260, y: headerY, size, font: fontBold });
    for (let i = 0; i < 12; i += 1) {
      pg.drawText(`M${i + 1}`, { x: x + 300 + i * 32, y: headerY, size, font: fontBold });
    }
    pg.drawText('Total', { x: x + 300 + 12 * 32, y: headerY, size, font: fontBold });
    return headerY - 14;
  };
  y = drawHeader(page);

  const drawRow = (pg, r) => {
    pg.drawText(r.assetRef.slice(0, 10), { x, y, size, font });
    pg.drawText(r.assetLabel.slice(0, 24), { x: x + 60, y, size, font });
    pg.drawText(r.category.slice(0, 6), { x: x + 210, y, size, font });
    pg.drawText(r.cost ? r.cost.toFixed(0) : '', { x: x + 260, y, size, font });
    r.months.forEach((m, idx) => {
      const txt = m ? m.toFixed(0) : '';
      pg.drawText(txt, { x: x + 300 + idx * 32, y, size, font });
    });
    pg.drawText(r.total.toFixed(0), { x: x + 300 + 12 * 32, y, size, font });
  };

  for (const r of rows) {
    if (y < 40) {
      page = pdfDoc.addPage([842, 595]);
      y = drawHeader(page);
    }
    drawRow(page, r);
    y -= 12;
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

export async function GET(req) {
  const url = new URL(req.url);
  const year = Number(url.searchParams.get('year'));
  const format = (url.searchParams.get('format') || 'xlsx').toLowerCase();
  if (!year) return NextResponse.json({ ok: false, error: 'year requis' }, { status: 400 });
  try {
    const rows = await buildRows(year);
    if (!rows.length) return NextResponse.json({ ok: false, error: 'Aucune dotation trouvée pour cette année' }, { status: 404 });

    if (format === 'csv') {
      const csv = toCsv(rows, year);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="amortissement_${year}.csv"`,
        },
      });
    }
    if (format === 'pdf') {
      const pdf = await buildPdf(rows, year);
      return new NextResponse(Buffer.from(pdf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="amortissement_${year}.pdf"`,
        },
      });
    }
    // default xlsx
    const buf = await buildXlsx(rows, year);
    return new NextResponse(Buffer.from(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="amortissement_${year}.xlsx"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Export failed' }, { status: 500 });
  }
}
