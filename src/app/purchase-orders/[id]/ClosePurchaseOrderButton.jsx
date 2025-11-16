"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState, useCallback } from "react";
import { authorizedFetch } from "@/lib/apiClient";

export default function ClosePurchaseOrderButton({ purchaseOrderId, disabled }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(null);

  const handleClose = useCallback(() => {
    if (!purchaseOrderId) return;
    if (!window.confirm("Clore ce BC ?")) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await authorizedFetch(
          `/api/purchase-orders/${purchaseOrderId}/close`,
          { method: "POST" }
        );
        let payload = null;
        try {
          payload = await res.json();
        } catch {
          payload = null;
        }
        if (!res.ok) {
          const message =
            payload?.error || `Erreur cloture (${res.status})`;
          throw new Error(message);
        }
        router.refresh();
      } catch (err) {
        console.error("Close purchase order failed", err);
        setError(err.message);
      }
    });
  }, [purchaseOrderId, router, startTransition]);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClose}
        disabled={disabled || isPending}
        className="px-3 py-1 rounded text-white text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
      >
        {isPending ? "Cloture..." : "Cloturer"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
