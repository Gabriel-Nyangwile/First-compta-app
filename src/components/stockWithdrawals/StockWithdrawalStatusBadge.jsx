import { STATUS_LABELS } from "./constants";

const STATUS_STYLE = {
  DRAFT: "bg-slate-200 text-slate-700",
  CONFIRMED: "bg-blue-200 text-blue-700",
  POSTED: "bg-emerald-200 text-emerald-700",
  CANCELLED: "bg-rose-200 text-rose-700",
};

export default function StockWithdrawalStatusBadge({ status }) {
  const normalized = status || "DRAFT";
  const cls = STATUS_STYLE[normalized] || STATUS_STYLE.DRAFT;
  const label = STATUS_LABELS[normalized] || normalized;
  return (
    <span
      className={`px-2 py-0.5 rounded text-[11px] uppercase tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}
