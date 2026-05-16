import prisma from "@/lib/prisma.js";
import { createJournalEntry } from "@/lib/journal.js";
import { fiscalYearRange } from "@/lib/closing/annual.js";

const EPSILON = 0.01;

export const DEFAULT_PROFIT_ALLOCATION_PARAMS = {
  corporateTaxRate: 0.3,
  minimumTaxRate: 0.01,
  legalReserveRate: 0.1,
  legalReserveCapRate: 0.2,
  irmRate: 0.2,
  taxExpenseAccountNumber: "891000",
  minimumTaxExpenseAccountNumber: "895000",
  taxPayableAccountNumber: "441000",
  legalReserveAccountNumber: "113800",
  statutoryReserveAccountNumber: "113800",
  optionalReserveAccountNumber: "118100",
  retainedEarningsAccountNumber: "121100",
  lossRetainedAccountNumber: "129100",
  dividendsPayableAccountNumber: "465000",
  irmPayableAccountNumber: "447000",
};

function toNumber(value) {
  return (value?.toNumber?.() ?? Number(value ?? 0)) || 0;
}

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function pct(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function amount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, round2(n)) : 0;
}

function accountClass(number) {
  return String(number || "").trim().charAt(0);
}

async function findAccount(tx, companyId, accountNumber, label) {
  const account = await tx.account.findFirst({
    where: { companyId, number: accountNumber },
    select: { id: true, number: true, label: true },
  });
  if (!account) throw new Error(`Compte introuvable pour l'affectation: ${accountNumber} (${label}).`);
  return account;
}

async function loadClosingRows(companyId, year) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, fiscalYearStart: true, currency: true },
  });
  if (!company) throw new Error("Société introuvable.");
  const range = fiscalYearRange(Number(year), company.fiscalYearStart);
  const where = { companyId, date: { gte: range.start, lte: range.end } };
  const [accounts, groups] = await Promise.all([
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
  ]);

  const rowsMap = new Map(
    accounts.map((account) => [
      account.id,
      { ...account, class: accountClass(account.number), debit: 0, credit: 0, net: 0 },
    ])
  );
  for (const group of groups) {
    const row = rowsMap.get(group.accountId);
    if (!row) continue;
    const value = toNumber(group._sum.amount);
    if (group.direction === "DEBIT") row.debit += value;
    if (group.direction === "CREDIT") row.credit += value;
  }
  const rows = [...rowsMap.values()].map((row) => ({
    ...row,
    debit: round2(row.debit),
    credit: round2(row.credit),
    net: round2(row.debit - row.credit),
  }));
  return { company, range, rows };
}

function netCredit(row) {
  if (!row) return 0;
  return Math.max(0, round2(row.credit - row.debit));
}

function netDebit(row) {
  if (!row) return 0;
  return Math.max(0, round2(row.debit - row.credit));
}

async function calculateDividendLines(companyId, dividendsGrossAmount, irmRate) {
  if (dividendsGrossAmount <= EPSILON) return [];
  const subscriptions = await prisma.capitalSubscription.findMany({
    where: { companyId },
    include: {
      shareholder: true,
      capitalOperation: { select: { status: true } },
    },
  });
  const grouped = new Map();
  for (const subscription of subscriptions) {
    if (subscription.capitalOperation?.status === "DRAFT") continue;
    const key = subscription.shareholderId;
    const current = grouped.get(key) || {
      shareholderId: key,
      shareholder: subscription.shareholder,
      basisAmount: 0,
      sharesCount: 0,
    };
    current.basisAmount += toNumber(subscription.nominalAmount);
    current.sharesCount += Number(subscription.sharesCount || 0);
    grouped.set(key, current);
  }
  const holders = [...grouped.values()].filter((item) => item.basisAmount > EPSILON || item.sharesCount > 0);
  const totalBasis = holders.reduce((sum, item) => sum + (item.sharesCount || item.basisAmount), 0);
  if (totalBasis <= EPSILON) return [];

  let grossAllocated = 0;
  return holders.map((item, index) => {
    const basis = item.sharesCount || item.basisAmount;
    const ownershipPct = basis / totalBasis;
    const gross =
      index === holders.length - 1
        ? round2(dividendsGrossAmount - grossAllocated)
        : round2(dividendsGrossAmount * ownershipPct);
    grossAllocated += gross;
    const irm = round2(gross * irmRate);
    return {
      shareholderId: item.shareholderId,
      shareholderName: item.shareholder?.name || "",
      basisAmount: round2(basis),
      ownershipPct,
      grossDividend: gross,
      irmAmount: irm,
      netDividend: round2(gross - irm),
    };
  });
}

