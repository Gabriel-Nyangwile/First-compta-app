import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { nextSequence } from "@/lib/sequence";
import { requireCompanyId } from "@/lib/tenant";
import { checkPerm } from "@/lib/authz";
import { getRequestActor } from "@/lib/requestAuth";

function parseAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Number(amount.toFixed(2));
}

export async function POST(request) {
  try {
    const companyId = requireCompanyId(request);
    const actor = await getRequestActor(request, { companyId });
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
    if (!Array.isArray(lines) || lines.length < 2) {
      return NextResponse.json(
        { error: "Au moins deux lignes sont requises" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: "Au moins deux lignes non nulles sont requises" },
        { status: 400 }
      );
    }

    const invalidLine = normalized.find(
      (line) =>
        (line.debit > 0 && line.credit > 0) || (line.debit <= 0 && line.credit <= 0)
    );
    if (invalidLine) {
      return NextResponse.json(
        { error: "Chaque ligne doit porter soit un débit soit un crédit" },
        { status: 400 }
      );
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
    if (!isDraft && Math.abs(totalDebit - totalCredit) >= 0.01) {
      return NextResponse.json(
        {
          error: `Écriture non équilibrée : débit=${totalDebit.toFixed(2)} crédit=${totalCredit.toFixed(2)}`,
        },
        { status: 400 }
      );
    }

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

    const entryDate = new Date(date);
    if (Number.isNaN(entryDate.getTime())) {
      return NextResponse.json({ error: "date invalide" }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const number = await nextSequence(tx, "JRN", "JRN-", companyId);
      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId,
          number,
          date: entryDate,
          sourceType: "MANUAL",
          sourceId: `manual-od:${number}`,
          supportRef: String(supportRef || "").trim() || null,
          draftPayload: isDraft ? { lines: normalized } : null,
          preparedByUserId: actor.userId || null,
          preparedAt: new Date(),
          validatedByUserId: isDraft ? null : actor.userId || null,
          validatedAt: isDraft ? null : new Date(),
          description: String(description || "").trim() || "Opération diverse manuelle",
          status: isDraft ? "DRAFT" : "POSTED",
        },
      });

      const transactions = [];
      if (!isDraft) {
        for (const line of normalized) {
          const amount = line.debit > 0 ? line.debit : line.credit;
          const direction = line.debit > 0 ? "DEBIT" : "CREDIT";
          const transaction = await tx.transaction.create({
            data: {
              companyId,
              date: entryDate,
              nature: "manual",
              description:
                line.description ||
                String(description || "").trim() ||
                `OD manuelle ${number}`,
              amount,
              direction,
              kind: "ADJUSTMENT",
              accountId: line.accountId,
              journalEntryId: journalEntry.id,
            },
          });
          transactions.push(transaction);
        }
      }

      return {
        id: journalEntry.id,
        number: journalEntry.number,
        date: journalEntry.date,
        status: journalEntry.status,
        supportRef: journalEntry.supportRef,
        description: journalEntry.description,
        lineCount: isDraft ? normalized.length : transactions.length,
        totalDebit,
        totalCredit,
      };
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Erreur création OD manuelle" },
      { status: 500 }
    );
  }
}
