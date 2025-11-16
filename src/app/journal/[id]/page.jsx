import Link from "next/link";
import prisma from "@/lib/prisma";

const toNumber = (value) => {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return value.toNumber?.() ?? Number(value) ?? 0;
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return new Intl.DateTimeFormat("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatAmount = (value) => {
  const num = toNumber(value);
  if (!num) return "";
  return num.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default async function JournalEntryDetail({ params }) {
  const entry = await prisma.journalEntry.findUnique({
    where: { id: params.id },
    include: {
      lines: {
        orderBy: [{ date: "asc" }, { id: "asc" }],
        include: {
          account: { select: { id: true, number: true, label: true } },
          client: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
          incomingInvoice: { select: { id: true, entryNumber: true } },
          moneyMovement: { select: { id: true, voucherRef: true, kind: true } },
        },
      },
    },
  });

  if (!entry) {
    return (
      <div className="px-6 py-10">
        <p className="text-sm text-neutral-500">Écriture introuvable.</p>
        <Link
          className="mt-4 inline-flex text-sm text-blue-600 hover:underline"
          href="/journal"
        >
          Retour au journal
        </Link>
      </div>
    );
  }

  let debit = 0;
  let credit = 0;
  let totalLettered = 0;
  let totalOutstanding = 0;

  const lines = entry.lines.map((line, index) => {
    const amount = toNumber(line.amount);
    const letteredAmount = toNumber(line.letteredAmount);
    const outstanding = Math.max(0, amount - letteredAmount);
    if (line.direction === "DEBIT") debit += amount;
    else credit += amount;
    totalLettered += letteredAmount;
    totalOutstanding += outstanding;
    return {
      ...line,
      index: index + 1,
      amount,
      letteredAmount,
      outstanding,
    };
  });

  const balanced = Math.abs(debit - credit) < 0.001;

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Écriture {entry.number}
          </h1>
          <p className="text-sm text-neutral-500">
            {formatDateTime(entry.date)} • Source {entry.sourceType}
            {entry.sourceId ? ` • Référence ${entry.sourceId}` : ""}
          </p>
        </div>
        <Link
          className="rounded border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          href="/journal"
        >
          ← Retour journal
        </Link>
      </div>

      <div className="grid gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm">
        <div className="flex flex-wrap gap-6">
          <span>
            <span className="font-medium text-neutral-600">Statut :</span>{" "}
            <span className="rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
              {entry.status}
            </span>
          </span>
          <span>
            <span className="font-medium text-neutral-600">Équilibrée :</span>{" "}
            <span className={balanced ? "text-green-700" : "text-red-600"}>
              {balanced ? "Oui" : "Non"}
            </span>
          </span>
          <span>
            <span className="font-medium text-neutral-600">Total débit :</span>{" "}
            {formatAmount(debit)}
          </span>
          <span>
            <span className="font-medium text-neutral-600">Total crédit :</span>{" "}
            {formatAmount(credit)}
          </span>
          <span>
            <span className="font-medium text-neutral-600">
              Montant lettré :
            </span>{" "}
            {formatAmount(totalLettered)}
          </span>
          <span>
            <span className="font-medium text-neutral-600">
              Reste à lettrer :
            </span>{" "}
            {formatAmount(totalOutstanding)}
          </span>
        </div>
        {entry.description && (
          <p className="text-neutral-700">{entry.description}</p>
        )}
        {entry.postedAt && (
          <p className="text-neutral-500 text-xs">
            Posté le {formatDateTime(entry.postedAt)}
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">#</th>
              <th className="px-3 py-2 text-left font-semibold">Compte</th>
              <th className="px-3 py-2 text-left font-semibold">Libellé</th>
              <th className="px-3 py-2 text-left font-semibold">Relations</th>
              <th className="px-3 py-2 text-right font-semibold">Débit</th>
              <th className="px-3 py-2 text-right font-semibold">Crédit</th>
              <th className="px-3 py-2 text-left font-semibold">Lettrage</th>
              <th className="px-3 py-2 text-right font-semibold">Lettré</th>
              <th className="px-3 py-2 text-right font-semibold">Reste</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white">
            {lines.map((line) => (
              <tr key={line.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2 align-top text-xs text-neutral-500">
                  {line.index}
                </td>
                <td className="px-3 py-2 align-top font-mono text-sm">
                  {line.account?.number || "—"}
                  <div className="text-xs text-neutral-500">
                    {line.account?.label}
                  </div>
                </td>
                <td className="px-3 py-2 align-top text-neutral-700">
                  <div className="font-medium">{line.description || "—"}</div>
                  <div className="text-xs text-neutral-400">{line.kind}</div>
                </td>
                <td className="px-3 py-2 align-top text-xs text-neutral-500 space-y-1">
                  {line.client && <div>Client : {line.client.name}</div>}
                  {line.supplier && (
                    <div>Fournisseur : {line.supplier.name}</div>
                  )}
                  {line.invoice && (
                    <div>
                      Facture:&nbsp;
                      <Link
                        className="text-blue-600 hover:underline"
                        href={`/invoices/${line.invoice.id}`}
                      >
                        {line.invoice.invoiceNumber}
                      </Link>
                    </div>
                  )}
                  {line.incomingInvoice && (
                    <div>
                      Facture fournisseur:&nbsp;
                      <Link
                        className="text-blue-600 hover:underline"
                        href={`/incoming-invoices/${line.incomingInvoice.id}`}
                      >
                        {line.incomingInvoice.entryNumber}
                      </Link>
                    </div>
                  )}
                  {line.moneyMovement && (
                    <div>
                      Mouvement trésorerie : {line.moneyMovement.voucherRef} (
                      {line.moneyMovement.kind})
                    </div>
                  )}
                  {!line.client &&
                    !line.supplier &&
                    !line.invoice &&
                    !line.incomingInvoice &&
                    !line.moneyMovement && <div>—</div>}
                </td>
                <td className="px-3 py-2 align-top text-right font-mono text-emerald-600">
                  {line.direction === "DEBIT" ? formatAmount(line.amount) : ""}
                </td>
                <td className="px-3 py-2 align-top text-right font-mono text-amber-600">
                  {line.direction === "CREDIT" ? formatAmount(line.amount) : ""}
                </td>
                <td className="px-3 py-2 align-top text-xs text-neutral-600">
                  <div className="font-medium">
                    {line.letterStatus || "UNMATCHED"}
                  </div>
                  <div>{line.letterRef || "—"}</div>
                  {line.letteredAt && (
                    <div>{formatDateTime(line.letteredAt)}</div>
                  )}
                </td>
                <td className="px-3 py-2 align-top text-right font-mono text-emerald-700">
                  {formatAmount(line.letteredAmount)}
                </td>
                <td className="px-3 py-2 align-top text-right font-mono text-amber-700">
                  {formatAmount(line.outstanding)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-neutral-50">
            <tr>
              <td colSpan={4} className="px-3 py-2 text-right font-semibold">
                Totaux
              </td>
              <td className="px-3 py-2 text-right font-semibold">
                {formatAmount(debit)}
              </td>
              <td className="px-3 py-2 text-right font-semibold">
                {formatAmount(credit)}
              </td>
              <td></td>
              <td className="px-3 py-2 text-right font-semibold">
                {formatAmount(totalLettered)}
              </td>
              <td className="px-3 py-2 text-right font-semibold">
                {formatAmount(totalOutstanding)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex gap-4 text-sm">
        <Link
          className="text-blue-600 hover:underline"
          href={`/api/journal-entries/${entry.id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Voir JSON API
        </Link>
      </div>
    </div>
  );
}
