function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function findClosedFiscalYear(client, { companyId, date }) {
  const checkedDate = toDate(date);
  if (!companyId || !checkedDate) return null;
  return client.fiscalYearClosing.findFirst({
    where: {
      companyId,
      status: "CLOSED",
      startDate: { lte: checkedDate },
      endDate: { gte: checkedDate },
    },
    select: {
      id: true,
      year: true,
      startDate: true,
      endDate: true,
      openingJournalEntryId: true,
    },
  });
}

export async function assertAccountingPeriodOpen(
  client,
  { companyId, date, context = "ecriture comptable" }
) {
  const closing = await findClosedFiscalYear(client, { companyId, date });
  if (!closing) return;
  throw new Error(
    `${context} refusee: l'exercice ${closing.year} est cloture.`
  );
}

export async function assertAccountingDatesOpen(client, checks) {
  for (const check of checks) {
    await assertAccountingPeriodOpen(client, check);
  }
}
