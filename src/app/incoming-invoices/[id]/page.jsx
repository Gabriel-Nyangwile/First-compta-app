import prisma from "@/lib/prisma";
import Link from "next/link";
import { formatAmount } from "@/lib/utils";
import DownloadIncomingInvoicePDFButton from "@/components/DownloadIncomingInvoicePDFButton";
import DeleteIncomingInvoiceButton from "./DeleteIncomingInvoiceButton";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAsset } from "@/lib/assets";
import { getSystemAccounts } from "@/lib/systemAccounts";
import { finalizeBatchToJournal } from "@/lib/journal";

export default async function IncomingInvoiceDetail({ params, searchParams }) {
  const { id } = await params;
  const inv = await prisma.incomingInvoice.findUnique({
    where: { id },
    include: {
      supplier: true,
      lines: { include: { account: true } },
      transactions: { include: { account: true } },
      purchaseOrder: { select: { id: true, number: true } },
      assetPurchaseOrder: { select: { id: true, number: true } },
      moneyMovements: {
        select: {
          id: true,
          date: true,
          amount: true,
          direction: true,
          kind: true,
          voucherRef: true,
          description: true,
          moneyAccount: { select: { label: true, id: true } },
          transactions: { include: { account: true } },
        },
        orderBy: { date: "asc" },
      },
    },
  });
  if (!inv) return <div className="p-8 text-sm text-red-600">Introuvable</div>;
  const paid = Number(inv.paidAmount || 0);
  const remaining = Number(
    inv.outstandingAmount ?? Number(inv.totalAmount || 0) - paid
  );
  const decimalToNumber = (value) => value?.toNumber?.() ?? Number(value ?? 0);
  const totalInvoiceAmount = decimalToNumber(inv.totalAmount);
  const paymentHistory = (inv.moneyMovements || []).map((m) => ({
    id: m.id,
    date: m.date,
    amount: decimalToNumber(m.amount),
    direction: m.direction,
    kind: m.kind,
    voucherRef: m.voucherRef,
    description: m.description,
    moneyAccount: m.moneyAccount,
    transactions: (m.transactions || []).map((t) => ({
      id: t.id,
      accountNumber: t.account?.number,
      accountLabel: t.account?.label,
      direction: t.direction,
      amount: decimalToNumber(t.amount),
    })),
  }));
  let runningOutstanding = totalInvoiceAmount;
  const paymentHistoryWithRunning = paymentHistory.map((entry) => {
    const delta = entry.direction === "OUT" ? entry.amount : -entry.amount;
    const before = runningOutstanding;
    const after = Math.max(0, Math.round((before - delta) * 100) / 100);
    runningOutstanding = after;
    return { ...entry, outstandingBefore: before, outstandingAfter: after };
  });
  const sp = await searchParams;
  const returnTo = sp?.returnTo ? decodeURIComponent(sp.returnTo) : null;

  async function ensureInvoicePosted(invoiceId) {
    "use server";
    if (!invoiceId) return;
    const invoice = await prisma.incomingInvoice.findUnique({
      where: { id: invoiceId },
      include: { lines: true, supplier: true, transactions: true },
    });
    if (!invoice) return;
    const hasAcquisition = (invoice.transactions || []).some(
      (t) => t.kind === "ASSET_ACQUISITION" || t.kind === "PAYABLE"
    );
    if (hasAcquisition) return;

    const receiptDate = invoice.receiptDate || new Date();
    const vatBuckets = new Map();
    const txns = [];

    let supplierAccountId = invoice.supplier?.accountId || null;
    if (!supplierAccountId) {
      let acc = await prisma.account.findFirst({ where: { number: "401000" } });
      if (!acc) acc = await prisma.account.create({ data: { number: "401000", label: "Fournisseurs" } });
      supplierAccountId = acc.id;
    }

    for (const l of invoice.lines || []) {
      const amt = Number(l.lineTotal?.toString?.() ?? l.lineTotal ?? 0);
      const rate = l.vatRate != null ? Number(l.vatRate) : null;
      if (rate != null) vatBuckets.set(rate, (vatBuckets.get(rate) || 0) + amt * rate);
      txns.push(await prisma.transaction.create({
        data: {
          date: receiptDate,
          nature: "purchase",
          description: l.description || "Immobilisation",
          amount: amt.toFixed(2),
          direction: "DEBIT",
          kind: "ASSET_ACQUISITION",
          accountId: l.accountId,
          incomingInvoiceId: invoice.id,
          supplierId: invoice.supplierId || undefined,
        },
      }));
    }

    const { vatDeductibleAccount } = await getSystemAccounts();
    if (vatDeductibleAccount && vatBuckets.size) {
      for (const [rate, amt] of vatBuckets.entries()) {
        if (!(amt > 0)) continue;
        const pct = (Number(rate) * 100).toFixed(2).replace(/\\.00$/, "");
        txns.push(await prisma.transaction.create({
          data: {
            date: receiptDate,
            nature: "purchase",
            description: `TVA deductible ${pct}% facture ${invoice.entryNumber}`,
            amount: amt.toFixed(2),
            direction: "DEBIT",
            kind: "VAT_DEDUCTIBLE",
            accountId: vatDeductibleAccount.id,
            incomingInvoiceId: invoice.id,
            supplierId: invoice.supplierId || undefined,
          },
        }));
      }
    }

    const totalAmount = Number(invoice.totalAmount?.toString?.() ?? invoice.totalAmount ?? 0);
    txns.push(await prisma.transaction.create({
      data: {
        date: receiptDate,
        nature: "purchase",
        description: `Dette fournisseur facture ${invoice.entryNumber}`,
        amount: totalAmount.toFixed(2),
        direction: "CREDIT",
        kind: "PAYABLE",
        accountId: supplierAccountId,
        incomingInvoiceId: invoice.id,
        supplierId: invoice.supplierId || undefined,
      },
    }));

    await finalizeBatchToJournal(prisma, {
      sourceType: "INCOMING_INVOICE",
      sourceId: invoice.id,
      date: receiptDate,
      description: `Facture fournisseur immob ${invoice.entryNumber}`,
      transactions: txns,
    });
  }

  async function createAssetFromInvoice() {
    "use server";
    const invoice = await prisma.incomingInvoice.findUnique({
      where: { id },
      include: {
        assetPurchaseOrder: {
          include: {
            lines: { include: { assetCategory: true } },
          },
        },
      },
    });
    if (!invoice?.assetPurchaseOrder) {
      throw new Error("BC immobilisation non lié à cette facture");
    }
    await ensureInvoicePosted(invoice.id);
    const postedInvoice = await prisma.incomingInvoice.findUnique({
      where: { id },
      include: { transactions: true },
    });
    const hasAcquisition = (postedInvoice?.transactions || []).some(
      (t) => t.kind === "ASSET_ACQUISITION" || t.kind === "PAYABLE"
    );
    if (!hasAcquisition) {
      throw new Error("Écritures d'acquisition manquantes (compte immo non renseigné). Corrigez la catégorie ou éditez la facture pour sélectionner le compte.");
    }
    const po = invoice.assetPurchaseOrder;
    for (const line of po.lines || []) {
      if (!line.assetCategoryId) continue;
      const qty = Number(line.quantity?.toNumber?.() ?? line.quantity ?? 1);
      const unit = Number(line.unitPrice?.toNumber?.() ?? line.unitPrice ?? 0);
      const cost = qty * unit;
      const ul = line.assetCategory?.durationMonths || 36;
      const acquisitionDate = invoice.receiptDate || new Date();
      const inServiceDate = acquisitionDate;
      await createAsset({
        label: line.label || po.number,
        categoryId: line.assetCategoryId,
        acquisitionDate,
        inServiceDate,
        cost,
        salvage: 0,
        usefulLifeMonths: ul,
        method: "LINEAR",
        status: "ACTIVE",
        meta: {
          source: "INCOMING_INVOICE",
          incomingInvoiceId: invoice.id,
          assetPurchaseOrderId: po.id,
          assetPurchaseOrderLineId: line.id,
        },
      });
    }
    revalidatePath("/assets");
    redirect("/assets");
  }
  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-50">
      <div className="w-full max-w-2xl bg-white p-8 rounded-lg shadow-md border border-gray-200 space-y-6">
        <div className="flex justify-between items-center gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold">
              Facture Fournisseur {inv.entryNumber}
            </h1>
            {inv.purchaseOrder && (
              <p className="text-xs text-gray-600">
                Bon de commande lié :{" "}
                <Link
                  href={`/purchase-orders/${inv.purchaseOrder.id}`}
                  className="text-blue-600 underline"
                >
                  {inv.purchaseOrder.number}
                </Link>
              </p>
            )}
            {inv.assetPurchaseOrder && (
              <p className="text-xs text-gray-600">
                BC immobilisation :{" "}
                <Link
                  href={`/asset-purchase-orders/${inv.assetPurchaseOrder.id}`}
                  className="text-blue-600 underline"
                >
                  {inv.assetPurchaseOrder.number}
                </Link>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <DownloadIncomingInvoicePDFButton incomingInvoiceId={inv.id} />
            {returnTo ? (
              <Link
                href={returnTo}
                className="px-3 py-2 bg-blue-600 text-white rounded text-sm"
              >
                Retour autorisation
              </Link>
            ) : (
              <Link
                href="/incoming-invoices"
                className="px-3 py-2 bg-blue-600 text-white rounded text-sm"
              >
                Retour
              </Link>
            )}
            {["PENDING", "OVERDUE"].includes(inv.status) &&
              !inv.moneyMovements.length &&
              !inv.transactions.some((t) => t.kind === "PAYMENT") && (
                <DeleteIncomingInvoiceButton id={inv.id} />
              )}
            {inv.assetPurchaseOrder && (
              <form action={createAssetFromInvoice}>
                <button
                  type="submit"
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm"
                >
                  Créer immobilisation(s) depuis ce BC
                </button>
              </form>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <h2 className="font-semibold mb-1">Fournisseur</h2>
            <p>
              <span className="font-medium">Nom:</span>{" "}
              {inv.supplier?.name || "-"}
            </p>
            {inv.supplier?.email && (
              <p>
                <span className="font-medium">Email:</span> {inv.supplier.email}
              </p>
            )}
            {inv.purchaseOrder && (
              <p>
                <span className="font-medium">Bon de commande:</span>{" "}
                <Link
                  href={`/purchase-orders/${inv.purchaseOrder.id}`}
                  className="text-blue-600 underline"
                >
                  {inv.purchaseOrder.number}
                </Link>
              </p>
            )}
          </div>
          <div className="space-y-1">
            <h2 className="font-semibold mb-1">Montants</h2>
            <p>Total: {formatAmount(inv.totalAmount.toString())}</p>
            <p>Payé: {formatAmount(paid.toString())}</p>
            <p>Reste: {formatAmount(remaining.toString())}</p>
            <p>Statut: {inv.status}</p>
          </div>
        </div>
        <div>
          <h3 className="font-semibold mb-2 text-sm">Lignes</h3>
          <table className="w-full text-xs border">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 py-1 text-left">Desc</th>
                <th className="px-2 py-1 text-left">Compte</th>
                <th className="px-2 py-1 text-right">HT</th>
              </tr>
            </thead>
            <tbody>
              {inv.lines.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="px-2 py-1">{l.description}</td>
                  <td className="px-2 py-1 font-mono">{l.account.number}</td>
                  <td className="px-2 py-1 text-right">
                    {formatAmount(l.lineTotal.toString())}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="font-semibold mb-2 text-sm">Écritures</h3>
          <table className="w-full text-xs border">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 py-1 text-left">Date</th>
                <th className="px-2 py-1 text-left">Sens</th>
                <th className="px-2 py-1 text-left">Compte</th>
                <th className="px-2 py-1 text-right">Montant</th>
                <th className="px-2 py-1 text-left">Kind</th>
              </tr>
            </thead>
            <tbody>
              {inv.transactions.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-2 py-1">
                    {new Date(t.date).toLocaleDateString()}
                  </td>
                  <td className="px-2 py-1">{t.direction}</td>
                  <td className="px-2 py-1 font-mono">
                    {t.account?.number || t.accountId}
                  </td>
                  <td className="px-2 py-1 text-right">
                    {formatAmount(t.amount.toString())}
                  </td>
                  <td className="px-2 py-1">{t.kind}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {paymentHistoryWithRunning.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2 text-sm">Historique paiements</h3>
            <table className="w-full text-xs border">
              <thead className="bg-gray-100">
                <tr className="text-left">
                  <th className="px-2 py-1">Date</th>
                  <th className="px-2 py-1">Nature</th>
                  <th className="px-2 py-1 text-right">Montant</th>
                  <th className="px-2 py-1 text-right">Solde après</th>
                  <th className="px-2 py-1">Compte trésorerie</th>
                  <th className="px-2 py-1">Comptes comptables</th>
                  <th className="px-2 py-1">Référence</th>
                </tr>
              </thead>
              <tbody>
                {paymentHistoryWithRunning.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-t align-top hover:bg-gray-50"
                  >
                    <td className="px-2 py-1 whitespace-nowrap">
                      {new Date(entry.date).toLocaleDateString()}
                    </td>
                    <td className="px-2 py-1 text-xs">
                      {entry.direction === "OUT" ? "Paiement" : "Entrée"}
                      {entry.description ? ` · ${entry.description}` : ""}
                    </td>
                    <td
                      className={`px-2 py-1 text-right tabular-nums ${
                        entry.direction === "OUT"
                          ? "text-green-700"
                          : "text-amber-700"
                      }`}
                    >
                      {formatAmount(entry.amount.toFixed(2))}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums font-medium">
                      {formatAmount(entry.outstandingAfter.toFixed(2))}
                    </td>
                    <td className="px-2 py-1 text-xs">
                      {entry.moneyAccount?.label || "Compte ?"}
                    </td>
                    <td className="px-2 py-1 text-xs">
                      {(entry.transactions || []).length === 0 ? (
                        <span className="text-slate-400">-</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {entry.transactions.map((tx) => (
                            <li key={tx.id} className="flex items-center gap-1">
                              <span className="font-mono">
                                {tx.accountNumber || "???"}
                              </span>
                              <span className="text-[10px] uppercase text-slate-500">
                                {tx.direction}
                              </span>
                              <span className="tabular-nums">
                                {formatAmount(tx.amount.toFixed(2))}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-2 py-1 text-xs">
                      {entry.voucherRef ? (
                        <Link
                          href={`/treasury/movements/${entry.id}`}
                          className="font-mono text-indigo-600 underline"
                          prefetch={false}
                        >
                          {entry.voucherRef}
                        </Link>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
