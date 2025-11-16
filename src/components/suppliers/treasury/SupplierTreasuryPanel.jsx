"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Amount from "@/components/Amount.jsx";

const dateFormatter = new Intl.DateTimeFormat("fr-FR");
const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function formatDate(value) {
  if (!value) return "—";
  try {
    return dateFormatter.format(new Date(value));
  } catch {
    return "—";
  }
}

async function fetchTreasury(supplierId) {
  const res = await fetch(`/api/suppliers/${supplierId}/treasury`, {
    cache: "no-store",
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || "Impossible de charger la trésorerie");
  }
  return payload;
}

export default function SupplierTreasuryPanel({ supplierId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const refreshRef = useRef(() => {});

  useEffect(() => {
    if (!supplierId) return;
    let active = true;

    async function load({ showSpinner = false } = {}) {
      try {
        if (showSpinner) setIsLoading(true);
        setError(null);
        const payload = await fetchTreasury(supplierId);
        if (!active) return;
        setData(payload);
        setIsLoading(false);
        setLastUpdated(new Date());
      } catch (err) {
        console.error(err);
        if (!active) return;
        setError(err.message);
        setIsLoading(false);
      }
    }

    refreshRef.current = (options = {}) =>
      load({ showSpinner: true, ...options });

    setIsLoading(true);
    setLastUpdated(null);
    load({ showSpinner: true });

    const interval = setInterval(() => {
      load();
    }, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [supplierId]);

  const invoices = data?.invoices ?? [];
  const payments = data?.payments ?? [];
  const timeline = data?.timeline ?? [];
  const outstandingInvoices = useMemo(
    () => invoices.filter((invoice) => (invoice.outstanding || 0) > 0),
    [invoices]
  );
  const quickInvoice = outstandingInvoices[0] ?? null;
  const summary = data?.summary;
  const paymentsLimited = data?.paymentsLimited;
  const supplier = data?.supplier;

  const recentEvents = useMemo(() => {
    <RefreshBadge
      timestamp={lastUpdated}
      onRefresh={() => refreshRef.current?.({ showSpinner: true })}
    />;
    const sorted = [...timeline].sort((a, b) => {
      const da = new Date(a.date || 0).getTime();
      const db = new Date(b.date || 0).getTime();
      if (da === db) return b.type.localeCompare(a.type);
      return db - da;
    });
    return sorted.slice(0, 5);
  }, [timeline]);

  return (
    <div className="space-y-8">
      {error && (
        <div className="border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm rounded">
          {error}
        </div>
      )}

      {!data && isLoading && (
        <div className="border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 rounded">
          Chargement des données de trésorerie…
        </div>
      )}

      {data && (
        <>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              href={{
                pathname: "/incoming-invoices",
                query: { supplier: supplier.id },
              }}
              prefetch={false}
              className="px-3 py-2 rounded border border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              Factures fournisseur
            </Link>
            <Link
              href={
                quickInvoice
                  ? {
                      pathname: "/treasury",
                      query: { quickIncoming: quickInvoice.id },
                    }
                  : "/treasury"
              }
              prefetch={false}
              className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Enregistrer un paiement
            </Link>
            <RefreshBadge
              timestamp={lastUpdated}
              onRefresh={() => setLastUpdated(new Date())}
            />
          </div>

          <section className="grid gap-4 md:grid-cols-3">
            <SummaryCard
              label="Total facturé"
              value={summary.totalInvoiced}
              helper={`${summary.invoiceCount} facture(s)`}
            />
            <SummaryCard
              label="Total payé"
              value={summary.totalPaid}
              valueClass="text-green-700"
              helper={
                summary.lastPaymentDate
                  ? `Dernier paiement : ${formatDate(summary.lastPaymentDate)}`
                  : null
              }
            />
            <SummaryCard
              label="Encours"
              value={summary.totalOutstanding}
              valueClass="text-amber-700"
              helper={
                summary.overdueCount > 0
                  ? `${summary.overdueCount} facture(s) en retard`
                  : "Aucun retard détecté"
              }
              helperClass={summary.overdueCount > 0 ? "text-red-600" : ""}
              footer={
                summary.nextDueDate
                  ? `Prochaine échéance : ${formatDate(summary.nextDueDate)}`
                  : null
              }
            />
          </section>

          <section className="bg-white border rounded p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Factures fournisseur</h2>
              <span className="text-xs text-slate-500">
                {outstandingInvoices.length} facture(s) avec solde ouvert
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border">
                <thead className="bg-slate-100 text-slate-600">
                  <tr className="text-left">
                    <th className="px-2 py-1">Référence</th>
                    <th className="px-2 py-1">Emission</th>
                    <th className="px-2 py-1">Échéance</th>
                    <th className="px-2 py-1 text-right">Total</th>
                    <th className="px-2 py-1 text-right">Payé</th>
                    <th className="px-2 py-1 text-right">Restant</th>
                    <th className="px-2 py-1">Statut</th>
                    <th className="px-2 py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-2 py-3 text-center text-slate-500"
                      >
                        Aucune facture enregistrée pour ce fournisseur.
                      </td>
                    </tr>
                  )}
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-t hover:bg-slate-50">
                      <td className="px-2 py-1 font-mono text-[11px]">
                        {invoice.number}
                      </td>
                      <td className="px-2 py-1">
                        {formatDate(invoice.issueDate)}
                      </td>
                      <td
                        className={`px-2 py-1 ${
                          invoice.isOverdue ? "text-red-600" : ""
                        }`}
                      >
                        {formatDate(invoice.dueDate)}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        <Amount value={invoice.total} />
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums text-green-700">
                        <Amount value={invoice.paid} />
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums font-medium">
                        <Amount value={invoice.outstanding} />
                      </td>
                      <td className="px-2 py-1 uppercase text-[10px] text-slate-600">
                        {invoice.status}
                      </td>
                      <td className="px-2 py-1 text-right">
                        <Link
                          href={{
                            pathname: `/incoming-invoices/${invoice.id}`,
                            query: { supplier: supplier.id },
                          }}
                          className="text-blue-600 underline"
                          prefetch={false}
                        >
                          Détails
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white border rounded p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Paiements enregistrés</h2>
              {paymentsLimited && (
                <span className="text-xs text-amber-600">
                  Liste tronquée à {payments.length} élément(s).
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border">
                <thead className="bg-slate-100 text-slate-600">
                  <tr className="text-left">
                    <th className="px-2 py-1">Date</th>
                    <th className="px-2 py-1">Montant</th>
                    <th className="px-2 py-1">Compte</th>
                    <th className="px-2 py-1">Facture</th>
                    <th className="px-2 py-1">Référence</th>
                    <th className="px-2 py-1">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-2 py-3 text-center text-slate-500"
                      >
                        Aucun paiement enregistré.
                      </td>
                    </tr>
                  )}
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-t hover:bg-slate-50">
                      <td className="px-2 py-1">{formatDate(payment.date)}</td>
                      <td className="px-2 py-1 text-right tabular-nums text-green-700">
                        <Amount value={payment.amount} />
                      </td>
                      <td className="px-2 py-1 text-xs">
                        {payment.moneyAccount ? (
                          <span>
                            {payment.moneyAccount.label}
                            {payment.moneyAccount.code ? (
                              <span className="text-[10px] text-slate-500">
                                {` (${payment.moneyAccount.code})`}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-slate-400">Compte ?</span>
                        )}
                      </td>
                      <td className="px-2 py-1 font-mono text-[11px]">
                        {payment.incomingInvoice
                          ? payment.incomingInvoice.number
                          : "—"}
                      </td>
                      <td className="px-2 py-1 font-mono text-[11px]">
                        {payment.voucherRef || "—"}
                      </td>
                      <td className="px-2 py-1 text-slate-600">
                        {payment.description || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white border rounded p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Chronologie règlement</h2>
              <span className="text-xs text-slate-500">
                Solde cumulé positif = montant restant dû
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border">
                <thead className="bg-slate-100 text-slate-600">
                  <tr className="text-left">
                    <th className="px-2 py-1">Date</th>
                    <th className="px-2 py-1">Événement</th>
                    <th className="px-2 py-1 text-right">Variation</th>
                    <th className="px-2 py-1 text-right">Solde après</th>
                    <th className="px-2 py-1">Détails</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-2 py-3 text-center text-slate-500"
                      >
                        Aucune donnée disponible.
                      </td>
                    </tr>
                  )}
                  {timeline.map((event) => (
                    <tr
                      key={`${event.type}-${event.id}`}
                      className="border-t hover:bg-slate-50"
                    >
                      <td className="px-2 py-1">{formatDate(event.date)}</td>
                      <td className="px-2 py-1 text-xs">
                        {event.type === "INVOICE" ? "Facture" : "Paiement"} ·{" "}
                        {event.label}
                      </td>
                      <td
                        className={`px-2 py-1 text-right tabular-nums ${
                          event.type === "PAYMENT"
                            ? "text-green-700"
                            : "text-amber-700"
                        }`}
                      >
                        <Amount value={event.delta} />
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums font-medium">
                        <Amount value={event.balanceAfter} />
                      </td>
                      <td className="px-2 py-1 text-xs text-slate-500 space-x-2">
                        {event.type === "INVOICE" && event.meta?.dueDate ? (
                          <span>
                            Échéance : {formatDate(event.meta.dueDate)}
                          </span>
                        ) : null}
                        {event.type === "PAYMENT" &&
                        event.meta?.invoiceNumber ? (
                          <span>Facture : {event.meta.invoiceNumber}</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white border rounded p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Dernières actions</h2>
              <span className="text-xs text-slate-500">
                Jusqu’à 5 lettrages ou paiements récents
              </span>
            </div>
            {recentEvents.length === 0 ? (
              <p className="text-xs text-slate-500">
                Aucune action récente enregistrée.
              </p>
            ) : (
              <ul className="space-y-2 text-xs text-slate-600">
                {recentEvents.map((event) => (
                  <li
                    key={`${event.type}-${event.id}`}
                    className="flex items-start justify-between gap-4 border-b border-dashed border-slate-200 pb-2 last:border-none last:pb-0"
                  >
                    <div className="space-y-1">
                      <p className="font-semibold">
                        {event.type === "INVOICE" ? "Facture" : "Paiement"}
                        {event.label ? ` · ${event.label}` : ""}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {event.meta?.invoiceNumber
                          ? `Facture associée : ${event.meta.invoiceNumber}`
                          : event.meta?.status
                          ? `Statut : ${event.meta.status}`
                          : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-slate-500 uppercase">
                        {formatDate(event.date)}
                      </p>
                      <p
                        className={`font-semibold tabular-nums ${
                          event.type === "PAYMENT"
                            ? "text-green-700"
                            : "text-amber-700"
                        }`}
                      >
                        <Amount value={event.delta} />
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  valueClass = "",
  helper,
  helperClass = "",
  footer,
}) {
  return (
    <div className="bg-white border rounded p-4 space-y-2">
      <div className="text-xs text-slate-500 uppercase">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${valueClass}`}>
        <Amount value={value} />
      </div>
      {helper && (
        <div className={`text-xs ${helperClass || "text-slate-500"}`}>
          {helper}
        </div>
      )}
      {footer && <div className="text-xs text-slate-500">{footer}</div>}
    </div>
  );
}

function RefreshBadge({ timestamp, onRefresh }) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      className="px-3 py-2 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 flex items-center gap-2"
    >
      <span>Actualiser</span>
      <span className="text-[11px] text-slate-400">
        {timestamp ? timeFormatter.format(timestamp) : "—"}
      </span>
    </button>
  );
}
