'use client';

import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authorizedFetch } from '@/lib/apiClient';

/**
 * Client-side wrapper for per-row actions (Approve / Cancel) to allow confirm dialogues
 * without injecting event handler functions into a Server Component tree.
 */
export default function PurchaseOrderRowActions({ po }) {
  if (!po) return null;
  if (po.status !== 'DRAFT') {
    return (
      <div className="flex flex-col gap-1 items-end text-[11px]">
        <a className="text-blue-600 hover:underline" href={`/purchase-orders/${po.id}`}>Details</a>
      </div>
    );
  }

  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const runAction = useCallback(
    async (action) => {
      if (!po?.id) return;
      const confirmMessage =
        action === 'approve' ? 'Approuver ce BC ?' : 'Annuler ce BC ?';
      if (!window.confirm(confirmMessage)) return;

      setError(null);
      setBusy(action);

      const url =
        action === 'approve'
          ? `/api/purchase-orders/${po.id}/approve`
          : `/api/purchase-orders/${po.id}/cancel`;

      try {
        const res = await authorizedFetch(url, { method: 'POST' });
        let payload = null;
        try {
          payload = await res.json();
        } catch {
          payload = null;
        }
        if (!res.ok) {
          const message =
            payload?.error ||
            (action === 'approve'
              ? `Erreur approbation (${res.status})`
              : `Erreur annulation (${res.status})`);
          throw new Error(message);
        }
        router.refresh();
      } catch (err) {
        console.error('Purchase order action failed', err);
        setError(err.message);
      } finally {
        setBusy(null);
      }
    },
    [po?.id, router]
  );

  return (
    <div className="flex flex-col items-end gap-1 text-[11px]">
      <a className="text-blue-600 hover:underline" href={`/purchase-orders/${po.id}`}>Details</a>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => runAction('approve')}
          disabled={busy === 'approve'}
          className="px-2 py-0.5 rounded bg-green-600 hover:bg-green-700 text-white disabled:opacity-60"
        >
          {busy === 'approve' ? 'Approve...' : 'Approve'}
        </button>
        <button
          type="button"
          onClick={() => runAction('cancel')}
          disabled={busy === 'cancel'}
          className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
        >
          {busy === 'cancel' ? 'Cancel...' : 'Cancel'}
        </button>
      </div>
      {error && <span className="text-red-600">{error}</span>}
    </div>
  );
}