export async function calculateProfitAllocation({ companyId, year, input = {} }) {
  const params = { ...DEFAULT_PROFIT_ALLOCATION_PARAMS };
  for (const [key, value] of Object.entries(input || {})) {
    if (value !== undefined && value !== null && value !== "") params[key] = value;
  }
  const corporateTaxRate = pct(params.corporateTaxRate, DEFAULT_PROFIT_ALLOCATION_PARAMS.corporateTaxRate);
  const minimumTaxRate = pct(params.minimumTaxRate, DEFAULT_PROFIT_ALLOCATION_PARAMS.minimumTaxRate);
  const legalReserveRate = pct(params.legalReserveRate, DEFAULT_PROFIT_ALLOCATION_PARAMS.legalReserveRate);
  const legalReserveCapRate = pct(params.legalReserveCapRate, DEFAULT_PROFIT_ALLOCATION_PARAMS.legalReserveCapRate);
  const irmRate = pct(params.irmRate, DEFAULT_PROFIT_ALLOCATION_PARAMS.irmRate);
  const { company, range, rows } = await loadClosingRows(companyId, year);

  const turnover = round2(
    rows
      .filter((row) => row.number?.startsWith("70"))
      .reduce((sum, row) => sum + (row.credit - row.debit), 0)
  );
  const revenues = round2(
    rows
      .filter((row) => row.class === "7")
      .reduce((sum, row) => sum + (row.credit - row.debit), 0)
  );
  const operatingExpenses = round2(
    rows
      .filter((row) => row.class === "6")
      .reduce((sum, row) => sum + (row.debit - row.credit), 0)
  );
  const preTaxResult = round2(revenues - operatingExpenses);
  const corporateTaxMode =
    preTaxResult > EPSILON ? "STANDARD_IS" : preTaxResult < -EPSILON ? "MINIMUM_TURNOVER" : "NONE";
  const taxExpenseAccountNumber =
    corporateTaxMode === "MINIMUM_TURNOVER"
      ? params.minimumTaxExpenseAccountNumber || params.taxExpenseAccountNumber
      : params.taxExpenseAccountNumber;
  const corporateTaxAmount =
    corporateTaxMode === "STANDARD_IS"
      ? round2(preTaxResult * corporateTaxRate)
      : corporateTaxMode === "MINIMUM_TURNOVER"
        ? round2(Math.max(0, turnover) * minimumTaxRate)
        : 0;
  const netResult = round2(preTaxResult - corporateTaxAmount);

  const priorDebitRetainedEarnings = netDebit(rows.find((row) => row.number === params.lossRetainedAccountNumber));
  const priorCreditRetainedEarnings = netCredit(rows.find((row) => row.number === params.retainedEarningsAccountNumber));
  const legalReserveCurrent = netCredit(rows.find((row) => row.number === params.legalReserveAccountNumber));
  const capitalLedgerAmount = rows
    .filter((row) => row.number?.startsWith("101"))
    .reduce((sum, row) => sum + (row.credit - row.debit), 0);
  const capitalOperationsAmount = toNumber(
    await prisma.capitalOperation
      .aggregate({
        where: { companyId, status: { in: ["OPEN", "CLOSED", "REGISTERED"] } },
        _sum: { nominalTarget: true },
      })
      .then((result) => result._sum.nominalTarget)
  );
  const capitalAmount = round2(Math.max(0, capitalLedgerAmount, capitalOperationsAmount));
  const legalReserveCap = round2(capitalAmount * legalReserveCapRate);

  let legalReserveBase = 0;
  let legalReserveAmount = 0;
  let distributableProfit = 0;
  const statutoryReserveAmount = amount(params.statutoryReserveAmount);
  const optionalReserveAmount = amount(params.optionalReserveAmount);
  const dividendsGrossAmount = amount(params.dividendsGrossAmount);
  let retainedEarningsAmount = netResult;

  if (netResult > EPSILON) {
    legalReserveBase = Math.max(0, round2(netResult - priorDebitRetainedEarnings));
    const legalReserveRemainingCap = Math.max(0, round2(legalReserveCap - legalReserveCurrent));
    legalReserveAmount = Math.min(round2(legalReserveBase * legalReserveRate), legalReserveRemainingCap, legalReserveBase);
    distributableProfit = round2(
      legalReserveBase - legalReserveAmount - statutoryReserveAmount + priorCreditRetainedEarnings
    );
    retainedEarningsAmount = round2(distributableProfit - optionalReserveAmount - dividendsGrossAmount);
  }

  const irmAmount = round2(dividendsGrossAmount * irmRate);
  const dividendsNetAmount = round2(dividendsGrossAmount - irmAmount);
  const dividendLines = await calculateDividendLines(companyId, dividendsGrossAmount, irmRate);

  const anomalies = [];
  if (statutoryReserveAmount > legalReserveBase - legalReserveAmount + EPSILON) {
    anomalies.push("Les réserves statutaires dépassent le solde disponible après réserve légale.");
  }
  if (retainedEarningsAmount < -EPSILON && netResult > EPSILON) {
    anomalies.push("Les réserves facultatives et dividendes dépassent le bénéfice distribuable.");
  }
  if (dividendsGrossAmount > EPSILON && !dividendLines.length) {
    anomalies.push("Dividendes demandés, mais aucune base de répartition associée aux associés n'est disponible.");
  }

  return {
    ok: anomalies.length === 0,
    company,
    year: Number(year),
    range: {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      nextStart: range.nextStart.toISOString(),
    },
    params: {
      ...params,
      taxExpenseAccountNumber,
      corporateTaxRate,
      minimumTaxRate,
      legalReserveRate,
      legalReserveCapRate,
      irmRate,
    },
    result: {
      turnover,
      revenues,
      operatingExpenses,
      preTaxResult,
      corporateTaxMode,
      corporateTaxAmount,
      netResult,
      priorDebitRetainedEarnings,
      priorCreditRetainedEarnings,
      capitalAmount,
      legalReserveCurrent,
      legalReserveCap,
      legalReserveBase,
      legalReserveAmount: round2(legalReserveAmount),
      statutoryReserveAmount,
      optionalReserveAmount,
      distributableProfit,
      dividendsGrossAmount,
      irmAmount,
      dividendsNetAmount,
      retainedEarningsAmount: round2(retainedEarningsAmount),
    },
    dividendLines,
    anomalies,
  };
}

