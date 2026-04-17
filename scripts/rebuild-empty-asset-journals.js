#!/usr/bin/env node
import prisma from "../src/lib/prisma.js";
import { resolveCategoryAccounts } from "../src/lib/assets.js";

function parseArgs(argv) {
  const args = argv.slice(2);
  const getValue = (flag) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : null;
  };
  const companyId = getValue("--companyId");
  const all = args.includes("--all");
  const apply = args.includes("--apply");
  const dryRun = args.includes("--dry-run") || !apply;
  const limitRaw = Number(getValue("--limit"));
  return {
    companyId,
    all,
    dryRun,
    limit: Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 25,
  };
}

function toNumber(value) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return value?.toNumber?.() ?? Number(value) ?? 0;
}

function round2(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

async function resolveCompanies({ companyId, all }) {
  if (companyId) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true },
    });
    if (!company) throw new Error(`companyId introuvable: ${companyId}`);
    return [company];
  }
  if (!all) {
    throw new Error("Usage: --companyId <id> ou --all");
  }
  return prisma.company.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

async function resolveOffsetAccountId(tx, companyId) {
  const accountNumber = process.env.OPENING_OFFSET_ACCOUNT || "471000";
  let account = await tx.account.findFirst({
    where: { companyId, number: accountNumber },
    select: { id: true },
  });
  if (!account) {
    account = await tx.account.create({
      data: {
        companyId,
        number: accountNumber,
        label: "Compte d'attente ouverture",
      },
      select: { id: true },
    });
  }
  return account.id;
}

async function createAssetOpeningTransactions(tx, journal) {
  const line = journal.depreciationLines[0];
  const asset = line?.asset;
  if (!asset?.category) {
    return { status: "missing_asset_category" };
  }
  const openingAccumulated = round2(asset.meta?.openingAccumulated || line.amount || 0);
  const netBookValue = round2(asset.meta?.openingNetBookValue || toNumber(asset.cost) - openingAccumulated);
  const cost = round2(asset.cost);
  if (!(cost > 0)) return { status: "invalid_asset_cost" };

  const accounts = await resolveCategoryAccounts(asset.category, tx);
  const offsetAccountId = await resolveOffsetAccountId(tx, asset.companyId);
  const description = journal.description || `Ouverture immobilisation ${asset.ref || asset.id}`;
  const date = journal.date || new Date();
  const createdIds = [];

  const debit = await tx.transaction.create({
    data: {
      companyId: asset.companyId,
      date,
      description,
      amount: cost,
      direction: "DEBIT",
      kind: "ASSET_ACQUISITION",
      accountId: accounts.asset,
      journalEntryId: journal.id,
    },
    select: { id: true },
  });
  createdIds.push(debit.id);

  if (openingAccumulated > 0) {
    const reserve = await tx.transaction.create({
      data: {
        companyId: asset.companyId,
        date,
        description,
        amount: openingAccumulated,
        direction: "CREDIT",
        kind: "ASSET_DEPRECIATION_RESERVE",
        accountId: accounts.depreciation,
        journalEntryId: journal.id,
      },
      select: { id: true },
    });
    createdIds.push(reserve.id);
  }

  if (netBookValue > 0) {
    const offset = await tx.transaction.create({
      data: {
        companyId: asset.companyId,
        date,
        description,
        amount: netBookValue,
        direction: "CREDIT",
        kind: "ADJUSTMENT",
        accountId: offsetAccountId,
        journalEntryId: journal.id,
      },
      select: { id: true },
    });
    createdIds.push(offset.id);
  }

  return { status: "rebuilt_opening_asset", transactionIds: createdIds };
}

