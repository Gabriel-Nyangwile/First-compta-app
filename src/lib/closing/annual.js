import prisma from "@/lib/prisma.js";
import { createJournalEntry } from "@/lib/journal.js";

const EPSILON = 0.01;

function toNumber(value) {
  return (value?.toNumber?.() ?? Number(value ?? 0)) || 0;
}

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function parseFiscalYearStart(value) {
  const raw = String(value || "01-01").trim();
  const match = raw.match(/^(\d{2})-(\d{2})$/);
  if (!match) return { month: 1, day: 1, raw: "01-01" };
  const month = Math.min(12, Math.max(1, Number(match[1])));
  const day = Math.min(31, Math.max(1, Number(match[2])));
  return { month, day, raw };
}

function fiscalYearRange(year, fiscalYearStart) {
  const startInfo = parseFiscalYearStart(fiscalYearStart);
  const start = new Date(year, startInfo.month - 1, startInfo.day, 0, 0, 0, 0);
  const nextStart = new Date(year + 1, startInfo.month - 1, startInfo.day, 0, 0, 0, 0);
  const end = new Date(nextStart.getTime() - 1);
  return { start, end, nextStart, fiscalYearStart: startInfo.raw };
}

function accountClass(number) {
  return String(number || "").trim().charAt(0);
}

function directionForNet(net) {
  return net >= 0 ? "DEBIT" : "CREDIT";
}

function amountForNet(net) {
  return round2(Math.abs(net));
}

export function annualOpeningDescription(year) {
  return `A-nouveaux ${year + 1} depuis cloture ${year}`;
}

