#!/usr/bin/env node
import prisma from "../src/lib/prisma.js";
import { createJournalEntry } from "../src/lib/journal.js";
import { nextSequence } from "../src/lib/sequence.js";
import { calculateAnnualClosing } from "../src/lib/closing/annual.js";

const DEFAULT_COMPANY_NAME = "Phase 5 Recette Cloture Demo";
const YEAR = 2025;

function getArg(name, fallback = null) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function d(year, month, day) {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function money(value) {
  return Number(value).toFixed(2);
}

async function cleanupCompany(companyId) {
  if (!companyId) return;
  await prisma.fiscalYearClosing.deleteMany({ where: { companyId } });
  await prisma.depreciationLine.deleteMany({ where: { companyId } });
  await prisma.assetDisposal.deleteMany({ where: { companyId } });
  await prisma.stockMovement.deleteMany({ where: { companyId } });
  await prisma.transaction.deleteMany({ where: { companyId } });
  await prisma.journalEntry.deleteMany({ where: { companyId } });
  await prisma.productInventory.deleteMany({ where: { companyId } });
  await prisma.product.deleteMany({ where: { companyId } });
  await prisma.asset.deleteMany({ where: { companyId } });
  await prisma.assetCategory.deleteMany({ where: { companyId } });
  await prisma.client.deleteMany({ where: { companyId } });
  await prisma.supplier.deleteMany({ where: { companyId } });
  await prisma.account.deleteMany({ where: { companyId } });
  await prisma.sequence.deleteMany({ where: { companyId } });
  await prisma.companyMembership.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
}

async function ensureUsersForDemo(companyId) {
  let users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, email: true, role: true },
    orderBy: { email: "asc" },
  });

  if (!users.length) {
    const user = await prisma.user.create({
      data: {
        email: "phase5-demo-admin@example.local",
        username: "phase5-demo-admin",
        role: "SUPERADMIN",
        isActive: true,
      },
      select: { id: true, email: true, role: true },
    });
    users = [user];
  }

  for (const user of users) {
    await prisma.companyMembership.upsert({
      where: { companyId_userId: { companyId, userId: user.id } },
      update: { isActive: true, role: user.role },
      create: {
        companyId,
        userId: user.id,
        role: user.role,
        isActive: true,
        isDefault: false,
      },
    });
  }

  return users;
}

async function createAccounts(companyId) {
  const definitions = [
    ["101100", "Capital social"],
    ["121100", "Report a nouveau Crediteur"],
    ["129100", "Perte nette reportee"],
    ["218100", "Materiel et outillage"],
    ["281810", "Amortissements materiel"],
    ["310000", "Stocks de marchandises"],
    ["401100", "Fournisseur demo"],
    ["411100", "Client demo"],
    ["445660", "TVA deductible"],
    ["445700", "TVA collectee"],
    ["512000", "Banque principale"],
    ["601000", "Achats marchandises"],
    ["681100", "Dotations amortissements"],
    ["701000", "Ventes marchandises"],
  ];

  const rows = await prisma.account.createManyAndReturn({
    data: definitions.map(([number, label]) => ({ companyId, number, label })),
    select: { id: true, number: true, label: true },
  });

  return new Map(rows.map((account) => [account.number, account]));
}

async function createJournal(tx, { companyId, date, description, supportRef, sourceType = "OTHER", sourceId = null, lines }) {
  const transactions = [];
  for (const line of lines) {
    transactions.push(
      await tx.transaction.create({
        data: {
          companyId,
          date,
          description,
          amount: money(line.amount),
          direction: line.direction,
          kind: line.kind,
          accountId: line.accountId,
          clientId: line.clientId || null,
          supplierId: line.supplierId || null,
        },
      })
    );
  }

  return createJournalEntry(tx, {
    companyId,
    sourceType,
    sourceId,
    supportRef,
    date,
    description,
    transactionIds: transactions.map((transaction) => transaction.id),
  });
}

