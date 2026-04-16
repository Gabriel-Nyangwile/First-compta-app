import { isPayrollSettlementDescription } from './settlement-config.js';

function isPayrollReversalDescription(description) {
  return description?.includes('Annulation paie');
}

export function isBasePayrollJournal(journal) {
  return !!journal && !isPayrollSettlementDescription(journal.description) && !isPayrollReversalDescription(journal.description);
}

export async function listPayrollJournals(db, periodId, companyId = null, select = null) {
  return db.journalEntry.findMany({
    where: {
      sourceType: 'PAYROLL',
      sourceId: periodId,
      ...(companyId ? { companyId } : {}),
    },
    select: select || undefined,
    orderBy: [{ date: 'desc' }, { number: 'desc' }, { id: 'desc' }],
  });
}

export async function getCurrentPayrollJournal(db, periodId, companyId = null, select = null) {
  const journals = await listPayrollJournals(
    db,
    periodId,
    companyId,
    select || { id: true, number: true, date: true, description: true, sourceId: true, companyId: true }
  );
  return journals.find((journal) => isBasePayrollJournal(journal)) || null;
}

export async function listCurrentPayrollScopeJournals(db, periodId, companyId = null, select = null) {
  const journals = await listPayrollJournals(
    db,
    periodId,
    companyId,
    select || { id: true, number: true, date: true, description: true, sourceId: true, companyId: true }
  );
  const current = journals.find((journal) => isBasePayrollJournal(journal)) || null;
  return journals.filter((journal) => journal.id === current?.id || isPayrollSettlementDescription(journal.description));
}

export { isPayrollReversalDescription };