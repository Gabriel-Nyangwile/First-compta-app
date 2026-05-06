import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireCompanyId } from "@/lib/tenant";
import { checkPerm } from "@/lib/authz";
import { getRequestActor } from "@/lib/requestAuth";
import { assertAccountingPeriodOpen } from "@/lib/fiscalYearLock";

function parseAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Number(amount.toFixed(2));
}

function isEditableManualOd(entry) {
  return (
    entry &&
    entry.sourceType === "MANUAL" &&
    typeof entry.sourceId === "string" &&
    entry.sourceId.startsWith("manual-od:")
  );
}

async function createPostedTransactions(tx, entry, companyId, lines, description, entryDate) {
  await assertAccountingPeriodOpen(tx, {
    companyId,
    date: entryDate,
    context: "OD manuelle",
  });

  await tx.transaction.deleteMany({
    where: { journalEntryId: entry.id, companyId },
  });
  for (const line of lines) {
    const amount = line.debit > 0 ? line.debit : line.credit;
    const direction = line.debit > 0 ? "DEBIT" : "CREDIT";
    await tx.transaction.create({
      data: {
        companyId,
        date: entryDate,
        nature: "manual",
        description:
          line.description ||
          String(description || "").trim() ||
          `OD manuelle ${entry.number}`,
        amount,
        direction,
        kind: "ADJUSTMENT",
        accountId: line.accountId,
        journalEntryId: entry.id,
      },
    });
  }
}

async function loadEntry(id, companyId) {
  return prisma.journalEntry.findFirst({
    where: { id, companyId },
    include: {
      lines: true,
    },
  });
}

function normalizeLines(lines, allowUnbalanced = false) {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new Error("Au moins deux lignes sont requises");
  }

  const normalized = lines
    .map((line) => {
      const debit = parseAmount(line.debit);
      const credit = parseAmount(line.credit);
      return {
        accountId: String(line.accountId || "").trim(),
        description: String(line.description || "").trim() || null,
        debit,
        credit,
      };
    })
    .filter((line) => line.accountId && (line.debit > 0 || line.credit > 0));

  if (normalized.length < 2) {
    throw new Error("Au moins deux lignes non nulles sont requises");
  }

  const invalidLine = normalized.find(
    (line) =>
      (line.debit > 0 && line.credit > 0) ||
      (line.debit <= 0 && line.credit <= 0)
  );
  if (invalidLine) {
    throw new Error("Chaque ligne doit porter soit un débit soit un crédit");
  }

  const totals = normalized.reduce(
    (acc, line) => {
      acc.debit += line.debit;
      acc.credit += line.credit;
      return acc;
    },
    { debit: 0, credit: 0 }
  );
  const totalDebit = Number(totals.debit.toFixed(2));
  const totalCredit = Number(totals.credit.toFixed(2));

  if (!allowUnbalanced && Math.abs(totalDebit - totalCredit) >= 0.01) {
    throw new Error(
      `Écriture non équilibrée : débit=${totalDebit.toFixed(2)} crédit=${totalCredit.toFixed(2)}`
    );
  }

  return { normalized, totalDebit, totalCredit };
}