async function seedDemo(companyName) {
  let company = null;
  try {
    company = await prisma.company.create({
      data: {
        name: companyName,
        currency: "XOF",
        country: "CD",
        timezone: "Africa/Kinshasa",
        fiscalYearStart: "01-01",
      },
      select: { id: true, name: true },
    });

    const users = await ensureUsersForDemo(company.id);
    const accounts = await createAccounts(company.id);

    const client = await prisma.client.create({
      data: {
        companyId: company.id,
        name: "Client Recette Phase 5",
        email: "client.phase5@example.local",
        accountId: accounts.get("411100").id,
      },
      select: { id: true },
    });

    const supplier = await prisma.supplier.create({
      data: {
        companyId: company.id,
        name: "Fournisseur Recette Phase 5",
        email: "supplier.phase5@example.local",
        accountId: accounts.get("401100").id,
      },
      select: { id: true },
    });

    const product = await prisma.product.create({
      data: {
        companyId: company.id,
        sku: "PH5-STOCK-2025",
        name: "Article recette cloture 2025",
        unit: "PCS",
        stockNature: "PURCHASED",
        inventoryAccountId: accounts.get("310000").id,
        stockVariationAccountId: accounts.get("601000").id,
      },
      select: { id: true, sku: true },
    });

    const assetCategory = await prisma.assetCategory.create({
      data: {
        companyId: company.id,
        code: "PH5-MAT",
        label: "Materiel recette Phase 5",
        durationMonths: 60,
        assetAccountId: accounts.get("218100").id,
        assetAccountNumber: "218100",
        depreciationAccountId: accounts.get("281810").id,
        depreciationAccountNumber: "281810",
        expenseAccountId: accounts.get("681100").id,
        expenseAccountNumber: "681100",
      },
      select: { id: true },
    });

    const assetRef = await nextSequence(prisma, "ASSET", "AS-", company.id);
    const asset = await prisma.asset.create({
      data: {
        companyId: company.id,
        ref: assetRef,
        label: "Machine recette cloture 2025",
        categoryId: assetCategory.id,
        acquisitionDate: d(2025, 2, 15),
        inServiceDate: d(2025, 2, 15),
        cost: money(600000),
        salvage: money(0),
        usefulLifeMonths: 60,
        status: "ACTIVE",
      },
      select: { id: true, ref: true },
    });

    const journals = await prisma.$transaction(async (tx) => {
    const created = [];
    created.push(
      await createJournal(tx, {
        companyId: company.id,
        date: d(2025, 1, 5),
        supportRef: "PH5-CAP-2025-001",
        description: "Recette Phase 5 - apport capital",
        lines: [
          { accountId: accounts.get("512000").id, direction: "DEBIT", amount: 2000000, kind: "CAPITAL_PAYMENT" },
          { accountId: accounts.get("101100").id, direction: "CREDIT", amount: 2000000, kind: "CAPITAL_PAYMENT" },
        ],
      })
    );

    created.push(
      await createJournal(tx, {
        companyId: company.id,
        date: d(2025, 2, 15),
        supportRef: "PH5-IMM-2025-001",
        sourceType: "ASSET",
        sourceId: asset.id,
        description: "Recette Phase 5 - acquisition immobilisation",
        lines: [
          { accountId: accounts.get("218100").id, direction: "DEBIT", amount: 600000, kind: "ASSET_ACQUISITION" },
          { accountId: accounts.get("512000").id, direction: "CREDIT", amount: 600000, kind: "PAYMENT" },
        ],
      })
    );

    created.push(
      await createJournal(tx, {
        companyId: company.id,
        date: d(2025, 3, 10),
        supportRef: "PH5-STK-2025-001",
        description: "Recette Phase 5 - entree stock initiale",
        lines: [
          { accountId: accounts.get("310000").id, direction: "DEBIT", amount: 150000, kind: "INVENTORY_ASSET" },
          { accountId: accounts.get("512000").id, direction: "CREDIT", amount: 150000, kind: "PAYMENT" },
        ],
      })
    );

    await tx.productInventory.create({
      data: {
        companyId: company.id,
        productId: product.id,
        qtyOnHand: "10.000",
        qtyStaged: "0.000",
        avgCost: "15000.0000",
      },
    });
    await tx.stockMovement.create({
      data: {
        companyId: company.id,
        date: d(2025, 3, 10),
        productId: product.id,
        movementType: "IN",
        stage: "AVAILABLE",
        quantity: "10.000",
        unitCost: "15000.0000",
        totalCost: "150000.00",
        voucherRef: "PH5-STK-2025-001",
      },
    });

    created.push(
      await createJournal(tx, {
        companyId: company.id,
        date: d(2025, 6, 20),
        supportRef: "PH5-FAC-2025-001",
        sourceType: "INVOICE",
        sourceId: "PH5-FAC-2025-001",
        description: "Recette Phase 5 - facture client",
        lines: [
          { accountId: accounts.get("411100").id, direction: "DEBIT", amount: 1180000, kind: "RECEIVABLE", clientId: client.id },
          { accountId: accounts.get("701000").id, direction: "CREDIT", amount: 1000000, kind: "SALE", clientId: client.id },
          { accountId: accounts.get("445700").id, direction: "CREDIT", amount: 180000, kind: "VAT_COLLECTED", clientId: client.id },
        ],
      })
    );

    created.push(
      await createJournal(tx, {
        companyId: company.id,
        date: d(2025, 7, 5),
        supportRef: "PH5-ENC-2025-001",
        description: "Recette Phase 5 - encaissement client partiel",
        lines: [
          { accountId: accounts.get("512000").id, direction: "DEBIT", amount: 800000, kind: "PAYMENT", clientId: client.id },
          { accountId: accounts.get("411100").id, direction: "CREDIT", amount: 800000, kind: "RECEIVABLE", clientId: client.id },
        ],
      })
    );

    created.push(
      await createJournal(tx, {
        companyId: company.id,
        date: d(2025, 8, 10),
        supportRef: "PH5-ACH-2025-001",
        sourceType: "INCOMING_INVOICE",
        sourceId: "PH5-ACH-2025-001",
        description: "Recette Phase 5 - facture fournisseur",
        lines: [
          { accountId: accounts.get("601000").id, direction: "DEBIT", amount: 300000, kind: "PURCHASE", supplierId: supplier.id },
          { accountId: accounts.get("445660").id, direction: "DEBIT", amount: 54000, kind: "VAT_DEDUCTIBLE", supplierId: supplier.id },
          { accountId: accounts.get("401100").id, direction: "CREDIT", amount: 354000, kind: "PAYABLE", supplierId: supplier.id },
        ],
      })
    );

    created.push(
      await createJournal(tx, {
        companyId: company.id,
        date: d(2025, 9, 10),
        supportRef: "PH5-REG-2025-001",
        description: "Recette Phase 5 - paiement fournisseur partiel",
        lines: [
          { accountId: accounts.get("401100").id, direction: "DEBIT", amount: 200000, kind: "PAYABLE", supplierId: supplier.id },
          { accountId: accounts.get("512000").id, direction: "CREDIT", amount: 200000, kind: "PAYMENT", supplierId: supplier.id },
        ],
      })
    );

    const depreciationJournal = await createJournal(tx, {
      companyId: company.id,
      date: d(2025, 12, 31),
      supportRef: "PH5-AMO-2025-001",
      sourceType: "ASSET",
      sourceId: asset.id,
      description: "Recette Phase 5 - dotation amortissement 2025",
      lines: [
        { accountId: accounts.get("681100").id, direction: "DEBIT", amount: 120000, kind: "ASSET_DEPRECIATION_EXPENSE" },
        { accountId: accounts.get("281810").id, direction: "CREDIT", amount: 120000, kind: "ASSET_DEPRECIATION_RESERVE" },
      ],
    });
    created.push(depreciationJournal);

    await tx.depreciationLine.create({
      data: {
        companyId: company.id,
        assetId: asset.id,
        year: 2025,
        month: 12,
        amount: "120000.00",
        cumulative: "120000.00",
        status: "POSTED",
        journalEntryId: depreciationJournal.id,
        postedAt: d(2025, 12, 31),
      },
    });

    return created.map((journal) => ({
      id: journal.id,
      number: journal.number,
      date: journal.date,
      description: journal.description,
      supportRef: journal.supportRef,
    }));
  });

    const analysis = await calculateAnnualClosing({ companyId: company.id, year: YEAR });
    if (!analysis.ok) {
      throw new Error(`Controle cloture non OK: ${analysis.anomalies.join(" | ")}`);
    }

    return {
      company,
      users,
      product,
      asset,
      journals,
      analysis,
    };
  } catch (error) {
    if (company?.id) {
      await cleanupCompany(company.id).catch(() => null);
    }
    throw error;
  }
}

