import Link from "next/link";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { getCompanyIdFromCookies } from "@/lib/tenant";
import ManualOdForm from "@/components/journal/ManualOdForm";

export default async function ManualOdEditPage({ params }) {
  const cookieStore = await cookies();
  const companyId = getCompanyIdFromCookies(cookieStore);

  if (!companyId) {
    return (
      <div className="px-6 py-8">
        companyId requis (cookie company-id ou DEFAULT_COMPANY_ID).
      </div>
    );
  }

  const { id } = await params;
  const [accounts, entry] = await Promise.all([
    prisma.account.findMany({
      where: { companyId },
      orderBy: { number: "asc" },
      select: { id: true, number: true, label: true },
    }),
    prisma.journalEntry.findFirst({
      where: { id, companyId },
      include: {
        lines: {
          orderBy: [{ date: "asc" }, { id: "asc" }],
        },
      },
    }),
  ]);

  const isEditable =
    entry &&
    entry.sourceType === "MANUAL" &&
    typeof entry.sourceId === "string" &&
    entry.sourceId.startsWith("manual-od:");

  if (!isEditable) {
    return (
      <div className="px-6 py-8 space-y-4">
        <p className="text-sm text-neutral-600">
          Cette écriture n&apos;est pas une OD manuelle modifiable.
        </p>
        <Link className="text-blue-600 hover:underline" href="/journal">
          Retour journal
        </Link>
      </div>
    );
  }

  const initialData = {
    id: entry.id,
    date: new Date(entry.date).toISOString().slice(0, 10),
    description: entry.description || "",
    supportRef: entry.supportRef || "",
    status: entry.status,
    lines:
      entry.status === "DRAFT" && Array.isArray(entry.draftPayload?.lines)
        ? entry.draftPayload.lines.map((line) => ({
            accountId: line.accountId || "",
            description: line.description || "",
            debit: line.debit ? String(line.debit) : "",
            credit: line.credit ? String(line.credit) : "",
          }))
        : entry.lines.map((line) => ({
            accountId: line.accountId,
            description: line.description || "",
            debit: line.direction === "DEBIT" ? String(line.amount) : "",
            credit: line.direction === "CREDIT" ? String(line.amount) : "",
          })),
  };

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Modifier l&apos;OD manuelle {entry.number}
          </h1>
          <p className="text-sm text-neutral-500">
            Ajustez les lignes, la date, la description ou la pièce
            justificative.
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link
            className="rounded border border-neutral-300 px-3 py-2 hover:bg-neutral-100"
            href="/journal/manual-od/pending"
          >
            Brouillons à valider
          </Link>
          <Link
            className="rounded border border-neutral-300 px-3 py-2 hover:bg-neutral-100"
            href={`/journal/${entry.id}`}
          >
            Voir l&apos;écriture
          </Link>
          <Link
            className="rounded border border-neutral-300 px-3 py-2 hover:bg-neutral-100"
            href="/journal"
          >
            Retour journal
          </Link>
        </div>
      </div>

      <ManualOdForm accounts={accounts} initialData={initialData} mode="edit" />
    </div>
  );
}
