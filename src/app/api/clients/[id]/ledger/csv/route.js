import { NextResponse } from 'next/server';
import { getClientLedger } from '@/lib/serverActions/ledgers';

export async function GET(req, { params }) {
  try {
    const { searchParams } = new URL(req.url);
    const dateStart = searchParams.get('dateStart') || undefined;
    const dateEnd = searchParams.get('dateEnd') || undefined;
    const includeDetails = searchParams.get('includeDetails') === '1';
  const ledger = await getClientLedger({ id: params.id, dateStart, dateEnd, includeDetails });
    const headers = ['Date','Compte','Libellé','Pièce','Statut facture','Type','Débit','Crédit','Solde'];
    const rows = ledger.rows.map(r => [
      new Date(r.date).toISOString().split('T')[0],
      r.accountNumber || '',
      (r.description || '').replace(/"/g,'""'),
      r.invoiceRef || '',
      r.invoiceStatus || '',
      r.kind,
      r.debit !== null ? r.debit.toFixed(2) : '',
      r.credit !== null ? r.credit.toFixed(2) : '',
      r.running.toFixed(2)
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(';')).join('\n');
    const safeName = (ledger.partyName || 'client').replace(/[^a-z0-9]+/gi,'_').toLowerCase();
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="client-ledger-${safeName}.csv"`
      }
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
