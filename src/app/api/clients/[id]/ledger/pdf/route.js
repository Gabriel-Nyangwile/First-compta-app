import { NextResponse } from 'next/server';
import { PDFDocument, rgb } from 'pdf-lib';
import { getClientLedger } from '@/lib/serverActions/ledgers';
import { requireCompanyId } from '@/lib/tenant';

function drawHeader(page, font, title, info) {
  page.drawText(title, { x: 40, y: 800, size: 18, font, color: rgb(0.15,0.15,0.6) });
  page.drawText(info, { x: 40, y: 780, size: 10, font, color: rgb(0.3,0.3,0.3) });
  page.drawText('Date', { x:40, y:760, size:9, font });
  page.drawText('Compte', { x:90, y:760, size:9, font });
  page.drawText('Libellé', { x:150, y:760, size:9, font });
  page.drawText('Pièce', { x:300, y:760, size:9, font });
  page.drawText('Statut', { x:350, y:760, size:9, font });
  page.drawText('Débit', { x:400, y:760, size:9, font });
  page.drawText('Crédit', { x:450, y:760, size:9, font });
  page.drawText('Solde', { x:500, y:760, size:9, font });
}

export async function GET(req, { params }) {
  try {
    const companyId = requireCompanyId(req);
    const { searchParams } = new URL(req.url);
    const dateStart = searchParams.get('dateStart') || undefined;
    const dateEnd = searchParams.get('dateEnd') || undefined;
    const includeDetails = searchParams.get('includeDetails') === '1';
  const ledger = await getClientLedger({ id: params.id, companyId, dateStart, dateEnd, includeDetails });
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont('Helvetica');
    let page = pdf.addPage([595.28, 841.89]);
    let y = 740;
  const info = `Client: ${ledger.partyName || ledger.partyId}${ledger.partyAccountNumber ? ' | Compte: '+ledger.partyAccountNumber : ''}${ledger.partyAccountLabel ? ' ('+ledger.partyAccountLabel+')' : ''}`;
  drawHeader(page, font, 'Grand Livre Client', info);
    // Opening
    page.drawText(`Ouverture: ${ledger.opening.toFixed(2)} €`, { x: 40, y: 730, size: 10, font, color: rgb(0,0.4,0) });
    for (const r of ledger.rows) {
  if (y < 70) { page = pdf.addPage([595.28, 841.89]); y = 760; drawHeader(page, font, 'Grand Livre Client (suite)', info); }
      page.drawText(new Date(r.date).toLocaleDateString('fr-FR'), { x:40, y, size:8, font });
      page.drawText((r.accountNumber||'').slice(0,8), { x:90, y, size:8, font });
      page.drawText((r.description||'').slice(0,18), { x:150, y, size:8, font });
      page.drawText((r.invoiceRef||'').slice(0,8), { x:300, y, size:8, font });
      page.drawText((r.invoiceStatus||'').slice(0,8), { x:350, y, size:8, font });
      if (r.debit) page.drawText(r.debit.toFixed(2), { x:400, y, size:8, font });
      if (r.credit) page.drawText(r.credit.toFixed(2), { x:450, y, size:8, font });
      page.drawText(r.running.toFixed(2), { x:500, y, size:8, font });
      y -= 12;
    }
    page.drawText(`Clôture: ${ledger.closing.toFixed(2)} €`, { x: 40, y: y-10, size: 10, font, color: rgb(0.5,0,0) });
    const bytes = await pdf.save();
  const safeName = (ledger.partyName || 'client').replace(/[^a-z0-9]+/gi,'_').toLowerCase();
  return new NextResponse(bytes, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="client-ledger-${safeName}.pdf"` } });
  } catch (e) {
    return new NextResponse('Erreur: ' + e.message, { status: 400 });
  }
}