async function main() {
  const companyName = getArg("name", process.env.PHASE5_DEMO_COMPANY_NAME || DEFAULT_COMPANY_NAME);
  const reset = hasFlag("reset");
  const existing = await prisma.company.findMany({
    where: { name: companyName },
    select: { id: true, name: true },
  });

  if (existing.length && !reset) {
    throw new Error(
      `La societe "${companyName}" existe deja. Relancez avec --reset pour la supprimer et la recreer.`
    );
  }

  if (existing.length && reset) {
    for (const company of existing) {
      await cleanupCompany(company.id);
    }
  }

  const result = await seedDemo(companyName);
  const totals = result.analysis.totals;

  console.log("Seed recette Phase 5 OK");
  console.log(`Societe: ${result.company.name}`);
  console.log(`companyId: ${result.company.id}`);
  console.log(`Utilisateurs rattaches: ${result.users.map((user) => user.email).join(", ")}`);
  console.log(`Produit demo: ${result.product.sku}`);
  console.log(`Immobilisation demo: ${result.asset.ref}`);
  console.log("Journaux 2025 crees:");
  for (const journal of result.journals) {
    console.log(`- ${journal.number} | ${journal.date.toISOString().slice(0, 10)} | ${journal.supportRef} | ${journal.description}`);
  }
  console.log("Controle cloture attendu:");
  console.log(`- Debit total: ${totals.totalDebit.toFixed(2)}`);
  console.log(`- Credit total: ${totals.totalCredit.toFixed(2)}`);
  console.log(`- Resultat 2025: ${totals.result.toFixed(2)} (benefice attendu)`);
  console.log(`- A-nouveaux attendus au 2026-01-01: ${result.analysis.opening.rows.length + 1} lignes, compte resultat 121100`);
  console.log("Recette interface: selectionnez cette societe, ouvrez /closing, controlez 2025 puis genereez N+1.");
}

main()
  .catch((error) => {
    console.error("seed-phase-5-closing-demo error:", error.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