async function createDepreciationTransactions(tx, journal) {
  const lines = journal.depreciationLines;
  if (!lines.length) return { status: "missing_depreciation_lines" };
  const description = journal.description || "Dotation amortissement";
  const date = journal.date || new Date();

  const expenseMap = new Map();
  const reserveMap = new Map();
  for (const line of lines) {
    const asset = line.asset;
    if (!asset?.category) return { status: "missing_asset_category" };
    const accounts = await resolveCategoryAccounts(asset.category, tx);
    const amount = round2(line.amount);
    if (!(amount > 0)) continue;
    expenseMap.set(accounts.expense, (expenseMap.get(accounts.expense) || 0) + amount);
    reserveMap.set(accounts.depreciation, (reserveMap.get(accounts.depreciation) || 0) + amount);
  }

  const createdIds = [];
  for (const [accountId, amount] of expenseMap.entries()) {
    const row = await tx.transaction.create({
      data: {
        companyId: journal.companyId,
        date,
        description,
        amount: round2(amount),
        direction: "DEBIT",
        kind: "ASSET_DEPRECIATION_EXPENSE",
        accountId,
        journalEntryId: journal.id,
      },
      select: { id: true },
    });
    createdIds.push(row.id);
  }

  for (const [accountId, amount] of reserveMap.entries()) {
    const row = await tx.transaction.create({
      data: {
        companyId: journal.companyId,
        date,
        description,
        amount: round2(amount),
        direction: "CREDIT",
        kind: "ASSET_DEPRECIATION_RESERVE",
        accountId,
        journalEntryId: journal.id,
      },
      select: { id: true },
    });
    createdIds.push(row.id);
  }

  return createdIds.length
    ? { status: "rebuilt_depreciation", transactionIds: createdIds }
    : { status: "zero_amount" };
}

async function createDisposalTransactions(tx, journal) {
  const disposal = journal.assetDisposals[0];
  const asset = disposal?.asset;
  if (!asset?.category) return { status: "missing_asset_category" };

  const accounts = await resolveCategoryAccounts(asset.category, tx);
  const proceedAccountNumber =
    disposal.meta?.proceedAccountNumber ||
    disposal.meta?.proceedAccount ||
    process.env.ASSET_DISPOSAL_PROCEED_ACCOUNT ||
    "512000";
  let proceedAccount = await tx.account.findFirst({
    where: { companyId: asset.companyId, number: String(proceedAccountNumber) },
    select: { id: true },
  });
  if (!proceedAccount) {
    proceedAccount = await tx.account.create({
      data: {
        companyId: asset.companyId,
        number: String(proceedAccountNumber),
        label: "Produit de cession",
      },
      select: { id: true },
    });
  }

  const description = journal.description || `Cession immobilisation ${asset.ref || asset.id}`;
  const date = disposal.date || journal.date || new Date();
  const proceed = round2(disposal.proceed);
  const cost = round2(asset.cost);
  const cumulative = round2(
    asset.depreciationLines.reduce((sum, line) => sum + toNumber(line.amount), 0)
  );
  const gainLoss = round2(disposal.gainLoss);
  const createdIds = [];

  if (proceed > 0) {
    const entry = await tx.transaction.create({
      data: {
        companyId: asset.companyId,
        date,
        description,
        amount: proceed,
        direction: "DEBIT",
        kind: "ASSET_DISPOSAL_GAIN",
        accountId: proceedAccount.id,
        journalEntryId: journal.id,
      },
      select: { id: true },
    });
    createdIds.push(entry.id);
  }

  if (cumulative > 0) {
    const reserve = await tx.transaction.create({
      data: {
        companyId: asset.companyId,
        date,
        description,
        amount: cumulative,
        direction: "DEBIT",
        kind: "ASSET_DEPRECIATION_RESERVE",
        accountId: accounts.depreciation,
        journalEntryId: journal.id,
      },
      select: { id: true },
    });
    createdIds.push(reserve.id);
  }

  const assetOut = await tx.transaction.create({
    data: {
      companyId: asset.companyId,
      date,
      description,
      amount: cost,
      direction: "CREDIT",
      kind: "ASSET_CLEARING",
      accountId: accounts.asset,
      journalEntryId: journal.id,
    },
    select: { id: true },
  });
  createdIds.push(assetOut.id);

  if (gainLoss > 0) {
    if (!accounts.gain) return { status: "missing_gain_account_partial", transactionIds: createdIds };
    const gain = await tx.transaction.create({
      data: {
        companyId: asset.companyId,
        date,
        description,
        amount: gainLoss,
        direction: "CREDIT",
        kind: "ASSET_DISPOSAL_GAIN",
        accountId: accounts.gain,
        journalEntryId: journal.id,
      },
      select: { id: true },
    });
    createdIds.push(gain.id);
  } else if (gainLoss < 0) {
    if (!accounts.loss) return { status: "missing_loss_account_partial", transactionIds: createdIds };
    const loss = await tx.transaction.create({
      data: {
        companyId: asset.companyId,
        date,
        description,
        amount: Math.abs(gainLoss),
        direction: "DEBIT",
        kind: "ASSET_DISPOSAL_LOSS",
        accountId: accounts.loss,
        journalEntryId: journal.id,
      },
      select: { id: true },
    });
    createdIds.push(loss.id);
  }

  return { status: "rebuilt_disposal", transactionIds: createdIds };
}

