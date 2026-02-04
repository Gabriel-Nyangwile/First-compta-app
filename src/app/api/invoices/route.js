// PATCH /api/invoices
export async function PATCH(request) {
  try {
    const { requireCompanyId } = await import('@/lib/tenant');
    const companyId = requireCompanyId(request);
    const body = await request.json();
    const invoiceId = body?.invoiceId || body?.id;
    const status = body?.status;
    if (!invoiceId || status !== "CANCELLED") {
      return NextResponse.json(
        { error: "invoiceId et status=CANCELLED requis" },
        { status: 400 }
      );
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { invoiceLines: true },
    });
    if (!invoice) {
      return NextResponse.json(
        { error: "Facture introuvable" },
        { status: 404 }
      );
    }

    for (const line of invoice.invoiceLines) {
      if (line.salesOrderLineId && line.quantity) {
        const soLine = await prisma.salesOrderLine.findUnique({
          where: { id: line.salesOrderLineId },
        });
        if (!soLine) continue;
        const prev =
          soLine.quantityInvoiced?.toNumber?.() ??
          Number(soLine.quantityInvoiced ?? 0);
        const toDecrement =
          line.quantity?.toNumber?.() ?? Number(line.quantity ?? 0);
        const next = Math.max(0, prev - toDecrement);
        await prisma.salesOrderLine.update({
          where: { id: soLine.id },
          data: { quantityInvoiced: next.toFixed(3) },
        });
      }
    }
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "CANCELLED" },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Erreur annulation facture" },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { applyOutMovement } from "@/lib/inventory";
import { getSystemAccounts } from "@/lib/systemAccounts";
import { finalizeBatchToJournal } from "@/lib/journal";
import { toNumber } from "@/lib/salesOrder";
import { requireCompanyId } from "@/lib/tenant";

