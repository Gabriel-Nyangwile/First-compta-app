import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { PDFDocument, rgb } from 'pdf-lib';
import { loadPrimaryFont, drawFooter, drawPageHeader, drawCompanyIdentity, drawDraftWatermark } from '@/lib/pdf/utils';
import { featureFlags } from '@/lib/features';

export const runtime = 'nodejs';

const fmt = (n) => {
  const val = Number(n ?? 0);
  if (!Number.isFinite(val)) return '0.00';
  return val.toFixed(2); // avoid locales inserting NBSP
};

const clean = (s = '') => String(s ?? '').replace(/[\u00a0\u202f]/g, ' ').replace(/[^\x20-\x7E]/g, ' ');

function companyFromEnv() {
  return {
    name: clean(process.env.COMPANY_NAME),
    address: clean(process.env.COMPANY_ADDRESS),
    siret: clean(process.env.COMPANY_SIRET),
    vat: clean(process.env.COMPANY_VAT),
  };
}

function computeTotals(lines) {
  return lines.reduce(
    (acc, l) => {
      const amt = Number(l.amount ?? 0);
      if (l.kind === 'BASE' || l.kind === 'PRIME') acc.gross += amt;
      if (l.kind === 'COTISATION_SALARIALE' || l.kind === 'IMPOT' || l.kind === 'RETENUE') acc.deductions += amt;
      if (l.kind === 'COTISATION_PATRONALE') acc.employer += amt;
      return acc;
    },
    { gross: 0, deductions: 0, employer: 0 }
  );
}

export async function GET(_req, { params }) {
  try {
    if (!featureFlags.payroll) return NextResponse.json({ error: 'Payroll disabled' }, { status: 403 });
    const { id } = await params;
    const payslip = await prisma.payslip.findUnique({
      where: { id },
      include: { employee: true, lines: true, period: true }
    });
    if (!payslip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const sortedLines = [...payslip.lines].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const totals = computeTotals(sortedLines);

    const pdfDoc = await PDFDocument.create();
    const pages = [];
    const font = await loadPrimaryFont(pdfDoc);
    const isDraft = payslip.period?.status !== 'POSTED';
    const company = companyFromEnv();

    const addPage = (subTitle) => {
      const p = pdfDoc.addPage([595.28, 841.89]);
      pages.push(p);
      drawPageHeader(p, { font, title: `Bulletin ${payslip.ref}`, subTitle });
      drawCompanyIdentity(p, { font, company });
      if (isDraft) drawDraftWatermark(p, { font, text: 'BROUILLON' });
      return p;
    };

    let currentPage = addPage(`Période ${payslip.period.month}/${payslip.period.year}`);
    let y = 770;
    const line = (txt, size = 10, color = rgb(0, 0, 0)) => { currentPage.drawText(txt, { x: 40, y, size, font, color }); y -= 14; };

    line(clean(`Employé: ${payslip.employee.firstName} ${payslip.employee.lastName}`));
    line(clean(`Matricule: ${payslip.employee.employeeNumber || '-'}`));
    line(`Brut: ${fmt(payslip.grossAmount)}  Net: ${fmt(payslip.netAmount)}`);
    line(`Deductions: ${fmt(-totals.deductions)}  Charges employeur: ${fmt(totals.employer)}`);
    y -= 12;

    // Récap net à payer
    line('Net à payer', 11, rgb(0, 0.35, 0));
    line(`${fmt(payslip.netAmount)} EUR`, 14, rgb(0, 0.35, 0));
    y -= 10;
    line('Détail lignes:', 11, rgb(0.1, 0.1, 0.5));
    y -= 6;

    // Tableau des lignes : Code | Libellé | Base | Montant
    const headerY = y;
    const colX = { code: 40, label: 90, base: 360, amount: 460 };
    const drawRow = (row, isHeader = false) => {
      const size = isHeader ? 10 : 9;
      const color = isHeader ? rgb(0.1, 0.1, 0.4) : rgb(0, 0, 0);
      currentPage.drawText(row.code, { x: colX.code, y, size, font, color });
      currentPage.drawText(row.label.slice(0, 45), { x: colX.label, y, size, font, color });
      currentPage.drawText(row.base, { x: colX.base, y, size, font, color });
      currentPage.drawText(row.amount, { x: colX.amount, y, size, font, color });
      y -= 12;
    };
    drawRow({ code: 'Code', label: 'Libellé', base: 'Base', amount: 'Montant' }, true);
    currentPage.drawLine({ start: { x: 40, y: headerY - 2 }, end: { x: 540, y: headerY - 2 }, thickness: 0.5 });

    for (const l of sortedLines) {
      if (y < 80) {
        currentPage = addPage(`Suite (${pages.length + 1})`);
        y = 780;
        drawRow({ code: 'Code', label: 'Libellé', base: 'Base', amount: 'Montant' }, true);
        currentPage.drawLine({ start: { x: 40, y: y - 2 }, end: { x: 540, y: y - 2 }, thickness: 0.5 });
        y -= 12;
      }
      const base = l.baseAmount ? fmt(l.baseAmount) : '';
      drawRow({
        code: clean(l.code),
        label: clean(`${l.label} (${l.kind})`),
        base,
        amount: fmt(l.amount),
      });
    }

    const totalPages = pages.length;
    pages.forEach((p, idx) => {
      drawFooter(p, { font, pageNumber: idx + 1, totalPages, legal: isDraft ? 'Document généré automatiquement - Non signé (BROUILLON).' : 'Document généré automatiquement.' });
    });

    const bytes = await pdfDoc.save();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename=payslip-${payslip.ref}.pdf`
      }
    });
  } catch (e) {
    console.error('payslip pdf error', e);
    return NextResponse.json({ error: 'PDF generation failed', message: e?.message }, { status: 500 });
  }
}
