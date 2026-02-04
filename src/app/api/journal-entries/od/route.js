import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { nextSequence } from '@/lib/sequence';
import { requireCompanyId } from '@/lib/tenant';

// Helper: group orphan transactions using same heuristic as rebuild script
async function loadOrphanGroups(companyId) {
  const orphan = await prisma.transaction.findMany({
    where: { journalEntryId: null, companyId },
    orderBy: { date: 'asc' },
    include: { account: { select: { number: true } } },
  });
  const map = new Map();
  for (const t of orphan) {
    const key = t.invoiceId || t.incomingInvoiceId || t.moneyMovementId || `MISC:${t.date.toISOString().slice(0,10)}:${t.nature}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(t);
  }
  const groups = [];
  for (const [key, list] of map.entries()) {
    let debit = 0; let credit = 0;
    for (const l of list) {
      const amt = Number(l.amount?.toNumber?.() ?? l.amount);
      if (l.direction === 'DEBIT') debit += amt; else credit += amt;
    }
    groups.push({ key, debit, credit, diff: Number((debit - credit).toFixed(2)), transactionIds: list.map(l => l.id), sampleDate: list[0].date });
  }
  return groups;
}

// GET /api/journal-entries/od  -> list orphan groups with diff
export async function GET(request) {
  try {
    const companyId = requireCompanyId(request);
    const groups = await loadOrphanGroups(companyId);
    return NextResponse.json({ groups });
  } catch (e) {
    console.error('GET /api/journal-entries/od error', e);
    return NextResponse.json({ error: 'Erreur chargement groupes orphelins' }, { status: 500 });
  }
}

/*
 POST /api/journal-entries/od
 Body: { groupKey, suspenseAccountId?, description? }
 - Trouve le groupe orphelin
 - Si diff != 0 crée une ligne d'ajustement sur le compte suspense (DEBIT si diff<0, CREDIT si diff>0)
 - Crée un JournalEntry MANUAL et attache toutes les transactions + (optionnel) ligne ajustement
*/
export async function POST(request) {
  try {
    const companyId = requireCompanyId(request);
    const contentType = request.headers.get('content-type') || '';
    let body;
    if (contentType.includes('application/json')) {
      body = await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      body = Object.fromEntries(form.entries());
    } else {
      // Fallback attempt JSON
      try { body = await request.json(); } catch { body = {}; }
    }
    const { groupKey, suspenseAccountId, description } = body || {};
    if (!groupKey) return NextResponse.json({ error: 'groupKey requis' }, { status: 400 });
    const groups = await loadOrphanGroups(companyId);
    const group = groups.find(g => g.key === groupKey);
    if (!group) return NextResponse.json({ error: 'Groupe introuvable ou déjà traité.' }, { status: 404 });

    // Resolve suspense account
    let suspenseId = suspenseAccountId;
    if (!suspenseId) {
      const suspense = await prisma.account.findFirst({
        where: { number: { startsWith: '471' }, companyId },
        select: { id: true },
      });
      if (!suspense) return NextResponse.json({ error: 'Compte suspense (471) introuvable. Fournir suspenseAccountId.' }, { status: 400 });
      suspenseId = suspense.id;
    }

    const date = group.sampleDate || new Date();
    const number = await nextSequence(prisma, 'JRN', 'JRN-', companyId);
    const sourceType = 'MANUAL';
    const txs = await prisma.transaction.findMany({
      where: { id: { in: group.transactionIds }, companyId },
    });
    // Safety: ensure all still orphan
    if (txs.some(t => t.journalEntryId)) return NextResponse.json({ error: 'Certaines transactions ne sont plus orphelines.' }, { status: 409 });

    const diff = group.diff; // debit - credit
    const adjustmentNeeded = diff !== 0;
    const result = await prisma.$transaction(async(tx) => {
      const je = await tx.journalEntry.create({
        data: {
          number,
          date,
          sourceType,
          sourceId: null,
          description: description || `OD ${groupKey}`,
          status: 'POSTED',
          companyId,
        },
      });
      // Attach existing tx
      await tx.transaction.updateMany({
        where: { id: { in: group.transactionIds }, companyId },
        data: { journalEntryId: je.id },
      });
      let adjustmentTx = null;
      if (adjustmentNeeded) {
        const amount = Math.abs(diff).toFixed(2);
        // diff > 0 means debit > credit -> need CREDIT; diff < 0 means credit > debit -> need DEBIT
        const direction = diff > 0 ? 'CREDIT' : 'DEBIT';
        adjustmentTx = await tx.transaction.create({
          data: {
            date,
            nature: 'adjustment',
            description: `Ajustement OD ${groupKey}`,
            amount,
            direction,
            kind: 'ADJUSTMENT',
            accountId: suspenseId,
            journalEntryId: je.id,
            companyId,
          }
        });
      }
      return { journalEntryId: je.id, number: je.number, adjustment: adjustmentTx, adjusted: adjustmentNeeded };
    });
    // If form submission, redirect back to OD page for better UX
    if (!contentType.includes('application/json')) {
      return NextResponse.redirect(new URL('/journal/od', request.url), { status: 303 });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    console.error('POST /api/journal-entries/od error', e);
    return NextResponse.json({ error: e.message || 'Erreur création OD' }, { status: 500 });
  }
}