// GET /api/invoices
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const paymentFilter = searchParams.get("payment"); // paid|unpaid|partial|all
  const companyId = requireCompanyId(request);
  // Mettre à jour à la volée les statuts OVERDUE (lazy update)
  const now = new Date();
  await prisma.invoice.updateMany({
    where: {
      companyId,
      status: { in: ["PENDING", "OVERDUE"] },
      dueDate: { lt: now },
      transactions: { none: { kind: "PAYMENT" } },
    },
    data: { status: "OVERDUE" },
  });
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10))
  );
  const totalCount = await prisma.invoice.count({ where: { companyId } });
  let invoices = await prisma.invoice.findMany({
    where: { companyId },
    include: {
      client: true,
      moneyMovements: {
        select: {
          id: true,
          date: true,
          amount: true,
          voucherRef: true,
          direction: true,
        },
        orderBy: { date: "asc" },
      },
    },
    orderBy: { issueDate: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  // Calcul dynamique statut partiel & filtrage paiement
  invoices = invoices.map((inv) => {
    const paid = Number(inv.paidAmount || 0);
    const total = Number(inv.totalAmount || 0);
    let dynStatus = inv.status;
    if (total > 0 && paid > 0 && paid < total) dynStatus = "PARTIAL";
    return { ...inv, status: dynStatus };
  });
  if (paymentFilter && paymentFilter !== "all") {
    invoices = invoices.filter((inv) => {
      const paid = Number(inv.paidAmount || 0);
      const total = Number(inv.totalAmount || 0);
      switch (paymentFilter) {
        case "paid":
          return total > 0 && paid >= total;
        case "unpaid":
          return paid === 0;
        case "partial":
          return total > 0 && paid > 0 && paid < total;
        default:
          return true;
      }
    });
  }
  const clients = await prisma.client.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
  });
  return new Response(
    JSON.stringify({ invoices, clients, page, pageSize, totalCount }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

// POST /api/invoices
export async function POST(request) {
  try {
    const companyId = requireCompanyId(request);
    const data = await request.json();
    const {
      clientId,
      issueDate,
      dueDate,
      vat, // taux global fallback (legacy)
      invoiceLines,
      userId,
      status,
      invoiceNumber,
      salesOrderId: rawSalesOrderId,
    } = data;

    if (!Array.isArray(invoiceLines) || !invoiceLines.length) {
      return NextResponse.json(
        { error: "invoiceLines requis" },
        { status: 400 }
      );
    }

    const salesOrderId = rawSalesOrderId ? String(rawSalesOrderId) : null;
    if (!salesOrderId) {
      return NextResponse.json(
        { error: "Un bon de commande confirmé est requis pour créer la facture." },
        { status: 400 }
      );
    }
    let salesOrder = null;
    let salesOrderLineMap = null;
    if (salesOrderId) {
      salesOrder = await prisma.salesOrder.findFirst({
        where: { id: salesOrderId, companyId },
        include: {
          lines: {
            include: {
              product: { select: { id: true, name: true, unit: true } },
            },
          },
        },
      });
      if (!salesOrder) {
        throw new Error("Commande client introuvable.");
      }
      if (salesOrder.status === "DRAFT") {
        throw new Error("La commande doit être confirmée avant facturation.");
      }
      salesOrderLineMap = new Map(
        salesOrder.lines.map((line) => [line.id, line])
      );
      if (salesOrder.clientId && clientId && salesOrder.clientId !== clientId) {
        throw new Error(
          "Le client de la facture doit correspondre à la commande."
        );
      }
    }

    const resolvedClientId = clientId || salesOrder?.clientId || null;

    if (invoiceLines.some((line) => !line?.salesOrderLineId)) {
      return NextResponse.json(
        {
          error:
            "Chaque ligne de facture doit être reliée à une ligne du bon de commande sélectionné.",
        },
        { status: 400 }
      );
    }

    let clientRecord = null;
    if (resolvedClientId) {
      clientRecord = await prisma.client.findFirst({
        where: { id: resolvedClientId, companyId },
        select: { id: true, name: true, accountId: true },
      });
      if (clientRecord && !clientRecord.accountId) {
        return NextResponse.json(
          {
            error: `Le client ${clientRecord.name} n'a pas de compte comptable (411).`,
          },
          { status: 400 }
        );
      }
    }

    // Préparation / calcul totaux multi-taux potentiel
    let totalAmountHt = 0;
    const vatBuckets = new Map(); // key: rate string, value: { base, vat }
    const orderLineUsage = new Map();
    const normalizedLines = invoiceLines.map((line, idx) => {
      const quantityNum = Number(line.quantity);
      if (!Number.isFinite(quantityNum) || quantityNum <= 0) {
        throw new Error(`Ligne ${idx + 1}: quantité invalide.`);
      }

      let unitPriceNum =
        line.unitPrice !== undefined && line.unitPrice !== null
          ? Number(line.unitPrice)
          : Number.NaN;

      const salesOrderLineId = line.salesOrderLineId
        ? String(line.salesOrderLineId)
        : null;

      let resolvedAccountId = line.accountId ? String(line.accountId) : null;
      let resolvedDescription = String(line.description || "").trim();
      let resolvedUnit = String(line.unitOfMeasure || "").trim();
      let productId = line.productId ? String(line.productId) : null;
      let linkedOrderLine = null;

      if (salesOrderLineId) {
        if (!salesOrder || !salesOrderLineMap) {
          throw new Error(
            `Ligne ${idx + 1}: salesOrderId requis pour lier la commande.`
          );
        }
        linkedOrderLine = salesOrderLineMap.get(salesOrderLineId);
        if (!linkedOrderLine) {
          throw new Error(`Ligne ${idx + 1}: ligne de commande introuvable.`);
        }

        const orderedQty = toNumber(linkedOrderLine.quantityOrdered);
        const shippedQty = Math.min(
          orderedQty,
          toNumber(linkedOrderLine.quantityShipped)
        );
        const invoicedQty = toNumber(linkedOrderLine.quantityInvoiced);
        const availableQty = Math.max(0, shippedQty - invoicedQty);
        const already = orderLineUsage.get(salesOrderLineId) ?? 0;
        if (availableQty <= 0) {
          throw new Error(
            `Ligne ${idx + 1}: aucune quantité expédiée disponible pour facturation.`
          );
        }
        if (quantityNum + already > availableQty + 1e-6) {
          throw new Error(
            `Ligne ${
              idx + 1
            }: quantité facturée supérieure au restant expédié (${availableQty.toFixed(
              3
            )}).`
          );
        }
        orderLineUsage.set(salesOrderLineId, already + quantityNum);

        if (productId && productId !== linkedOrderLine.productId) {
          throw new Error(
            `Ligne ${idx + 1}: produit différent de la commande.`
          );
        }
        if (!productId) {
          productId = linkedOrderLine.productId;
        }

        if (
          resolvedAccountId &&
          linkedOrderLine.accountId &&
          resolvedAccountId !== linkedOrderLine.accountId
        ) {
          throw new Error(`Ligne ${idx + 1}: compte différent de la commande.`);
        }
        if (!resolvedAccountId) {
          resolvedAccountId = linkedOrderLine.accountId || null;
        }
        if (!resolvedAccountId) {
          throw new Error(
            `Ligne ${idx + 1}: accountId requis (commande sans compte).`
          );
        }

        if (!resolvedDescription) {
          resolvedDescription =
            linkedOrderLine.description ||
            linkedOrderLine.product?.name ||
            "Article";
        }

        if (!resolvedUnit) {
          resolvedUnit =
            linkedOrderLine.unit || linkedOrderLine.product?.unit || "";
        }

        if (!Number.isFinite(unitPriceNum)) {
          unitPriceNum = toNumber(linkedOrderLine.unitPrice);
        }
      } else if (!resolvedAccountId) {
        throw new Error(`Ligne ${idx + 1}: accountId requis.`);
      }

      if (!Number.isFinite(unitPriceNum) || unitPriceNum < 0) {
        throw new Error(`Ligne ${idx + 1}: prix unitaire invalide.`);
      }

      const lineTotalNum = quantityNum * unitPriceNum;
      totalAmountHt += lineTotalNum;

      let lineVatRate =
        line.vatRate !== undefined &&
        line.vatRate !== null &&
        line.vatRate !== ""
          ? Number(line.vatRate)
          : undefined;
      if (
        lineVatRate !== undefined &&
        (!Number.isFinite(lineVatRate) || lineVatRate < 0)
      ) {
        throw new Error(`Ligne ${idx + 1}: taux de TVA invalide.`);
      }
      if (
        lineVatRate === undefined &&
        linkedOrderLine &&
        linkedOrderLine.vatRate != null
      ) {
        lineVatRate = toNumber(linkedOrderLine.vatRate);
      }
      if (lineVatRate === undefined) {
        const fallback = Number(vat);
        if (!Number.isNaN(fallback) && fallback >= 0) {
          lineVatRate = fallback;
        } else {
          lineVatRate = 0;
        }
      }

      const lineVatAmount = lineTotalNum * lineVatRate;
      const bucketKey = lineVatRate.toFixed(2);
      const bucket = vatBuckets.get(bucketKey) || { base: 0, vat: 0 };
      bucket.base += lineTotalNum;
      bucket.vat += lineVatAmount;
      vatBuckets.set(bucketKey, bucket);

      return {
        index: idx,
        description: resolvedDescription || "Article",
        accountId: resolvedAccountId,
        unitOfMeasure: resolvedUnit,
        quantity: String(quantityNum),
        unitPrice: String(unitPriceNum),
        lineTotal: String(lineTotalNum),
        vatRate: lineVatRate,
        productId: productId || null,
        salesOrderLineId,
        rawQuantity: quantityNum,
      };
    });
    // Agrégation VAT
    let vatAmount = 0;
    for (const { vat } of vatBuckets.values()) vatAmount += vat;
    const totalAmount = totalAmountHt + vatAmount;

    // Choix du champ invoice.vat : on garde la valeur globale si homogène sinon 0 (ou premier) -> ici on choisit si un seul bucket => ce taux, sinon 0
    let invoiceLevelVat = 0;
    if (vatBuckets.size === 1) {
      invoiceLevelVat = Number([...vatBuckets.keys()][0]);
    }

    const { vatAccount } = await getSystemAccounts();
    const clientAccountId = clientRecord?.accountId || null;
    const targetClientId = resolvedClientId;

    const createdInvoice = await prisma.$transaction(async (tx) => {
      // Créer la facture sans lignes/écritures dans un premier temps
      const inv = await tx.invoice.create({
        data: {
          companyId,
          clientId: targetClientId,
          issueDate: issueDate ? new Date(issueDate) : undefined,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          vat: invoiceLevelVat, // valeur indicative (legacy)
          totalAmountHt,
          vatAmount,
          totalAmount,
          userId,
          status,
          invoiceNumber: invoiceNumber
            ? String(invoiceNumber)
            : `INV-${Date.now()}`,
        },
      });

      // Créer lignes + transactions SALE immédiatement pour lier invoiceLineId sans heuristique
      const createdTxs = [];
      for (const l of normalizedLines) {
        const lineRecord = await tx.invoiceLine.create({
          data: {
            companyId,
            description: l.description,
            accountId: l.accountId,
            unitOfMeasure: l.unitOfMeasure,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineTotal: l.lineTotal,
            vatRate: l.vatRate !== undefined ? l.vatRate.toFixed(2) : undefined,
            invoiceId: inv.id,
            productId: l.productId || undefined,
            salesOrderLineId: l.salesOrderLineId || undefined,
          },
        });
        const saleTx = await tx.transaction.create({
          data: {
            companyId,
            nature: "receipt",
            // Description = description de la ligne (article)
            description: lineRecord.description,
            amount: l.lineTotal,
            direction: "CREDIT",
            kind: "SALE",
            accountId: l.accountId,
            clientId: targetClientId || undefined,
            invoiceId: inv.id,
            invoiceLineId: lineRecord.id,
          },
        });
        createdTxs.push(saleTx);
        // Si la ligne référence un produit stocké sans flux de préparation, on déclenche la sortie
        const shouldApplyOutMovement = l.productId && !l.salesOrderLineId;
        if (shouldApplyOutMovement) {
          try {
            const out = await applyOutMovement(tx, {
              productId: l.productId,
              qty: l.rawQuantity,
            });
            await tx.stockMovement.create({
              data: {
                companyId,
                productId: l.productId,
                movementType: "OUT",
                quantity: l.quantity,
                unitCost: out.unitCost.toFixed(4),
                totalCost: out.totalCost.toFixed(2),
                invoiceLineId: lineRecord.id,
              },
            });
          } catch (e) {
            // Stock insuffisant: on peut soit échouer soit autoriser coût null. Ici on échoue.
            throw new Error(
              `Stock insuffisant pour le produit lié à la ligne ${l.index + 1}.`
            );
          }
        }
      }

      // Créance client (411) TTC
      if (clientAccountId) {
        const receivableTx = await tx.transaction.create({
          data: {
            companyId,
            nature: "receipt",
            description: `Créance facture ${inv.invoiceNumber}`,
            amount: String(totalAmount),
            direction: "DEBIT",
            kind: "RECEIVABLE",
            accountId: clientAccountId,
            clientId: targetClientId || undefined,
            invoiceId: inv.id,
          },
        });
        createdTxs.push(receivableTx);
      }

      // TVA collectée : une écriture par taux distinct pour traçabilité multi-taux
      if (vatAccount && vatBuckets.size) {
        for (const [rateStr, bucket] of vatBuckets.entries()) {
          if (bucket.vat <= 0) continue;
          const pct = (Number(rateStr) * 100).toFixed(2).replace(/\.00$/, "");
          const vatTx = await tx.transaction.create({
            data: {
              companyId,
              nature: "receipt",
              description: `TVA ${pct}% facture ${inv.invoiceNumber}`,
              amount: bucket.vat.toString(),
              direction: "CREDIT",
              kind: "VAT_COLLECTED",
              accountId: vatAccount.id,
              clientId: targetClientId || undefined,
              invoiceId: inv.id,
            },
          });
          createdTxs.push(vatTx);
        }
      }

      if (salesOrder && orderLineUsage.size) {
        for (const [lineId, qty] of orderLineUsage.entries()) {
          const currentLine = salesOrderLineMap?.get(lineId);
          const previous = currentLine
            ? toNumber(currentLine.quantityInvoiced)
            : 0;
          const nextValue = previous + qty;
          await tx.salesOrderLine.update({
            where: { id: lineId },
            data: { quantityInvoiced: nextValue.toFixed(3) },
          });
          if (currentLine) {
            currentLine.quantityInvoiced = nextValue;
          }
        }
      }

      // Journal entry (one per invoice creation)
      await finalizeBatchToJournal(tx, {
        sourceType: "INVOICE",
        sourceId: inv.id,
        date: inv.issueDate || new Date(),
        description: `Facture client ${inv.invoiceNumber}`,
        transactions: createdTxs,
      });

      return inv.id;
    });

    // Retour facture complète avec lignes & transactions déjà liées proprement
    const full = await prisma.invoice.findUnique({
      where: { id: createdInvoice },
      include: { invoiceLines: true, client: true, transactions: true },
    });
    return NextResponse.json(full, { status: 201 });
  } catch (error) {
    const message = error?.message;
    if (
      message &&
      (message.startsWith("Ligne") ||
        message.startsWith("Stock insuffisant") ||
        message === "Commande client introuvable." ||
        message === "La commande doit être confirmée avant facturation." ||
        message ===
          "Le client de la facture doit correspondre à la commande." ||
        message === "salesOrderId requis pour lier des lignes de commande.")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("Erreur création facture:", error);
    return NextResponse.json(
      { error: message || "Erreur lors de la création de la facture." },
      { status: 500 }
    );
  }
}