function classifyAssetJournal(journal) {
  if (journal._count.assetDisposals > 0) return "disposal";
  if (!journal._count.depreciationLines) return "unsupported";
  if (journal.description?.startsWith("Ouverture immobilisation")) return "opening";
  return "depreciation";
}

async function processCompany(company, options) {
  const journals = await prisma.journalEntry.findMany({
    where: {
      companyId: company.id,
      sourceType: "ASSET",
      lines: { none: {} },
      OR: [
        { depreciationLines: { some: {} } },
        { assetDisposals: { some: {} } },
      ],
    },
    include: {
      depreciationLines: {
        include: {
          asset: {
            include: { category: true },
          },
        },
      },
      assetDisposals: {
        include: {
          asset: {
            include: {
              category: true,
              depreciationLines: { where: { status: "POSTED" } },
            },
          },
        },
      },
      _count: {
        select: { depreciationLines: true, assetDisposals: true, lines: true },
      },
    },
    orderBy: [{ number: "asc" }],
  });

  const results = [];
  for (const journal of journals) {
    const kind = classifyAssetJournal(journal);
    if (options.dryRun) {
      results.push({
        number: journal.number,
        sourceId: journal.sourceId,
        description: journal.description,
        kind,
        status: kind === "unsupported" ? "inspect_manually" : `rebuild_${kind}`,
      });
      continue;
    }

    const result = await prisma.$transaction(async (tx) => {
      const freshJournal = await tx.journalEntry.findUnique({
        where: { id: journal.id },
        include: {
          depreciationLines: {
            include: { asset: { include: { category: true } } },
          },
          assetDisposals: {
            include: {
              asset: {
                include: {
                  category: true,
                  depreciationLines: { where: { status: "POSTED" } },
                },
              },
            },
          },
          _count: { select: { lines: true, depreciationLines: true, assetDisposals: true } },
        },
      });
      if (!freshJournal) return { status: "missing_journal" };
      if (freshJournal._count.lines > 0) return { status: "already_filled" };

      if (kind === "opening") return createAssetOpeningTransactions(tx, freshJournal);
      if (kind === "depreciation") return createDepreciationTransactions(tx, freshJournal);
      if (kind === "disposal") return createDisposalTransactions(tx, freshJournal);
      return { status: "inspect_manually" };
    });

    results.push({
      number: journal.number,
      sourceId: journal.sourceId,
      description: journal.description,
      kind,
      status: result.status,
      transactionCount: result.transactionIds?.length || 0,
    });
  }

  return results;
}

async function main() {
  const options = parseArgs(process.argv);
  const companies = await resolveCompanies(options);
  console.log(`Rebuild empty asset journals (${options.dryRun ? "dry-run" : "apply"})...`);

  for (const company of companies) {
    const results = await processCompany(company, options);
    const summary = results.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});
    console.log(`- ${company.name} (${company.id})`);
    for (const [status, count] of Object.entries(summary).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${status}: ${count}`);
    }
    for (const row of results.slice(0, options.limit)) {
      console.log(
        `  EX ${row.number} ${row.kind} -> ${row.status}${row.transactionCount ? ` tx=${row.transactionCount}` : ""}`
      );
    }
  }

  if (options.dryRun) {
    console.log("Dry-run complete. Re-run with --apply to rebuild the supported asset journals.");
  }
}

main()
  .catch((error) => {
    console.error("[rebuild-empty-asset-journals] failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
