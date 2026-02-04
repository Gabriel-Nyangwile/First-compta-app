import { NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { getMoneyAccountLedger } from '@/lib/serverActions/money';
import { embedLogo, loadPrimaryFont, drawFooter, drawCompanyIdentity, formatDateFR } from '@/lib/pdf/utils';
import { requireCompanyId } from '@/lib/tenant';

export async function GET(req) {
  const companyId = requireCompanyId(req);
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('account');
  if (!accountId) return NextResponse.json({ error: 'Param account requis' }, { status: 400 });
  const from = searchParams.get('from') || undefined;
  const to = searchParams.get('to') || undefined;
  const limit = parseInt(searchParams.get('limit') || '2000', 10);
  try {
    const ledger = await getMoneyAccountLedger({
      companyId,
      moneyAccountId: accountId,
      dateFrom: from,
      dateTo: to,
      limit,
    });
    const pdfDoc = await PDFDocument.create();
    const font = await loadPrimaryFont(pdfDoc);
    const mono = await pdfDoc.embedFont(StandardFonts.Courier);
    const pageSize = [595.28, 841.89];
    let page = pdfDoc.addPage(pageSize);
    const pages = [page];
    const logo = await embedLogo(pdfDoc);

    const company = {
      name: process.env.COMPANY_NAME || 'Ma Société SAS',
      address: process.env.COMPANY_ADDRESS || '12 Rue Exemple\n75000 Paris',
      siret: process.env.COMPANY_SIRET || '',
      vat: process.env.COMPANY_VAT || ''
    };
    drawCompanyIdentity(page, { font, company });
    const title = 'GRAND LIVRE TRESORERIE';
    page.drawText(title, { x: 40, y: 800, size: 18, font, color: rgb(0.1,0.2,0.55) });
    page.drawText(`Compte: ${ledger.account.label}`, { x: 40, y: 780, size: 11, font });
    if (ledger.account.ledgerAccountId) page.drawText(`Compte comptable ID: ${ledger.account.ledgerAccountId}`, { x: 300, y: 780, size: 9, font, color: rgb(0.4,0.4,0.4) });
    if (logo) page.drawImage(logo.image, { x: 500, y: 790, width: logo.scaled.width, height: logo.scaled.height });

    let filterLine = 'Période: ';
    if (ledger.filter) {
      const fFrom = ledger.filter.from ? formatDateFR(ledger.filter.from) : 'Début';
      const fTo = ledger.filter.to ? formatDateFR(ledger.filter.to) : 'Fin';
      filterLine += `${fFrom} -> ${fTo}`;
    } else {
      filterLine += 'Complète';
    }
    page.drawText(filterLine, { x: 40, y: 765, size: 9, font, color: rgb(0.3,0.3,0.3) });

    const headerYStart = 740;
    let y = headerYStart;
    const marginBottom = 60;
    const lineHeight = 12;
    const drawTableHeader = () => {
      page.drawText('Date', { x: 40, y, size: 9, font });
      page.drawText('Nature', { x: 80, y, size: 9, font });
      page.drawText('Desc', { x: 140, y, size: 9, font });
      page.drawText('Réf', { x: 235, y, size: 9, font });
      page.drawText('Compte Débit', { x: 300, y, size: 9, font });
      page.drawText('Compte Crédit', { x: 420, y, size: 9, font });
      page.drawText('Solde', { x: 525, y, size: 9, font });
      y -= lineHeight;
      page.drawLine({ start: { x: 40, y: y+4 }, end: { x: 555, y: y+4 }, thickness: 0.5, color: rgb(0.6,0.6,0.6) });
      y -= 4;
    };

    // Opening balance row
    const newPage = () => {
      page = pdfDoc.addPage(pageSize); pages.push(page); y = 800; drawCompanyIdentity(page, { font, company }); drawTableHeader();
    };

    drawTableHeader();
    const toStr = v => (v && v.toString) ? v.toString() : String(v);
    page.drawText('OUVERTURE', { x: 40, y, size: 9, font });
    page.drawText(toStr(ledger.openingBalance), { x: 500, y, size: 9, font: mono });
    y -= lineHeight;

    for (const m of ledger.movements) {
      // Build debit/credit arrays
      const debits = m.transactions.filter(t => t.debit).map(t => `${t.accountNumber||''} ${t.accountLabel||''}`.trim());
      const debitAmounts = m.transactions.filter(t => t.debit).map(t => toStr(t.debit));
      const credits = m.transactions.filter(t => t.credit).map(t => `${t.accountNumber||''} ${t.accountLabel||''}`.trim());
      const creditAmounts = m.transactions.filter(t => t.credit).map(t => toStr(t.credit));
      const rows = Math.max(1, debits.length, credits.length);
      for (let i=0; i<rows; i++) {
        if (y < marginBottom) { newPage(); }
        if (i===0) {
          page.drawText(formatDateFR(m.date), { x: 40, y, size: 8, font });
          page.drawText((m.kind||'').slice(0,6), { x: 80, y, size: 8, font });
          page.drawText((m.description||'').slice(0,18), { x: 140, y, size: 8, font });
          if (m.voucherRef) page.drawText(m.voucherRef.slice(0,10), { x: 235, y, size: 7, font });
        }
        if (debits[i]) page.drawText(debits[i].slice(0,20), { x: 300, y, size: 7, font });
        if (debitAmounts[i]) page.drawText(debitAmounts[i], { x: 370, y, size: 7, font: mono });
        if (credits[i]) page.drawText(credits[i].slice(0,20), { x: 420, y, size: 7, font });
        if (creditAmounts[i]) page.drawText(creditAmounts[i], { x: 495, y, size: 7, font: mono });
        if (i===0) page.drawText(toStr(m.balanceAfter), { x: 525, y, size: 8, font: mono });
        y -= lineHeight;
      }
    }

    // Totals block
    if (y < marginBottom+50) newPage();
    y -= 10; page.drawLine({ start:{ x:40, y }, end:{ x:555, y }, thickness: 0.5, color: rgb(0.5,0.5,0.5) }); y -= 16;
  page.drawText('ENTREES', { x: 300, y, size: 9, font, color: rgb(0,0.45,0) });
  page.drawText(toStr(ledger.totalIn), { x: 370, y, size: 9, font: mono, color: rgb(0,0.45,0) });
  page.drawText('SORTIES', { x: 420, y, size: 9, font, color: rgb(0.65,0,0) });
  page.drawText(toStr(ledger.totalOut), { x: 495, y, size: 9, font: mono, color: rgb(0.65,0,0) });
  y -= 16;
  page.drawText('CLOTURE', { x: 300, y, size: 10, font, color: rgb(0.1,0.2,0.55) });
  page.drawText(toStr(ledger.closingBalance), { x: 370, y, size: 10, font: mono });

    // Footers page numbers
    const totalPages = pages.length;
    pages.forEach((p, idx) => drawFooter(p, { font, pageNumber: idx+1, totalPages, legal: 'Grand livre trésorerie généré automatiquement' }));

    const bytes = await pdfDoc.save();
    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=ledger-${accountId}.pdf`
      }
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
