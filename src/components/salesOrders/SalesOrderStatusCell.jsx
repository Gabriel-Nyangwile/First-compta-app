"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

function StatusBadge({ status }) {
  const classes = {
    DRAFT: "bg-gray-200 text-gray-800",
    CONFIRMED: "bg-blue-100 text-blue-700",
    FULFILLED: "bg-green-100 text-green-700",
  };
  const base =
    "inline-block px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide";
  return (
    <span className={`${base} ${classes[status] || "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}

const ACTION_LABELS = {
  CONFIRM: "Confirmer",
  FULFILL: "Clore (Fulfilled)",
};

export default function SalesOrderStatusCell({ orderId, initialStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const nextAction =
    status === "DRAFT" ? "CONFIRM" : status === "CONFIRMED" ? "FULFILL" : null;

  const handleAction = () => {
    if (!nextAction) return;
    startTransition(async () => {
      setError("");
      try {
        const res = await fetch(`/api/sales-orders/${orderId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: nextAction }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload?.error || "Impossible de mettre à jour le statut.");
        }
        const nextStatus = payload?.status || nextAction;
        setStatus(nextStatus);
        router.refresh();
      } catch (err) {
        setError(err.message || "Erreur lors de la mise à jour du statut.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-1 items-start">
      <div className="flex items-center gap-2">
        <StatusBadge status={status} />
        {nextAction && (
          <button
            type="button"
            onClick={handleAction}
            disabled={isPending}
            className="text-xs px-2 py-1 border border-blue-200 text-blue-700 rounded hover:bg-blue-50 disabled:opacity-60"
          >
            {isPending ? "Traitement..." : ACTION_LABELS[nextAction]}
          </button>
        )}
      </div>
      {error && <p className="text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}
