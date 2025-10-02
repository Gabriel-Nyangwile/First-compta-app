import { NextResponse } from 'next/server';
import { getSupplierLedger } from '@/lib/serverActions/ledgers';

async function resolveParams(maybeCtx){
  let ctx = maybeCtx; if (ctx && typeof ctx.then === 'function') ctx = await ctx; let p = ctx?.params ?? ctx; if (p && typeof p.then === 'function') p = await p; return p || {}; }

export async function GET(req, context) {
  try {
    const params = await resolveParams(context);
    const { searchParams } = new URL(req.url);
    const dateStart = searchParams.get('dateStart') || undefined;
    const dateEnd = searchParams.get('dateEnd') || undefined;
    const includeDetails = searchParams.get('includeDetails') === '1';
    const ledger = await getSupplierLedger({ id: params.id, dateStart, dateEnd, includeDetails });
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
    const safeName = (ledger.partyName || 'fournisseur').replace(/[^a-z0-9]+/gi,'_').toLowerCase();
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="supplier-ledger-${safeName}.csv"`
      }
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
