import { NextResponse } from 'next/server';
import { getMoneyAccountLedger } from '@/lib/serverActions/money';
import { formatAmountPlain } from '@/lib/utils';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('account');
  if (!accountId) {
    return NextResponse.json({ error: 'Param account requis' }, { status: 400 });
  }
  const from = searchParams.get('from') || undefined;
  const to = searchParams.get('to') || undefined;
  const limit = parseInt(searchParams.get('limit') || '2000', 10);
  try {
    const ledger = await getMoneyAccountLedger({ moneyAccountId: accountId, limit, dateFrom: from, dateTo: to });
    // Build CSV
    const headers = [
      'date','kind','direction','amount','invoice','incomingInvoice','description','voucherRef','balanceAfter','lineType','accountNumber','accountLabel','debit','credit'
    ];
    const rows = [];
    rows.push(headers.join(','));
    for (const m of ledger.movements) {
      const baseCols = [
        new Date(m.date).toISOString().substring(0,10),
        m.kind,
        m.direction,
  formatAmountPlain(m.amount),
        m.invoice?.number || '',
        m.incomingInvoice?.number || '',
        (m.description||'').replace(/"/g,'""'),
        (m.voucherRef||'').replace(/"/g,'""'),
  formatAmountPlain(m.balanceAfter)
      ];
      if (!m.transactions.length) {
        rows.push([...baseCols,'','','','',''].join(','));
      } else {
        for (const t of m.transactions) {
          rows.push([...baseCols,
            'transaction',
            t.accountNumber||'',
            (t.accountLabel||'').replace(/"/g,'""'),
            t.debit? formatAmountPlain(t.debit) : '',
            t.credit? formatAmountPlain(t.credit) : ''
          ].join(','));
        }
      }
    }
    const csv = rows.join('\n');
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=ledger-${accountId}.csv`
      }
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
