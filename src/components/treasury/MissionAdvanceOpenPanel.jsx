import Amount from "@/components/Amount.jsx";

const bucketLabels = {
  "0-30j": "0-30 jours",
  "31-60j": "31-60 jours",
  "61-90j": "61-90 jours",
  ">90j": "> 90 jours",
};

export default function MissionAdvanceOpenPanel({ overview }) {
  const summary = overview?.summary || {
    totalOpenAmount: 0,
    totalOpenCount: 0,
    maxAgeDays: 0,
    byBucket: {},
  };
  const rows = overview?.rows || [];

  return (
    <section className="bg-white border rounded p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Avances de mission ouvertes</h2>
          <p className="text-xs text-slate-500">
            Suivi des dossiers d'avance encore à justifier, régulariser ou solder.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-slate-600">
          <div>
            Nombre ouvert&nbsp;
            <strong className="ml-1">{summary.totalOpenCount}</strong>
          </div>
          <div>
            Encours ouvert&nbsp;
            <strong className="ml-1 text-amber-700">
              <Amount value={summary.totalOpenAmount} />
            </strong>
          </div>
          <div>
            Ancienneté max&nbsp;
            <strong className="ml-1">{summary.maxAgeDays} j</strong>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px]">
        {Object.entries(bucketLabels).map(([key, label]) => (
          <span
            key={key}
            className="px-2 py-1 rounded-full border bg-slate-50 text-slate-600"
          >
            {label} · {summary.byBucket?.[key] || 0}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border">
          <thead className="bg-slate-100 text-slate-600">
            <tr className="text-left">
              <th className="px-2 py-1">Employé</th>
              <th className="px-2 py-1">Réf avance</th>
              <th className="px-2 py-1">Date</th>
              <th className="px-2 py-1">Compte</th>
              <th className="px-2 py-1 text-right">Avance</th>
              <th className="px-2 py-1 text-right">Régularisé</th>
              <th className="px-2 py-1 text-right">Remboursé</th>
              <th className="px-2 py-1 text-right">Reliquat</th>
              <th className="px-2 py-1">Âge</th>
              <th className="px-2 py-1">Pièce</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-2 py-3 text-center text-slate-500">
                  Aucune avance de mission ouverte.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-t hover:bg-slate-50">
                <td className="px-2 py-1">
                  <div className="flex flex-col">
                    <span>{row.employee?.name || "—"}</span>
                    {row.employee?.employeeNumber && (
                      <span className="font-mono text-[11px] text-slate-500">
                        {row.employee.employeeNumber}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-1 font-mono text-[11px]">{row.voucherRef}</td>
                <td className="px-2 py-1">
                  {row.date ? new Date(row.date).toLocaleDateString() : "—"}
                </td>
                <td className="px-2 py-1">
                  <div className="flex flex-col">
                    <span className="font-mono text-[11px]">
                      {row.advanceAccount?.number || "—"}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {row.advanceAccount?.label || ""}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-1 text-right tabular-nums">
                  <Amount value={row.amount} />
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-emerald-700">
                  <Amount value={row.regularizedAmount} />
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-blue-700">
                  <Amount value={row.refundedAmount} />
                </td>
                <td className="px-2 py-1 text-right tabular-nums font-semibold text-amber-700">
                  <Amount value={row.remainingAmount} />
                </td>
                <td className="px-2 py-1">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-[11px] ${
                      row.ageDays > 90
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : row.ageDays > 30
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-slate-50 text-slate-600 border border-slate-200"
                    }`}
                  >
                    {row.ageDays} j
                  </span>
                </td>
                <td className="px-2 py-1 font-mono text-[11px]">
                  {row.supportRef || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
