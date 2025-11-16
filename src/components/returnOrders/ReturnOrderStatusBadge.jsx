const STATUS_STYLE = {
  DRAFT: "bg-slate-200 text-slate-700",
  SENT: "bg-blue-200 text-blue-700",
  CLOSED: "bg-emerald-200 text-emerald-700",
  CANCELLED: "bg-rose-200 text-rose-700",
};

export default function ReturnOrderStatusBadge({ status }) {
  const cls = STATUS_STYLE[status] || STATUS_STYLE.DRAFT;
  return (
    <span
      className={`px-2 py-0.5 rounded text-[11px] uppercase tracking-wide ${cls}`}
    >
      {status}
    </span>
  );
}
