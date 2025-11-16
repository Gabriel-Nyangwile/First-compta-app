import React from 'react';
import prisma from '@/lib/prisma';

async function loadOrphanGroups() {
  const orphan = await prisma.transaction.findMany({ where: { journalEntryId: null }, orderBy: { date: 'asc' } });
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
    groups.push({ key, debit, credit, diff: Number((debit - credit).toFixed(2)), count: list.length });
  }
  return groups;
}

export default async function ODPage() {
  const groups = await loadOrphanGroups();
  return (
    <div style={{ padding: '1rem' }}>
      <h1>Opérations Diverses – Orphelins</h1>
      <p>Permet de rattacher des transactions orphelines au journal en créant si nécessaire une ligne d'ajustement (compte 471).</p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Groupe</th><th>Débit</th><th>Crédit</th><th>Diff (D-C)</th><th>Lignes</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(g => {
            const balanced = g.diff === 0;
            return (
              <tr key={g.key} style={{ background: balanced ? '#f0fff0' : '#fff8e1' }}>
                <td style={{ fontFamily: 'monospace' }}>{g.key}</td>
                <td style={{ textAlign: 'right' }}>{g.debit.toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>{g.credit.toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>{g.diff.toFixed(2)}</td>
                <td style={{ textAlign: 'center' }}>{g.count}</td>
                <td>
                  <form action="/api/journal-entries/od" method="post" style={{ display: 'inline' }}>
                    <input type="hidden" name="groupKey" value={g.key} />
                    <button type="submit">{balanced ? 'Rattacher' : 'Ajuster & Rattacher'}</button>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{ marginTop: '1rem' }}><a href="/journal">Retour Journal</a></p>
    </div>
  );
}
