"use client";
import { useRouter } from 'next/navigation';
import { useTransition, useState, useCallback } from 'react';
import { authorizedFetch } from "@/lib/apiClient";

export default function ApprovePurchaseOrderButton({ purchaseOrderId }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(null);

  const approve = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await authorizedFetch(`/api/purchase-orders/${purchaseOrderId}/approve`, { method: 'POST' });
        let payload = null;
        try {
          payload = await res.json();
        } catch (parseErr) {
          payload = null;
        }
        if (!res.ok) {
          const message = payload?.error || `Erreur approbation (${res.status})`;
          throw new Error(message);
        }
        router.refresh();
      } catch (err) {
        console.error('Approval failed', err);
        setError(err.message);
      }
    });
  }, [purchaseOrderId, router, startTransition]);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={approve}
        disabled={isPending}
        className="px-3 py-1 rounded text-white text-xs bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-60"
      >
        {isPending ? 'Approbation…' : 'Approuver'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
