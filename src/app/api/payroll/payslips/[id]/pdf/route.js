import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { PDFDocument, rgb } from 'pdf-lib';
import { loadPrimaryFont, drawFooter, drawDraftWatermark } from '@/lib/pdf/utils';
import { featureFlags } from '@/lib/features';
import { getPayrollCurrencyContext } from '@/lib/payroll/context';
import { requireCompanyId } from '@/lib/tenant';
import { extractPayrollSettlementRef } from '@/lib/payroll/settlement-config';

export const runtime = 'nodejs';

const fmt = (n) => {
  const val = Number(n ?? 0);
  if (!Number.isFinite(val)) return '0.00';
  return val.toFixed(2); // avoid locales inserting NBSP
};

const clean = (s = '') => String(s ?? '')
  .replace(/[\u00a0\u202f]/g, ' ')
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '');

function truncateToWidth(font, text, size, maxWidth) {
  const value = clean(text);
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  let out = value;
  while (out.length > 0 && font.widthOfTextAtSize(`${out}...`, size) > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}...`;
}

function drawRightText(page, text, { xRight, y, size, font, color = rgb(0, 0, 0) }) {
  const value = clean(text);
  const width = font.widthOfTextAtSize(value, size);
  page.drawText(value, { x: xRight - width, y, size, font, color });
}

function drawBlock(page, { x, y, width, height, title, font }) {
  page.drawRectangle({
    x,
    y: y - height,
    width,
    height,
    borderColor: rgb(0.78, 0.82, 0.88),
    borderWidth: 0.75,
    color: rgb(0.985, 0.99, 1),
  });
  if (title) {
    page.drawText(title, {
      x: x + 10,
      y: y - 16,
      size: 9,
      font,
      color: rgb(0.12, 0.2, 0.42),
    });
    page.drawLine({
      start: { x: x + 8, y: y - 22 },
      end: { x: x + width - 8, y: y - 22 },
      thickness: 0.4,
      color: rgb(0.82, 0.86, 0.92),
    });
  }
}

function drawBlockLines(page, { x, y, width, lines, font, size = 8.5, lineGap = 11 }) {
  let cursor = y;
  for (const item of lines.filter(Boolean)) {
    const text = Array.isArray(item) ? `${item[0]}: ${item[1] || '-'}` : item;
    page.drawText(truncateToWidth(font, text, size, width), {
      x,
      y: cursor,
      size,
      font,
      color: rgb(0.14, 0.14, 0.18),
    });
    cursor -= lineGap;
  }
  return cursor;
}

function companyFromDb(company) {
  if (!company) {
    return {
      name: clean(process.env.COMPANY_NAME),
      address: clean(process.env.COMPANY_ADDRESS),
      siret: clean(process.env.COMPANY_SIRET),
      vat: clean(process.env.COMPANY_VAT),
      rccm: '',
      idNat: '',
      taxNumber: '',
      cnss: '',
      onem: '',
      inpp: '',
    };
  }
  return {
    name: clean(company.name),
    address: clean(company.address || process.env.COMPANY_ADDRESS),
    siret: clean(process.env.COMPANY_SIRET),
    vat: clean(process.env.COMPANY_VAT),
    rccm: clean(company.rccmNumber),
    idNat: clean(company.idNatNumber),
    taxNumber: clean(company.taxNumber),
    cnss: clean(company.cnssNumber),
    onem: clean(company.onemNumber),
    inpp: clean(company.inppNumber),
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

export async function GET(req, { params }) {
  try {
    if (!featureFlags.payroll) return NextResponse.json({ error: 'Payroll disabled' }, { status: 403 });
    const companyId = requireCompanyId(req);
    const { id } = await params;
    const payslip = await prisma.payslip.findUnique({
      where: { id, companyId },
      include: { employee: true, lines: true, period: true }
    });
    if (!payslip) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const companyCurrencyContext = await getPayrollCurrencyContext(companyId);
    const currencyContext = {
      processingCurrency: payslip.processingCurrency || payslip.period?.processingCurrency || companyCurrencyContext.processingCurrency,
      fiscalCurrency: payslip.fiscalCurrency || payslip.period?.fiscalCurrency || companyCurrencyContext.fiscalCurrency,
      fxRate: payslip.fxRate?.toNumber?.() ?? payslip.fxRate ?? payslip.period?.fxRate?.toNumber?.() ?? payslip.period?.fxRate ?? null,
    };

    const sortedLines = [...payslip.lines].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const totals = computeTotals(sortedLines);
    // Récupérer le dernier règlement PAYSET (s'il existe) pour cet employé dans la période
    const settlements = await prisma.journalEntry.findMany({
      where: {
        companyId,
        sourceType: 'PAYROLL',
        sourceId: payslip.periodId,
        description: { contains: 'PAYSET-' },
      },
      orderBy: { date: 'desc' },
      take: 5,
    });
    let payset = null;
    if (settlements.length) {
      // Filtrer par employeeId mentionné dans la description ou fallback sur le plus récent
      const match = settlements.find(j => j.description?.includes(payslip.employeeId)) || settlements[0];
      const txs = await prisma.transaction.findMany({ where: { journalEntryId: match.id }, include: { account: true } });
      const bankTx = txs.find(t => t.direction === 'DEBIT');
      const refMatch = extractPayrollSettlementRef(match.description);
      payset = {
        ref: refMatch,
        date: match.date,
        bank: bankTx?.account?.number || '',
      };
    }

    const pdfDoc = await PDFDocument.create();
    const pages = [];
    const font = await loadPrimaryFont(pdfDoc);
    const isDraft = payslip.period?.status !== 'POSTED';
    const dbCompany = await prisma.company.findUnique({ where: { id: companyId } });
    const company = companyFromDb(dbCompany);

    const addPage = (subTitle, { firstPage = false } = {}) => {
      const p = pdfDoc.addPage([595.28, 841.89]);
      pages.push(p);
      p.drawText(`Bulletin de paie ${payslip.ref}`, {
        x: 40,
        y: 812,
        size: 15,
        font,
        color: rgb(0.1, 0.18, 0.42),
      });
      if (subTitle) {
        drawRightText(p, subTitle, { xRight: 555, y: 814, size: 9, font, color: rgb(0.35, 0.38, 0.48) });
      }
      p.drawLine({
        start: { x: 40, y: 800 },
        end: { x: 555, y: 800 },
        thickness: 0.8,
        color: rgb(0.78, 0.82, 0.9),
      });
      if (firstPage) {
        drawBlock(p, { x: 40, y: 785, width: 245, height: 110, title: 'Période et salarié', font });
        drawBlockLines(p, {
          x: 50,
          y: 755,
          width: 225,
          font,
          lines: [
            ['Période', `${payslip.period.month}/${payslip.period.year}`],
            ['Statut', payslip.period?.status || '-'],
            ['Employé', `${payslip.employee.firstName} ${payslip.employee.lastName}`],
            ['Matricule', payslip.employee.employeeNumber || '-'],
          ],
        });

        drawBlock(p, { x: 310, y: 785, width: 245, height: 110, title: 'Société', font });
        drawBlockLines(p, {
          x: 320,
          y: 755,
          width: 225,
          font,
          lines: [
            company.name,
            company.address,
            company.rccm ? `RCCM: ${company.rccm}` : '',
            company.idNat ? `ID NAT: ${company.idNat}` : '',
            company.taxNumber ? `N° Impôt: ${company.taxNumber}` : '',
          ],
        });
      }
      if (isDraft) drawDraftWatermark(p, { font, text: 'BROUILLON' });
      return p;
    };

    let currentPage = addPage(`Période ${payslip.period.month}/${payslip.period.year}`, { firstPage: true });
    drawBlock(currentPage, { x: 40, y: 650, width: 245, height: 88, title: 'Contexte devise', font });
    drawBlockLines(currentPage, {
      x: 50,
      y: 620,
      width: 225,
      font,
      lines: [
        ['Devise traitement', currencyContext.processingCurrency],
        ['Devise fiscale', currencyContext.fiscalCurrency],
        ['Taux fiscal', currencyContext.fxRate ?? '-'],
      ],
    });

    drawBlock(currentPage, { x: 310, y: 650, width: 245, height: 88, title: 'Synthèse à payer', font });
    drawBlockLines(currentPage, {
      x: 320,
      y: 620,
      width: 100,
      font,
      lines: ['Brut', 'Déductions', 'Charges employeur', 'Net à payer'],
    });
    drawRightText(currentPage, `${fmt(payslip.grossAmount)} ${currencyContext.processingCurrency}`, { xRight: 545, y: 620, size: 8.5, font });
    drawRightText(currentPage, `${fmt(-totals.deductions)} ${currencyContext.processingCurrency}`, { xRight: 545, y: 609, size: 8.5, font });
    drawRightText(currentPage, `${fmt(totals.employer)} ${currencyContext.processingCurrency}`, { xRight: 545, y: 598, size: 8.5, font });
    drawRightText(currentPage, `${fmt(payslip.netAmount)} ${currencyContext.processingCurrency}`, { xRight: 545, y: 584, size: 11, font, color: rgb(0, 0.35, 0) });

    let y = 535;
    if (payset) {
      drawBlock(currentPage, { x: 40, y: 555, width: 515, height: 36, title: 'Règlement', font });
      drawBlockLines(currentPage, {
        x: 50,
        y: 527,
        width: 495,
        size: 8,
        font,
        lines: [`PAYSET: ${payset.ref || '-'} le ${payset.date ? new Date(payset.date).toLocaleDateString('fr-FR') : '-'} banque ${payset.bank || '-'}`],
      });
      y = 495;
    }

    // Tableau des lignes : Code | Libelle | Base | Montant
    const drawTableTitle = () => {
      currentPage.drawText('Détail des lignes', { x: 40, y, size: 11, font, color: rgb(0.1, 0.18, 0.42) });
      y -= 16;
    };
    const colX = { code: 45, label: 100, baseRight: 445, amountRight: 545 };
    const drawRow = (row, isHeader = false) => {
      const size = isHeader ? 10 : 9;
      const color = isHeader ? rgb(0.1, 0.1, 0.4) : rgb(0, 0, 0);
      currentPage.drawText(row.code, { x: colX.code, y, size, font, color });
      currentPage.drawText(truncateToWidth(font, row.label, size, 240), { x: colX.label, y, size, font, color });
      drawRightText(currentPage, row.base, { xRight: colX.baseRight, y, size, font, color });
      drawRightText(currentPage, row.amount, { xRight: colX.amountRight, y, size, font, color });
      y -= 12;
    };
    drawTableTitle();
    const headerY = y;
    drawRow({ code: 'Code', label: 'Libelle', base: 'Base', amount: 'Montant' }, true);
    currentPage.drawLine({ start: { x: 40, y: headerY - 2 }, end: { x: 555, y: headerY - 2 }, thickness: 0.5 });

    for (const l of sortedLines) {
      if (y < 80) {
        currentPage = addPage(`Suite ${pages.length + 1}`);
        y = 770;
        drawTableTitle();
        drawRow({ code: 'Code', label: 'Libelle', base: 'Base', amount: 'Montant' }, true);
        currentPage.drawLine({ start: { x: 40, y: y + 10 }, end: { x: 555, y: y + 10 }, thickness: 0.5 });
      }
      const base = l.baseAmount != null ? fmt(l.baseAmount) : '';
      drawRow({
        code: clean(l.code),
        label: clean(`${l.label} (${l.kind})`),
        base,
        amount: fmt(l.amount),
      });
    }

    const totalPages = pages.length;
    pages.forEach((p, idx) => {
      drawFooter(p, { font, pageNumber: idx + 1, totalPages, legal: isDraft ? 'Document genere automatiquement - Non signe (BROUILLON).' : 'Document genere automatiquement.' });
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
