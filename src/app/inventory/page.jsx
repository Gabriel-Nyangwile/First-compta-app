import Link from "next/link";
import { listInventoryCounts } from "@/lib/inventoryCount";

function formatDate(value) {
  if (!value) return "-";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("fr-FR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "-";
  }
}

function formatQty(value) {
  if (value == null) return "0.000";
  return Number(value).toFixed(3);
}

function formatCurrency(value) {
  if (value == null) return "0.00 €";
  return `${Number(value).toFixed(2)} €`;
}

function statusBadge(status) {
  const classes = {
    DRAFT: "bg-slate-100 text-slate-700",
    COMPLETED: "bg-amber-100 text-amber-700",
    POSTED: "bg-emerald-100 text-emerald-700",
    CANCELLED: "bg-rose-100 text-rose-700",
  };
  const cls = classes[status] || "bg-slate-100 text-slate-700";
  return (
    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${cls}`}>
      {status}
    </span>
  );
}

export const dynamic = "force-dynamic";

export default async function InventoryOverviewPage() {
  const counts = await listInventoryCounts();

  const summary = counts.reduce(
    (acc, count) => {
      acc.total += 1;
      acc[count.status.toLowerCase()] =
        (acc[count.status.toLowerCase()] || 0) + 1;
      acc.deltaQty += count.summary?.deltaQty ?? 0;
      acc.deltaValue += count.summary?.deltaValue ?? 0;
      return acc;
    },
    { total: 0, draft: 0, completed: 0, posted: 0, cancelled: 0, deltaQty: 0, deltaValue: 0 }
  );

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            Inventaires physiques
          </h1>
          <p className="text-sm text-slate-600">
            Suivi des campagnes de comptage et des écarts valorisés.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/inventory-counts/export"
            className="inline-flex items-center px-3 py-1.5 text-sm rounded border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            Exporter CSV
          </a>
          <Link
            href="/inventory/adjustments"
            className="inline-flex items-center px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Enregistrer un ajustement
          </Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded border border-slate-200 bg-white px-3 py-3 shadow-sm">
          <div className="text-[11px] uppercase text-slate-500 tracking-wide">
            Inventaires
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-800">
            {summary.total}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {summary.completed} complétés • {summary.posted} postés
          </div>
        </div>
        <div className="rounded border border-slate-200 bg-white px-3 py-3 shadow-sm">
          <div className="text-[11px] uppercase text-slate-500 tracking-wide">
            Écart quantité
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-800">
            {formatQty(summary.deltaQty)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Somme des delta (comptés - théoriques)
          </div>
        </div>
        <div className="rounded border border-slate-200 bg-white px-3 py-3 shadow-sm">
          <div className="text-[11px] uppercase text-slate-500 tracking-wide">
            Écart valorisé
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-800">
            {formatCurrency(summary.deltaValue)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Variation cumulée (603 / 730)
          </div>
        </div>
        <div className="rounded border border-slate-200 bg-white px-3 py-3 shadow-sm">
          <div className="text-[11px] uppercase text-slate-500 tracking-wide">
            Statuts
          </div>
          <div className="mt-1 text-xs text-slate-600 space-y-1">
            <div>Draft : {summary.draft}</div>
            <div>Completed : {summary.completed}</div>
            <div>Posted : {summary.posted}</div>
            <div>Annulé : {summary.cancelled}</div>
          </div>
        </div>
      </section>

      {counts.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded bg-slate-50 p-6 text-center text-sm text-slate-600">
          Aucun inventaire n&apos;est encore saisi. Utilisez le bouton ci-dessus
          pour enregistrer un ajustement rapide.
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-600 text-[11px] uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">Inventaire</th>
                <th className="px-3 py-2 text-left">Statut</th>
                <th className="px-3 py-2 text-left">Compté le</th>
                <th className="px-3 py-2 text-left">Posté le</th>
                <th className="px-3 py-2 text-right">Lignes</th>
                <th className="px-3 py-2 text-right">Écart Qté</th>
                <th className="px-3 py-2 text-right">Écart Valeur</th>
                <th className="px-3 py-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {counts.map((count) => (
                <tr
                  key={count.id}
                  className="border-t border-slate-200 hover:bg-slate-50"
                >
                  <td className="px-3 py-2 font-mono text-[13px] text-blue-700">
                    {count.number}
                  </td>
                  <td className="px-3 py-2">{statusBadge(count.status)}</td>
                  <td className="px-3 py-2">{formatDate(count.countedAt)}</td>
                  <td className="px-3 py-2">{formatDate(count.postedAt)}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {count.summary?.totalLines ?? 0}{" "}
                    <span className="text-[11px] text-slate-500">
                      ({count.summary?.countedLines ?? 0} comptées)
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatQty(count.summary?.deltaQty)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatCurrency(count.summary?.deltaValue)}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {count.notes || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="border border-slate-200 rounded bg-white px-4 py-4 shadow-sm space-y-2 text-sm text-slate-600">
        <h2 className="text-sm font-semibold text-slate-700">
          Rappels opérationnels
        </h2>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>
            Statut <strong>DRAFT</strong> : inventaire en préparation (lignes à
            saisir).
          </li>
          <li>
            <strong>COMPLETED</strong> : toutes les lignes sont comptées, en
            attente de publication.
          </li>
          <li>
            <strong>POSTED</strong> : écarts intégrés en stock, écritures 603/730 générées.
          </li>
        </ul>
      </section>
    </div>
  );
}
