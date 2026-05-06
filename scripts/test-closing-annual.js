#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import prisma from "../src/lib/prisma.js";
import {
  calculateAnnualClosing,
  generateAnnualOpening,
} from "../src/lib/closing/annual.js";
import { createJournalEntry } from "../src/lib/journal.js";
import { createManualJournalEntry as createManualJournalEntryCore } from "../src/lib/manualJournal.js";
import { reverseManualJournalEntry } from "../src/lib/journalReversal.js";

function assert(condition, message, details = null) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

async function cleanupCompany(companyId) {
  if (!companyId) return;
  await prisma.fiscalYearClosing.deleteMany({ where: { companyId } });
  await prisma.transaction.deleteMany({ where: { companyId } });
  await prisma.journalEntry.deleteMany({ where: { companyId } });
  await prisma.sequence.deleteMany({ where: { companyId } });
  await prisma.account.deleteMany({ where: { companyId } });
  await prisma.companyMembership.deleteMany({ where: { companyId } });
  await prisma.company.delete({ where: { id: companyId } }).catch(() => null);
}

async function main() {
  const runId = randomUUID().slice(0, 8);
  let companyId = null;
  let userId = null;
  try {
    const company = await prisma.company.create({
      data: {
        name: `CLOSING TEST ${runId}`,
        currency: "XOF",
        fiscalYearStart: "01-01",
      },
      select: { id: true },
    });
    companyId = company.id;

    const user = await prisma.user.create({
      data: {
        email: `closing-test-${runId}@example.local`,
        username: `closing-test-${runId}`,
        role: "SUPERADMIN",
        isActive: true,
      },
      select: { id: true },
    });
    userId = user.id;
    await prisma.companyMembership.create({
      data: {
        companyId,
        userId,
        role: "SUPERADMIN",
        isActive: true,
      },
    });

    const accounts = await prisma.account.createManyAndReturn({
      data: [
        { companyId, number: "101100", label: "Capital test" },
        { companyId, number: "512000", label: "Banque test" },
        { companyId, number: "601000", label: "Charges test" },
        { companyId, number: "701000", label: "Produits test" },
        { companyId, number: "121100", label: "Report a nouveau Crediteur" },
        { companyId, number: "129100", label: "Perte nette reportee" },
      ],
      select: { id: true, number: true },
    });
    const accountByNumber = new Map(accounts.map((account) => [account.number, account]));
    const date = new Date("2025-06-30T00:00:00");

    await prisma.transaction.createMany({
      data: [
        {
          companyId,
          date,
          description: "Capital test cloture",
          amount: 1000,
          direction: "CREDIT",
          kind: "ADJUSTMENT",
          accountId: accountByNumber.get("101100").id,
        },
        {
          companyId,
          date,
          description: "Banque test cloture",
          amount: 1300,
          direction: "DEBIT",
          kind: "ADJUSTMENT",
          accountId: accountByNumber.get("512000").id,
        },
        {
          companyId,
          date,
          description: "Charge test cloture",
          amount: 200,
          direction: "DEBIT",
          kind: "PURCHASE",
          accountId: accountByNumber.get("601000").id,
        },
        {
          companyId,
          date,
          description: "Produit test cloture",
          amount: 500,
          direction: "CREDIT",
          kind: "SALE",
          accountId: accountByNumber.get("701000").id,
        },
      ],
    });

    const analysis = await calculateAnnualClosing({ companyId, year: 2025 });
    assert(Math.abs(analysis.totals.ledgerDiff) < 0.01, "Journal exercice non equilibre.", analysis.totals);
    assert(analysis.totals.result === 300, "Resultat attendu 300.", analysis.totals);
    assert(analysis.opening.rows.length === 2, "Deux comptes de bilan attendus.", analysis.opening.rows);
    assert(analysis.opening.result.direction === "CREDIT", "Resultat beneficiaire attendu au credit.", analysis.opening.result);
    assert(analysis.opening.result.amount === 300, "Montant resultat ouverture attendu 300.", analysis.opening.result);
    assert(analysis.opening.result.accountNumber === "121100", "Compte de report beneficiaire attendu.", analysis.opening.result);

    const generated = await generateAnnualOpening({ companyId, year: 2025 });
    assert(generated.generated?.journalEntry?.number, "Journal a-nouveaux non genere.", generated.generated);
    assert(generated.generated?.fiscalYearClosing?.id, "Fiche de cloture non generee.", generated.generated);
    assert(generated.generated.fiscalYearClosing.status === "CLOSED", "Statut de cloture attendu CLOSED.", generated.generated);
    assert(generated.generated.transactionsCreated === 3, "Trois transactions d'ouverture attendues.", generated.generated);

    const afterClosing = await calculateAnnualClosing({ companyId, year: 2025 });
    assert(afterClosing.existingClosing?.id, "Fiche de cloture non retrouvee au controle.", afterClosing.existingClosing);
    assert(
      afterClosing.existingClosing?.openingJournalEntry?.number === generated.generated.journalEntry.number,
      "Journal d'a-nouveaux non relie a la fiche de cloture.",
      afterClosing.existingClosing
    );
    const closingJournal = await prisma.journalEntry.findUnique({
      where: {
        companyId_number: {
          companyId,
          number: generated.generated.journalEntry.number,
        },
      },
      select: { sourceType: true, sourceId: true, supportRef: true },
    });
    assert(closingJournal?.sourceType === "OTHER", "Source OTHER attendue pour les a-nouveaux.", closingJournal);
    assert(closingJournal?.sourceId === "CLOSING-2025", "Reference source de cloture attendue.", closingJournal);

    let duplicateBlocked = false;
    try {
      await generateAnnualOpening({ companyId, year: 2025 });
    } catch (error) {
      duplicateBlocked = /deja generes/.test(error.message);
    }
    assert(duplicateBlocked, "Le garde anti-doublon a-nouveaux n'a pas bloque le second import.");

    let lockedPeriodBlocked = false;
    try {
      await prisma.$transaction(async (tx) => {
        const debit = await tx.transaction.create({
          data: {
            companyId,
            date: new Date("2025-12-31T00:00:00"),
            description: "Tentative ecriture exercice ferme",
            amount: 10,
            direction: "DEBIT",
            kind: "ADJUSTMENT",
            accountId: accountByNumber.get("512000").id,
          },
        });
        const credit = await tx.transaction.create({
          data: {
            companyId,
            date: new Date("2025-12-31T00:00:00"),
            description: "Tentative ecriture exercice ferme",
            amount: 10,
            direction: "CREDIT",
            kind: "ADJUSTMENT",
            accountId: accountByNumber.get("101100").id,
          },
        });
        await createJournalEntry(tx, {
          date: new Date("2025-12-31T00:00:00"),
          transactionIds: [debit.id, credit.id],
          description: "Tentative ecriture exercice ferme",
        });
      });
    } catch (error) {
      lockedPeriodBlocked = /cloture/.test(error.message);
    }
    assert(lockedPeriodBlocked, "Le verrou d'exercice cloture n'a pas bloque l'ecriture.");

    const manualSupportRef = `CLOSED-MANUAL-${runId}`;
    let manualBlocked = false;
    try {
      await createManualJournalEntryCore({
        companyId,
        actorUserId: userId,
        entryDate: new Date("2025-12-01T00:00:00"),
        description: "OD manuelle exercice ferme",
        supportRef: manualSupportRef,
        isDraft: false,
        normalized: [
          { accountId: accountByNumber.get("512000").id, debit: 10, credit: 0 },
          { accountId: accountByNumber.get("101100").id, debit: 0, credit: 10 },
        ],
        totalDebit: 10,
        totalCredit: 10,
      });
    } catch (error) {
      manualBlocked = /cloture/.test(error.message);
    }
    assert(manualBlocked, "Le helper OD manuelle n'a pas bloque l'exercice cloture.");
    const leakedManualJournal = await prisma.journalEntry.findFirst({
      where: { companyId, supportRef: manualSupportRef },
      select: { id: true, number: true },
    });
    assert(!leakedManualJournal, "Une OD manuelle a ete creee malgre l'exercice cloture.", leakedManualJournal);

    const openManual = await createManualJournalEntryCore({
      companyId,
      actorUserId: userId,
      entryDate: new Date("2026-02-01T00:00:00"),
      description: "OD manuelle exercice ouvert",
      supportRef: `OPEN-MANUAL-${runId}`,
      isDraft: false,
      normalized: [
        { accountId: accountByNumber.get("512000").id, debit: 25, credit: 0 },
        { accountId: accountByNumber.get("101100").id, debit: 0, credit: 25 },
      ],
      totalDebit: 25,
      totalCredit: 25,
    });

    const reversal = await reverseManualJournalEntry({
      companyId,
      journalEntryId: openManual.id,
      reversalDate: new Date("2026-02-02T00:00:00"),
      reason: "Test annulation",
    });
    assert(reversal.reversal?.number, "Journal de contrepassation non genere.", reversal);
    assert(reversal.reversedCount === 2, "Deux lignes de contrepassation attendues.", reversal);
    const reversalLines = await prisma.transaction.findMany({
      where: { companyId, journalEntryId: reversal.reversal.id },
      select: { direction: true, amount: true, accountId: true },
      orderBy: { direction: "asc" },
    });
    const hasDebitCapital = reversalLines.some(
      (line) =>
        line.accountId === accountByNumber.get("101100").id &&
        line.direction === "DEBIT" &&
        Number(line.amount) === 25
    );
    const hasCreditBank = reversalLines.some(
      (line) =>
        line.accountId === accountByNumber.get("512000").id &&
        line.direction === "CREDIT" &&
        Number(line.amount) === 25
    );
    assert(hasDebitCapital && hasCreditBank, "Lignes de contrepassation incoherentes.", reversalLines);

    let duplicateReversalBlocked = false;
    try {
      await reverseManualJournalEntry({
        companyId,
        journalEntryId: openManual.id,
        reversalDate: new Date("2026-02-03T00:00:00"),
      });
    } catch (error) {
      duplicateReversalBlocked = /deja annulee|déjà annulée/i.test(error.message);
    }
    assert(duplicateReversalBlocked, "La double annulation d'OD n'a pas ete bloquee.");

    const openManualForClosedReversal = await createManualJournalEntryCore({
      companyId,
      actorUserId: userId,
      entryDate: new Date("2026-03-01T00:00:00"),
      description: "OD manuelle annulation date fermee",
      supportRef: `OPEN-MANUAL-CLOSED-REV-${runId}`,
      isDraft: false,
      normalized: [
        { accountId: accountByNumber.get("512000").id, debit: 15, credit: 0 },
        { accountId: accountByNumber.get("101100").id, debit: 0, credit: 15 },
      ],
      totalDebit: 15,
      totalCredit: 15,
    });
    let closedReversalBlocked = false;
    try {
      await reverseManualJournalEntry({
        companyId,
        journalEntryId: openManualForClosedReversal.id,
        reversalDate: new Date("2025-12-01T00:00:00"),
      });
    } catch (error) {
      closedReversalBlocked = /cloture/.test(error.message);
    }
    assert(closedReversalBlocked, "La contrepassation datee sur exercice cloture n'a pas ete bloquee.");

    console.log("Annual closing smoke OK");
  } finally {
    await cleanupCompany(companyId);
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => null);
  }
}

main()
  .catch((error) => {
    console.error("test-closing-annual error:", error.message || error);
    if (error.details) console.error(JSON.stringify(error.details, null, 2));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