export async function approveProfitAllocation({ companyId, year, input = {} }) {
  const existingClosing = await prisma.fiscalYearClosing.findUnique({
    where: { companyId_year: { companyId, year: Number(year) } },
    select: { status: true },
  });
  if (existingClosing?.status === "CLOSED") {
    const error = new Error("L'affectation ne peut plus être modifiée: l'exercice est déjà clôturé.");
    error.status = 400;
    throw error;
  }
  const simulation = await calculateProfitAllocation({ companyId, year, input });
  if (!simulation.ok) {
    const error = new Error(simulation.anomalies.join(" "));
    error.status = 400;
    throw error;
  }
  const params = simulation.params;
  const result = simulation.result;
  const date = new Date(simulation.range.end);

  return prisma.$transaction(async (tx) => {
    let taxJournalEntry = null;
    if (result.corporateTaxAmount > EPSILON) {
      const taxExpense = await findAccount(tx, companyId, params.taxExpenseAccountNumber, "Charge d'impôt société");
      const taxPayable = await findAccount(tx, companyId, params.taxPayableAccountNumber, "Impôt société à payer");
      const existingTaxJournal = await tx.journalEntry.findFirst({
        where: {
          companyId,
          sourceType: "OTHER",
          sourceId: `CORP-TAX-${year}`,
        },
      });
      if (existingTaxJournal) {
        taxJournalEntry = existingTaxJournal;
      } else {
        const debit = await tx.transaction.create({
          data: {
            companyId,
            date,
            description: `Impôt société exercice ${year}`,
            amount: result.corporateTaxAmount,
            direction: "DEBIT",
            kind: "ADJUSTMENT",
            accountId: taxExpense.id,
          },
        });
        const credit = await tx.transaction.create({
          data: {
            companyId,
            date,
            description: `Impôt société à payer exercice ${year}`,
            amount: result.corporateTaxAmount,
            direction: "CREDIT",
            kind: "ADJUSTMENT",
            accountId: taxPayable.id,
          },
        });
        taxJournalEntry = await createJournalEntry(tx, {
          sourceType: "OTHER",
          sourceId: `CORP-TAX-${year}`,
          supportRef: `IS-${year}`,
          date,
          transactionIds: [debit.id, credit.id],
          description: `Impôt société exercice ${year}`,
        });
      }
    }

    await findAccount(tx, companyId, params.legalReserveAccountNumber, "Réserve légale");
    await findAccount(tx, companyId, params.optionalReserveAccountNumber, "Réserves facultatives");
    await findAccount(tx, companyId, params.retainedEarningsAccountNumber, "Report à nouveau créditeur");
    await findAccount(tx, companyId, params.lossRetainedAccountNumber, "Perte à reporter");
    await findAccount(tx, companyId, params.dividendsPayableAccountNumber, "Dividendes à payer");
    await findAccount(tx, companyId, params.irmPayableAccountNumber, "IRM à reverser");
    if (result.statutoryReserveAmount > EPSILON) {
      await findAccount(
        tx,
        companyId,
        params.statutoryReserveAccountNumber || params.optionalReserveAccountNumber,
        "Réserve statutaire"
      );
    }

    const decision = await tx.profitAllocationDecision.upsert({
      where: { companyId_year: { companyId, year: Number(year) } },
      update: {
        status: "APPROVED",
        decisionDate: input.decisionDate ? new Date(input.decisionDate) : new Date(),
        agoReference: input.agoReference?.toString?.().trim() || null,
        preTaxResult: result.preTaxResult,
        turnover: result.turnover,
        corporateTaxMode: result.corporateTaxMode,
        corporateTaxRate: params.corporateTaxRate,
        minimumTaxRate: params.minimumTaxRate,
        corporateTaxAmount: result.corporateTaxAmount,
        netResult: result.netResult,
        priorDebitRetainedEarnings: result.priorDebitRetainedEarnings,
        priorCreditRetainedEarnings: result.priorCreditRetainedEarnings,
        capitalAmount: result.capitalAmount,
        legalReserveCurrent: result.legalReserveCurrent,
        legalReserveCap: result.legalReserveCap,
        legalReserveRate: params.legalReserveRate,
        legalReserveAmount: result.legalReserveAmount,
        statutoryReserveAmount: result.statutoryReserveAmount,
        optionalReserveAmount: result.optionalReserveAmount,
        distributableProfit: result.distributableProfit,
        dividendsGrossAmount: result.dividendsGrossAmount,
        irmRate: params.irmRate,
        irmAmount: result.irmAmount,
        dividendsNetAmount: result.dividendsNetAmount,
        retainedEarningsAmount: result.retainedEarningsAmount,
        taxExpenseAccountNumber: params.taxExpenseAccountNumber,
        taxPayableAccountNumber: params.taxPayableAccountNumber,
        legalReserveAccountNumber: params.legalReserveAccountNumber,
        statutoryReserveAccountNumber: params.statutoryReserveAccountNumber || null,
        optionalReserveAccountNumber: params.optionalReserveAccountNumber,
        retainedEarningsAccountNumber: params.retainedEarningsAccountNumber,
        lossRetainedAccountNumber: params.lossRetainedAccountNumber,
        dividendsPayableAccountNumber: params.dividendsPayableAccountNumber,
        irmPayableAccountNumber: params.irmPayableAccountNumber,
        taxJournalEntryId: taxJournalEntry?.id || null,
        meta: { legalReserveCapRate: params.legalReserveCapRate },
      },
      create: {
        companyId,
        year: Number(year),
        status: "APPROVED",
        decisionDate: input.decisionDate ? new Date(input.decisionDate) : new Date(),
        agoReference: input.agoReference?.toString?.().trim() || null,
        preTaxResult: result.preTaxResult,
        turnover: result.turnover,
        corporateTaxMode: result.corporateTaxMode,
        corporateTaxRate: params.corporateTaxRate,
        minimumTaxRate: params.minimumTaxRate,
        corporateTaxAmount: result.corporateTaxAmount,
        netResult: result.netResult,
        priorDebitRetainedEarnings: result.priorDebitRetainedEarnings,
        priorCreditRetainedEarnings: result.priorCreditRetainedEarnings,
        capitalAmount: result.capitalAmount,
        legalReserveCurrent: result.legalReserveCurrent,
        legalReserveCap: result.legalReserveCap,
        legalReserveRate: params.legalReserveRate,
        legalReserveAmount: result.legalReserveAmount,
        statutoryReserveAmount: result.statutoryReserveAmount,
        optionalReserveAmount: result.optionalReserveAmount,
        distributableProfit: result.distributableProfit,
        dividendsGrossAmount: result.dividendsGrossAmount,
        irmRate: params.irmRate,
        irmAmount: result.irmAmount,
        dividendsNetAmount: result.dividendsNetAmount,
        retainedEarningsAmount: result.retainedEarningsAmount,
        taxExpenseAccountNumber: params.taxExpenseAccountNumber,
        taxPayableAccountNumber: params.taxPayableAccountNumber,
        legalReserveAccountNumber: params.legalReserveAccountNumber,
        statutoryReserveAccountNumber: params.statutoryReserveAccountNumber || null,
        optionalReserveAccountNumber: params.optionalReserveAccountNumber,
        retainedEarningsAccountNumber: params.retainedEarningsAccountNumber,
        lossRetainedAccountNumber: params.lossRetainedAccountNumber,
        dividendsPayableAccountNumber: params.dividendsPayableAccountNumber,
        irmPayableAccountNumber: params.irmPayableAccountNumber,
        taxJournalEntryId: taxJournalEntry?.id || null,
        meta: { legalReserveCapRate: params.legalReserveCapRate },
      },
    });

    await tx.dividendAllocationLine.deleteMany({ where: { decisionId: decision.id } });
    if (simulation.dividendLines.length) {
      await tx.dividendAllocationLine.createMany({
        data: simulation.dividendLines.map((line) => ({
          companyId,
          decisionId: decision.id,
          shareholderId: line.shareholderId,
          basisAmount: line.basisAmount,
          ownershipPct: line.ownershipPct,
          grossDividend: line.grossDividend,
          irmAmount: line.irmAmount,
          netDividend: line.netDividend,
        })),
      });
    }

    return tx.profitAllocationDecision.findUnique({
      where: { id: decision.id },
      include: { lines: { include: { shareholder: true } }, taxJournalEntry: true },
    });
  });
}
