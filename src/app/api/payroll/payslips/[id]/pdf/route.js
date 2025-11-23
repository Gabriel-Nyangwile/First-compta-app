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

const clean = (s = '') => String(s ?? '').replace(/[\u00a0\u202f]/g, ' ');

function companyFromEnv() {
  return {
    name: clean(process.env.COMPANY_NAME),
    address: clean(process.env.COMPANY_ADDRESS),
    siret: clean(process.env.COMPANY_SIRET),
    vat: clean(process.env.COMPANY_VAT),
  };
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
    y -= 8; line('Détail lignes:', 11, rgb(0.1, 0.1, 0.5)); y -= 4;

    const sortedLines = [...payslip.lines].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (const l of sortedLines) {
      if (y < 80) {
        currentPage = addPage(`Suite (${pages.length + 1})`);
        y = 780;
      }
      const base = l.baseAmount ? ` base=${fmt(l.baseAmount)}` : '';
      line(clean(`${l.code} ${l.label} (${l.kind})  Montant: ${fmt(l.amount)}${base}`));
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