export async function calculateAnnualClosing({
  companyId,
  year,
  profitAccountNumber = "121100",
  lossAccountNumber = "129100",
}) {
  if (!companyId) throw new Error("companyId requis.");
  const numericYear = Number(year);
  if (!Number.isInteger(numericYear) || numericYear < 1900) {
    throw new Error("Exercice invalide.");
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, fiscalYearStart: true, currency: true },
  });
  if (!company) throw new Error("Societe introuvable.");

  const range = fiscalYearRange(numericYear, company.fiscalYearStart);
  const where = {
    companyId,
    date: {
      gte: range.start,
      lte: range.end,
    },
  };

  const [accounts, groups, existingOpening, existingClosing] = await Promise.all([
    prisma.account.findMany({
      where: { companyId },
      select: { id: true, number: true, label: true },
      orderBy: { number: "asc" },
    }),
    prisma.transaction.groupBy({
      where,
      by: ["accountId", "direction"],
      _sum: { amount: true },
    }),
    prisma.journalEntry.findFirst({
      where: {
        companyId,
        OR: [
          { sourceId: `CLOSING-${numericYear}` },
          {
            sourceType: "OTHER",
            date: range.nextStart,
            description: annualOpeningDescription(numericYear),
          },
        ],
      },
      select: { id: true, number: true, date: true },
    }),
    prisma.fiscalYearClosing.findUnique({
      where: { companyId_year: { companyId, year: numericYear } },
      select: {
        id: true,
        year: true,
        status: true,
        startDate: true,
        endDate: true,
        openingDate: true,
        openingJournalEntryId: true,
        closedAt: true,
        reopenedAt: true,
        note: true,
        openingJournalEntry: {
          select: {
            id: true,
            number: true,
            date: true,
            description: true,
          },
        },
      },
    }),
  ]);

  const rowsMap = new Map(
    accounts.map((account) => [
      account.id,
      {
        accountId: account.id,
        number: account.number,
        label: account.label,
        class: accountClass(account.number),
        debit: 0,
        credit: 0,
        net: 0,
      },
    ])
  );

  for (const group of groups) {
    const row = rowsMap.get(group.accountId);
    if (!row) continue;
    const amount = toNumber(group._sum.amount);
    if (group.direction === "DEBIT") row.debit += amount;
    if (group.direction === "CREDIT") row.credit += amount;
  }

  const rows = [...rowsMap.values()]
    .map((row) => ({
      ...row,
      debit: round2(row.debit),
      credit: round2(row.credit),
      net: round2(row.debit - row.credit),
    }))
    .filter((row) => Math.abs(row.debit) > EPSILON || Math.abs(row.credit) > EPSILON);

  const totalDebit = round2(rows.reduce((sum, row) => sum + row.debit, 0));
  const totalCredit = round2(rows.reduce((sum, row) => sum + row.credit, 0));
  const ledgerDiff = round2(totalDebit - totalCredit);
  const balanceRows = rows.filter((row) => ["1", "2", "3", "4", "5"].includes(row.class));
  const profitLossRows = rows.filter((row) => ["6", "7"].includes(row.class));

  const expenses = round2(
    rows
      .filter((row) => row.class === "6")
      .reduce((sum, row) => sum + (row.debit - row.credit), 0)
  );
  const revenues = round2(
    rows
      .filter((row) => row.class === "7")
      .reduce((sum, row) => sum + (row.credit - row.debit), 0)
  );
  const result = round2(revenues - expenses);
  const balanceNet = round2(balanceRows.reduce((sum, row) => sum + row.net, 0));

  const openingRows = balanceRows
    .filter((row) => Math.abs(row.net) > EPSILON)
    .map((row) => ({
      accountId: row.accountId,
      number: row.number,
      label: row.label,
      net: row.net,
      direction: directionForNet(row.net),
      amount: amountForNet(row.net),
    }));

  const resultDirection = balanceNet > 0 ? "CREDIT" : "DEBIT";
  const resultAmount = amountForNet(balanceNet);
  const requiredResultAccountNumber =
    balanceNet > 0 ? profitAccountNumber : lossAccountNumber;
  const requiredResultAccount =
    resultAmount > EPSILON
      ? await prisma.account.findFirst({
          where: { companyId, number: requiredResultAccountNumber },
          select: { id: true, number: true, label: true },
        })
      : null;
  const anomalies = [];
  if (!rows.length) anomalies.push("Aucune ecriture detectee sur l'exercice.");
  if (Math.abs(ledgerDiff) > EPSILON) anomalies.push(`Journal non equilibre: ecart ${ledgerDiff.toFixed(2)}.`);
  if (existingOpening) anomalies.push(`A-nouveaux deja generes: ${existingOpening.number}.`);
  if (existingClosing?.status === "CLOSED") anomalies.push(`Exercice ${numericYear} deja cloture.`);
  if (resultAmount > EPSILON && !requiredResultAccount) {
    anomalies.push(`Compte de resultat introuvable: ${requiredResultAccountNumber}.`);
  }

  return {
    ok: anomalies.length === 0,
    company,
    year: numericYear,
    range: {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      nextStart: range.nextStart.toISOString(),
      fiscalYearStart: range.fiscalYearStart,
    },
    totals: {
      totalDebit,
      totalCredit,
      ledgerDiff,
      expenses,
      revenues,
      result,
      balanceNet,
    },
    counts: {
      accounts: rows.length,
      balanceAccounts: openingRows.length,
      profitLossAccounts: profitLossRows.length,
    },
    existingOpening,
    existingClosing: existingClosing
      ? {
          ...existingClosing,
          startDate: existingClosing.startDate.toISOString(),
          endDate: existingClosing.endDate.toISOString(),
          openingDate: existingClosing.openingDate.toISOString(),
          closedAt: existingClosing.closedAt.toISOString(),
          reopenedAt: existingClosing.reopenedAt?.toISOString() || null,
          openingJournalEntry: existingClosing.openingJournalEntry
            ? {
                ...existingClosing.openingJournalEntry,
                date: existingClosing.openingJournalEntry.date.toISOString(),
              }
            : null,
        }
      : null,
    anomalies,
    opening: {
      description: annualOpeningDescription(numericYear),
      date: range.nextStart.toISOString(),
      rows: openingRows,
      result: {
        direction: resultDirection,
        amount: resultAmount,
        accountNumber: requiredResultAccountNumber,
        account: requiredResultAccount,
      },
    },
  };
}

async function resolveResultAccount(tx, { companyId, resultAccountNumber, resultAccountLabel }) {
  const account = await tx.account.findFirst({
    where: { companyId, number: resultAccountNumber },
    select: { id: true, number: true, label: true },
  });
  if (!account) {
    throw new Error(`Compte de resultat introuvable: ${resultAccountNumber}`);
  }
  return {
    ...account,
    label: account.label || resultAccountLabel,
  };
}

