export async function deleteUnreferencedEmptyJournals(tx, where = {}) {
  return tx.journalEntry.deleteMany({
    where: {
      ...where,
      lines: { none: {} },
      depreciationLines: { none: {} },
      assetDisposals: { none: {} },
      inventoryCountLines: { none: {} },
      capitalPayments: { none: {} },
    },
  });
}

export async function deleteUnreferencedEmptyJournalsForSource(tx, {
  companyId = null,
  sourceType,
  sourceId,
}) {
  return deleteUnreferencedEmptyJournals(tx, {
    ...(companyId ? { companyId } : {}),
    sourceType,
    sourceId,
  });
}

export async function deleteUnreferencedEmptyJournalsByIds(tx, ids = [], companyId = null) {
  if (!ids.length) return { count: 0 };
  return deleteUnreferencedEmptyJournals(tx, {
    id: { in: ids },
    ...(companyId ? { companyId } : {}),
  });
}
