"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import Amount from "@/components/Amount.jsx";

const letterStatusColors = {
  UNMATCHED: "bg-red-50 text-red-700 border border-red-200",
  PARTIAL: "bg-amber-50 text-amber-700 border border-amber-200",
  MATCHED: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

const statusLabels = {
  UNMATCHED: "Non lettré",
  PARTIAL: "Partiel",
  MATCHED: "Soldé",
};

async function fetchLettering(supplierId) {
  const res = await fetch(`/api/suppliers/${supplierId}/lettering`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Impossible de charger le lettrage");
  return res.json();
}

async function triggerMatch({ supplierId, movementId }) {
  const res = await fetch(`/api/suppliers/${supplierId}/lettering/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ movementId }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || "Lettrage impossible");
  }
  return payload;
}

async function triggerInvoiceMatch({ supplierId, invoiceId }) {
  const res = await fetch(`/api/suppliers/${supplierId}/lettering/match-invoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoiceId }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || "Lettrage facture impossible");
  }
  return payload;
}

export function LetteringPanel({ supplierId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [detail, setDetail] = useState(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setError(null);
        const payload = await fetchLettering(supplierId);
        if (active) setData(payload);
      } catch (err) {
        console.error(err);
        if (active) setError(err.message || "Erreur de chargement");
      }
    }
    if (supplierId) load();
    return () => {
      active = false;
    };
  }, [supplierId]);

  const handleMatch = (movementId) => {
    setMessage(null);
    setDetail(null);
    setError(null);
    startTransition(async () => {
      try {
        const result = await triggerMatch({ supplierId, movementId });
        setMessage(
          `Lettrage effectué (${result.letterRef || ""}) – ${
            result.updated || 0
          } écritures`
        );
        setDetail({
          matchedMovement: movementId,
          updatedCount: result.updated || 0,
          letterRef: result.letterRef || null,
        });
        const refreshed = await fetchLettering(supplierId);
        setData(refreshed);
      } catch (err) {
        setError(err.message || "Lettrage impossible");
      }
    });
  };

  const items = data?.items || [];
  const invoices = data?.invoices || [];
  const availablePayments = data?.availablePayments || [];
  const totals = data?.totals || { payable: 0, payment: 0, delta: 0 };
  const statusCounts = data?.statusCounts || [];
  const availablePaymentsTotal = availablePayments.reduce(
    (sum, item) => sum + Number(item.remainingAmount || 0),
    0
  );
  const deltaOk = Math.abs(totals.delta) < 0.01;

  return (
    <section className="bg-white border rounded shadow">
      <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Lettrage / Matching</h2>
          <p className="text-xs text-gray-500">
            Suivi des écritures 401/520 associées à ce fournisseur.
          </p>
        </div>
        <div className="text-xs text-gray-600 flex flex-col md:flex-row gap-2 md:items-center">
          <span>
            Somme payable&nbsp;:
            <span className="font-semibold ml-1">
              <Amount value={totals.payable} />
            </span>
          </span>
          <span>
            Somme paiements&nbsp;:
            <span className="font-semibold text-green-700 ml-1">
              <Amount value={totals.payment} />
            </span>
          </span>
          <span>
            Delta&nbsp;:
            <span
              className={`ml-1 font-semibold ${
                deltaOk ? "text-emerald-600" : "text-red-600"
              }`}
            >
              <Amount value={totals.delta} />
            </span>
          </span>
        </div>
      </div>

      {(message || error) && (
        <div
          className={`px-4 py-2 text-xs border-b flex items-start justify-between gap-3 ${
            error
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}
        >
          <div className="space-y-1">
            <p className="font-medium">
              {error ? "Lettrage impossible" : "Lettrage réussi"}
            </p>
            <p>{error || message}</p>
            {!error && detail && (
              <p className="text-[11px] opacity-80">
                {detail.updatedCount} écriture(s) synchronisée(s)
                {detail.letterRef ? ` · Référence ${detail.letterRef}` : ""}
              </p>
            )}
          </div>
          <button
            type="button"
            className="text-[11px] font-semibold uppercase"
            onClick={() => {
              setMessage(null);
              setDetail(null);
              setError(null);
            }}
          >
            Fermer
          </button>
        </div>
      )}

      <div className="px-4 py-2 border-b flex flex-wrap gap-2">
        {statusCounts.length === 0 ? (
          <span className="text-xs text-gray-500">
            Aucun lettrage enregistré.
          </span>
        ) : (
          statusCounts.map(({ status, count }) => (
            <span
              key={status}
              className={`text-[11px] px-2 py-1 rounded-full ${
                letterStatusColors[status] ||
                "bg-gray-100 text-gray-600 border border-gray-200"
              }`}
            >
              {status} · {count}
            </span>
          ))
        )}
      </div>

      <div className="px-4 py-3 border-b space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-medium text-sm">Factures à solder</h3>
            <p className="text-[11px] text-gray-500">
              Commencez par la facture fournisseur, puis laissez le système imputer les paiements encore disponibles.
            </p>
          </div>
          <div className="text-[11px] text-gray-600 text-right">
            <div>
              Paiements encore disponibles :{" "}
              <span className="font-semibold">{availablePayments.length}</span>
            </div>
            <div>
              Montant disponible :{" "}
              <span className="font-semibold">
                <Amount value={availablePaymentsTotal} />
              </span>
            </div>
          </div>
        </div>
        {availablePayments.length === 0 && (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
            Aucun paiement disponible à imputer. Enregistrez d&apos;abord un règlement fournisseur avant de lancer le lettrage.
          </div>
        )}
        <div className="overflow-auto border rounded">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <Th>Facture</Th>
                <Th>Échéance</Th>
                <Th className="text-right">Montant</Th>
                <Th className="text-right">Déjà lettré</Th>
                <Th className="text-right">Reste</Th>
                <Th>Statut</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-4 text-center text-gray-400">
                    Aucune facture fournisseur trouvée pour ce lettrage.
                  </td>
                </tr>
              )}
              {invoices.map((invoice) => {
                const remaining = Math.max(
                  0,
                  Number(invoice.amount || 0) - Number(invoice.letteredAmount || 0)
                );
                const statusClass =
                  letterStatusColors[invoice.letterStatus] ||
                  "bg-gray-100 text-gray-600 border border-gray-200";
                return (
                  <tr key={invoice.id} className="border-t">
                    <Td>
                      <Link
                        href={`/incoming-invoices/${invoice.id}`}
                        className="text-blue-600 underline"
                        prefetch={false}
                      >
                        {invoice.number}
                      </Link>
                    </Td>
                    <Td>
                      {invoice.dueDate
                        ? new Date(invoice.dueDate).toLocaleDateString()
                        : "—"}
                    </Td>
                    <Td className="text-right tabular-nums">
                      <Amount value={invoice.amount} />
                    </Td>
                    <Td className="text-right tabular-nums">
                      <Amount value={invoice.letteredAmount} />
                    </Td>
                    <Td className="text-right tabular-nums">
                      <Amount value={remaining} />
                    </Td>
                    <Td>
                      <span
                        className={`inline-flex items-center text-[11px] px-2 py-1 rounded-full ${statusClass}`}
                      >
                        {statusLabels[invoice.letterStatus] || invoice.letterStatus}
                      </span>
                    </Td>
                    <Td>
                      <button
                        type="button"
                        className="text-[11px] px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
                        disabled={
                          invoice.letterStatus === "MATCHED" ||
                          availablePayments.length === 0 ||
                          isPending
                        }
                        title={
                          invoice.letterStatus === "MATCHED"
                            ? "Cette facture est déjà soldée."
                            : availablePayments.length === 0
                              ? "Aucun paiement disponible pour cette facture."
                              : "Imputer les paiements disponibles sur cette facture."
                        }
                        onClick={() => {
                          setMessage(null);
                          setDetail(null);
                          setError(null);
                          startTransition(async () => {
                            try {
                              const result = await triggerInvoiceMatch({
                                supplierId,
                                invoiceId: invoice.id,
                              });
                              setMessage(
                                `Facture ${invoice.number} lettrée (${result.letterRef || ""})`
                              );
                              setDetail({
                                updatedCount: result.updated || 0,
                                letterRef: result.letterRef || null,
                              });
                              const refreshed = await fetchLettering(supplierId);
                              setData(refreshed);
                            } catch (err) {
                              setError(err.message || "Lettrage impossible");
                            }
                          });
                        }}
                      >
                        {invoice.letterStatus === "MATCHED"
                          ? "Déjà soldée"
                          : isPending
                            ? "…"
                            : "Lettrer la facture"}
                      </button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-100">
            <tr>
              <Th>Date</Th>
              <Th>Écriture</Th>
              <Th className="text-right">Montant</Th>
              <Th>Statut</Th>
              <Th>Facture</Th>
              <Th>Paiement</Th>
              <Th>Compte</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                  Aucune écriture 401/520/57 trouvée pour ce fournisseur.
                </td>
              </tr>
            )}
            {items.map((row) => {
              const signedAmount =
                row.side === "PAYMENT" ? -row.amount : row.amount;
              const statusClass =
                letterStatusColors[row.letterStatus] ||
                "bg-gray-100 text-gray-600 border border-gray-200";
              const isMatched = row.letterStatus === "MATCHED";
              const rowLettered = Number(row.letteredAmount || 0);
              const rowRemaining = Math.max(0, Number(row.amount || 0) - rowLettered);
              return (
                <tr
                  key={row.id}
                  className="border-b last:border-b-0 hover:bg-gray-50"
                >
                  <Td>
                    {row.date ? new Date(row.date).toLocaleDateString() : "—"}
                  </Td>
                  <Td>
                    <div className="flex flex-col">
                      <span className="font-semibold text-xs">{row.side}</span>
                      <span className="text-[11px] text-gray-500">
                        {row.direction} · {row.kind}
                      </span>
                    </div>
                  </Td>
                  <Td
                    className={`text-right tabular-nums ${
                      row.side === "PAYMENT"
                        ? "text-green-700"
                        : "text-gray-800"
                    }`}
                  >
                    <Amount value={signedAmount} />
                  </Td>
                  <Td>
                    <span
                      className={`inline-flex items-center text-[11px] px-2 py-1 rounded-full ${statusClass}`}
                    >
                      {statusLabels[row.letterStatus] || row.letterStatus}
                    </span>
                    {row.letterStatus !== "MATCHED" && (
                      <div className="mt-1 text-[10px] text-gray-500">
                        Reste à lettrer : <Amount value={rowRemaining} />
                      </div>
                    )}
                  </Td>
                  <Td className="space-y-1">
                    {row.invoice ? (
                      <Link
                        href={`/incoming-invoices/${row.invoice.id}`}
                        className="text-blue-600 underline text-xs"
                        prefetch={false}
                      >
                        {row.invoice.number}
                      </Link>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                    {row.invoice?.dueDate && (
                      <div className="text-[10px] text-gray-500">
                        Échéance{" "}
                        {new Date(row.invoice.dueDate).toLocaleDateString()}
                      </div>
                    )}
                  </Td>
                  <Td className="space-y-1">
                    {row.movement ? (
                      <Link
                        href={`/treasury/movements/${row.movement.id}`}
                        className="text-indigo-600 underline font-mono text-[11px]"
                        prefetch={false}
                      >
                        {row.movement.voucherRef || row.movement.id}
                      </Link>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                    {row.movement?.moneyAccountLabel && (
                      <div className="text-[10px] text-gray-500">
                        {row.movement.moneyAccountLabel}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <div className="flex flex-col">
                      <span className="font-mono text-[11px]">
                        {row.accountNumber || "—"}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {row.accountLabel || ""}
                      </span>
                    </div>
                  </Td>
                  <Td>
                    {row.movement ? (
                      <button
                        type="button"
                        className="text-[11px] px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
                        disabled={isMatched || isPending}
                        title={
                          isMatched
                            ? "Cette écriture est déjà totalement lettrée."
                            : "Ancien mode de lettrage, conservé pour compatibilité."
                        }
                        onClick={() => handleMatch(row.movement.id)}
                      >
                        {isMatched ? "Lettré" : isPending ? "…" : "Ancien mode"}
                      </button>
                    ) : (
                      <span className="text-[11px] text-gray-400">—</span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({ children, className = "" }) {
  return (
    <th className={`px-3 py-2 text-left font-medium ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = "" }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}