export async function PATCH(request, { params }) {
  try {
    const companyId = requireCompanyId(request);
    const actor = await getRequestActor(request, { companyId });
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "id requis" }, { status: 400 });
    }

    const body = await request.json();
    const { date, description, supportRef, status = "POSTED", lines } = body || {};
    const isDraft = status === "DRAFT";
    if (!actor?.role || !checkPerm("postJournalEntry", actor.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (!isDraft && !checkPerm("reopenPeriod", actor.role)) {
      return NextResponse.json(
        { error: "Validation réservée au responsable finance ou superadmin" },
        { status: 403 }
      );
    }
    if (!date) {
      return NextResponse.json({ error: "date requis" }, { status: 400 });
    }

    const entryDate = new Date(date);
    if (Number.isNaN(entryDate.getTime())) {
      return NextResponse.json({ error: "date invalide" }, { status: 400 });
    }

    const { normalized, totalDebit, totalCredit } = normalizeLines(lines, isDraft);
    const accountIds = [...new Set(normalized.map((line) => line.accountId))];
    const accounts = await prisma.account.findMany({
      where: { id: { in: accountIds }, companyId },
      select: { id: true },
    });
    if (accounts.length !== accountIds.length) {
      return NextResponse.json(
        { error: "Un ou plusieurs comptes sont introuvables" },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findFirst({
        where: { id, companyId },
        include: { lines: true },
      });
      if (!isEditableManualOd(entry)) {
        throw new Error("OD manuelle introuvable ou non modifiable");
      }
      const reversal = await tx.journalEntry.findFirst({
        where: {
          companyId,
          sourceType: "MANUAL",
          sourceId: `manual-od-reversal:${entry.id}`,
        },
        select: { number: true },
      });
      if (reversal) {
        throw new Error(`OD déjà annulée par ${reversal.number}; modification interdite.`);
      }
      const nextStatus = isDraft ? "DRAFT" : "POSTED";
      if (entry.status === "POSTED") {
        await assertAccountingPeriodOpen(tx, {
          companyId,
          date: entry.date,
          context: "Modification OD manuelle",
        });
      }
      if (nextStatus === "POSTED") {
        await assertAccountingPeriodOpen(tx, {
          companyId,
          date: entryDate,
          context: "OD manuelle",
        });
      }

      await tx.journalEntry.update({
        where: { id },
        data: {
          date: entryDate,
          supportRef: String(supportRef || "").trim() || null,
          draftPayload: nextStatus === "DRAFT" ? { lines: normalized } : null,
          preparedByUserId: entry.preparedByUserId || actor.userId || null,
          preparedAt: entry.preparedAt || new Date(),
          description:
            String(description || "").trim() || "Opération diverse manuelle",
          status: nextStatus,
          validatedByUserId: nextStatus === "POSTED" ? actor.userId || null : null,
          validatedAt: nextStatus === "POSTED" ? new Date() : null,
        },
      });

      if (nextStatus === "DRAFT") {
        await tx.transaction.deleteMany({
          where: { journalEntryId: id, companyId },
        });
      } else {
        await createPostedTransactions(
          tx,
          entry,
          companyId,
          normalized,
          description,
          entryDate
        );
      }

      const fresh = await tx.journalEntry.findUnique({
        where: { id },
        include: { lines: true },
      });
      return {
        id: fresh.id,
        number: fresh.number,
        date: fresh.date,
        status: fresh.status,
        supportRef: fresh.supportRef,
        description: fresh.description,
        lineCount: nextStatus === "DRAFT" ? normalized.length : fresh.lines.length,
        totalDebit,
        totalCredit,
      };
    });

    return NextResponse.json(updated);
  } catch (error) {
    const msg = error.message || "Erreur mise à jour OD manuelle";
    const status = msg.includes("introuvable") ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(request, { params }) {
  try {
    const companyId = requireCompanyId(request);
    const actor = await getRequestActor(request, { companyId });
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "id requis" }, { status: 400 });
    }
    if (!actor?.role || !checkPerm("postJournalEntry", actor.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const deleted = await prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findFirst({
        where: { id, companyId },
      });
      if (!isEditableManualOd(entry)) {
        throw new Error("OD manuelle introuvable ou non supprimable");
      }
      const reversal = await tx.journalEntry.findFirst({
        where: {
          companyId,
          sourceType: "MANUAL",
          sourceId: `manual-od-reversal:${entry.id}`,
        },
        select: { number: true },
      });
      if (reversal) {
        throw new Error(`OD déjà annulée par ${reversal.number}; suppression interdite.`);
      }
      if (entry.status === "POSTED" && !checkPerm("reopenPeriod", actor.role)) {
        throw new Error("Suppression d'une OD publiée réservée au responsable finance ou superadmin");
      }
      if (entry.status === "POSTED") {
        await assertAccountingPeriodOpen(tx, {
          companyId,
          date: entry.date,
          context: "Suppression OD manuelle",
        });
      }

      await tx.transaction.deleteMany({
        where: { journalEntryId: id, companyId },
      });
      await tx.journalEntry.delete({
        where: { id },
      });
      return { ok: true, id };
    });

    return NextResponse.json(deleted);
  } catch (error) {
    const msg = error.message || "Erreur suppression OD manuelle";
    const status = msg.includes("introuvable") ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
