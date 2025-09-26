import { NextResponse } from 'next/server';
import { PDFDocument, rgb } from 'pdf-lib';
import { computeVatRecap } from '@/lib/vatRecap';
import { loadPrimaryFont, drawPageHeader, drawFooter, drawCompanyIdentity, formatDateFR } from '@/lib/pdf/utils';
import { formatAmountPlain, formatRatePercent } from '@/lib/utils';

function envCompany() {
  return {
    name: process.env.COMPANY_NAME,
    address: process.env.COMPANY_ADDRESS,
    siret: process.env.COMPANY_SIRET,
    vat: process.env.COMPANY_VAT
  };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const granularity = searchParams.get('granularity') || 'month';
    const includeZero = searchParams.get('includeZero') === 'true';

    const recap = await computeVatRecap({ from, to, granularity, includeZero });

    const pdfDoc = await PDFDocument.create();
    const font = await loadPrimaryFont(pdfDoc);
  let page = pdfDoc.addPage([595.28, 841.89]);

    drawPageHeader(page, { font, title: 'Récapitulatif TVA', subTitle: `${formatDateFR(recap.from)} -> ${formatDateFR(recap.to)}` });
    drawCompanyIdentity(page, { font, company: envCompany() });

    let y = 780;
    page.drawText(`Granularité: ${recap.granularity}`, { x: 40, y, size: 10, font, color: rgb(0.2,0.2,0.4) }); y -= 18;

    // Table header
    page.drawText('Période', { x: 40, y, size: 10, font });
    page.drawText('Sens', { x: 110, y, size: 10, font });
    page.drawText('Taux %', { x: 170, y, size: 10, font });
    page.drawText('Base €', { x: 230, y, size: 10, font });
    page.drawText('TVA €', { x: 300, y, size: 10, font });
    y -= 14;

    const minY = 100;
    let pageCount = 1; const pages = [page];

    for (const r of recap.rows) {
      if (y < minY) {
        const np = pdfDoc.addPage([595.28, 841.89]);
        pageCount++; pages.push(np);
        drawPageHeader(np, { font, title: 'Récapitulatif TVA (suite)', subTitle: `${formatDateFR(recap.from)} -> ${formatDateFR(recap.to)}` });
        drawCompanyIdentity(np, { font, company: envCompany() });
        y = 780;
        np.drawText('Période', { x: 40, y, size: 10, font });
        np.drawText('Sens', { x: 110, y, size: 10, font });
        np.drawText('Taux %', { x: 170, y, size: 10, font });
        np.drawText('Base €', { x: 230, y, size: 10, font });
        np.drawText('TVA €', { x: 300, y, size: 10, font });
        y -= 14;
        page = np; // rebind?
      }
      page.drawText(r.period, { x: 40, y, size: 9, font });
      page.drawText(r.direction === 'COLLECTED' ? 'Collectée' : 'Déductible', { x: 110, y, size: 9, font });
  page.drawText(formatRatePercent(r.ratePercent), { x: 170, y, size: 9, font });
  page.drawText(formatAmountPlain(r.base), { x: 230, y, size: 9, font });
  page.drawText(formatAmountPlain(r.vat), { x: 300, y, size: 9, font });
      y -= 12;
    }

    // Totals block
    if (y < 180) {
      const np = pdfDoc.addPage([595.28, 841.89]);
      pageCount++; pages.push(np);
      drawPageHeader(np, { font, title: 'Récapitulatif TVA (totaux)', subTitle: `${formatDateFR(recap.from)} -> ${formatDateFR(recap.to)}` });
      drawCompanyIdentity(np, { font, company: envCompany() });
      page = np; y = 780;
    }
    y -= 10;
    page.drawText('Totaux', { x: 40, y, size: 12, font, color: rgb(0.1,0.1,0.6) }); y -= 18;
    const t = recap.totals;
  page.drawText(`Collectée Base: ${formatAmountPlain(t.collectedBase)} €`, { x: 40, y, size: 10, font }); y -= 12;
  page.drawText(`Collectée TVA : ${formatAmountPlain(t.collectedVat)} €`, { x: 40, y, size: 10, font }); y -= 12;
  page.drawText(`Déductible Base: ${formatAmountPlain(t.deductibleBase)} €`, { x: 40, y, size: 10, font }); y -= 12;
  page.drawText(`Déductible TVA : ${formatAmountPlain(t.deductibleVat)} €`, { x: 40, y, size: 10, font }); y -= 12;
  page.drawText(`Solde TVA (à payer) : ${formatAmountPlain(t.balanceVat)} €`, { x: 40, y, size: 11, font, color: rgb(0.05,0.45,0.05) }); y -= 16;

    // Footer pages
    pages.forEach((p, idx) => drawFooter(p, { font, pageNumber: idx+1, totalPages: pages.length, legal: 'Document génération automatique - récap TVA interne' }));

    const bytes = await pdfDoc.save();
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="vat-recap-${Date.now()}.pdf"`
      }
    });
  } catch (e) {
    console.error('VAT recap PDF error', e);
    return NextResponse.json({ error: e.message || 'Erreur PDF récap TVA' }, { status: 500 });
  }
}