export async function generateAnnualOpening({
  companyId,
  year,
  profitAccountNumber = "121100",
  lossAccountNumber = "129100",
}) {
  const analysis = await calculateAnnualClosing({
    companyId,
    year,
    profitAccountNumber,
    lossAccountNumber,
  });
  if (analysis.existingOpening) {
    throw new Error(`A-nouveaux deja generes: ${analysis.existingOpening.number}`);
  }
  if (analysis.existingClosing?.status === "CLOSED") {
    throw new Error(`Exercice ${year} deja cloture.`);
  }
  if (Math.abs(analysis.totals.ledgerDiff) > EPSILON) {
    throw new Error("Impossible de generer les a-nouveaux: journal non equilibre.");
  }
  if (!analysis.opening.rows.length) {
    throw new Error("Aucun compte de bilan a reporter.");
  }

  const resultAccountNumber =
    analysis.totals.balanceNet > 0 ? profitAccountNumber : lossAccountNumber;
  const resultAccountLabel =
    analysis.totals.balanceNet > 0 ? "Resultat beneficiaire" : "Resultat deficitaire";
  const openingDate = new Date(analysis.range.nextStart);

  const created = await prisma.$transaction(async (tx) => {
    const needsResultAccount = analysis.opening.result.amount > EPSILON;
    const resultAccount = needsResultAccount
      ? await resolveResultAccount(tx, {
          companyId,
          resultAccountNumber,
          resultAccountLabel,
        })
      : null;
    const transactionIds = [];
    for (const row of analysis.opening.rows) {
      const transaction = await tx.transaction.create({
        data: {
          companyId,
          date: openingDate,
          description: `${analysis.opening.description} ${row.number}`,
          amount: row.amount,
          direction: row.direction,
          kind: "ADJUSTMENT",
          accountId: row.accountId,
        },
      });
      transactionIds.push(transaction.id);
    }

    if (needsResultAccount) {
      const resultTransaction = await tx.transaction.create({
        data: {
          companyId,
          date: openingDate,
          description: `${analysis.opening.description} resultat`,
          amount: analysis.opening.result.amount,
          direction: analysis.opening.result.direction,
          kind: "ADJUSTMENT",
          accountId: resultAccount.id,
        },
      });
      transactionIds.push(resultTransaction.id);
    }

    const journalEntry = await createJournalEntry(tx, {
      sourceType: "OTHER",
      sourceId: `CLOSING-${analysis.year}`,
      supportRef: `CLOTURE-${analysis.year}`,
      date: openingDate,
      transactionIds,
      description: analysis.opening.description,
    });
    const fiscalYearClosing = await tx.fiscalYearClosing.create({
      data: {
        companyId,
        year: analysis.year,
        startDate: new Date(analysis.range.start),
        endDate: new Date(analysis.range.end),
        openingDate,
        openingJournalEntryId: journalEntry.id,
        status: "CLOSED",
        note: `Cloture ${analysis.year} et a-nouveaux ${analysis.year + 1}`,
      },
    });
    return {
      journalEntry: {
        id: journalEntry.id,
        number: journalEntry.number,
        date: journalEntry.date.toISOString(),
        description: journalEntry.description,
      },
      fiscalYearClosing: {
        id: fiscalYearClosing.id,
        year: fiscalYearClosing.year,
        status: fiscalYearClosing.status,
        startDate: fiscalYearClosing.startDate.toISOString(),
        endDate: fiscalYearClosing.endDate.toISOString(),
        openingDate: fiscalYearClosing.openingDate.toISOString(),
        openingJournalEntryId: fiscalYearClosing.openingJournalEntryId,
        closedAt: fiscalYearClosing.closedAt.toISOString(),
        reopenedAt: fiscalYearClosing.reopenedAt?.toISOString() || null,
        note: fiscalYearClosing.note,
      },
      transactionsCreated: transactionIds.length,
      resultAccount,
    };
  });

  return {
    ok: true,
    ...analysis,
    generated: created,
  };
}
