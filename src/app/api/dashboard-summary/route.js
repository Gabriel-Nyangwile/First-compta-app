import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireCompanyId } from "@/lib/tenant";

export async function GET(req) {
  try {
    const companyId = requireCompanyId(req);
    const now = new Date();
    const [
      company,
      totalClients,
      totalInvoices,
      overdueInvoices,
      invoicedAgg,
      totalTransactions,
      totalSuppliers,
      totalIncomingInvoices,
      overdueIncomingInvoices,
      incomingAgg,
      capitalOperationCount,
      capitalOperationStatusCounts,
      capitalTargetAgg,
      registeredCapitalAgg,
      subscriptionAgg,
      callAgg,
      paymentAgg,
    ] = await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: {
          name: true,
          legalForm: true,
          currency: true,
          country: true,
          fiscalYearStart: true,
        },
      }),
      prisma.client.count({ where: { companyId } }),
      prisma.invoice.count({ where: { companyId } }),
      prisma.invoice.count({
        where: {
          companyId,
          status: "PENDING",
          dueDate: { lt: now },
        },
      }),
      prisma.invoice.aggregate({ where: { companyId }, _sum: { totalAmount: true } }),
      prisma.transaction.aggregate({ where: { companyId }, _sum: { amount: true } }),
      prisma.supplier.count({ where: { companyId } }),
      prisma.incomingInvoice.count({ where: { companyId } }),
      prisma.incomingInvoice.count({
        where: {
          companyId,
          status: "PENDING",
          dueDate: { lt: now },
        },
      }),
      prisma.incomingInvoice.aggregate({ where: { companyId }, _sum: { totalAmount: true } }),
      prisma.capitalOperation.count({ where: { companyId } }),
      prisma.capitalOperation.groupBy({
        by: ["status"],
        where: { companyId },
        _count: { _all: true },
      }),
      prisma.capitalOperation.aggregate({
        where: {
          companyId,
          status: { in: ["OPEN", "CLOSED", "REGISTERED"] },
        },
        _sum: {
          nominalTarget: true,
          premiumTarget: true,
        },
      }),
      prisma.capitalOperation.aggregate({
        where: {
          companyId,
          status: "REGISTERED",
        },
        _sum: {
          nominalTarget: true,
          premiumTarget: true,
        },
      }),
      prisma.capitalSubscription.aggregate({
        where: { companyId },
        _sum: {
          nominalAmount: true,
          premiumAmount: true,
        },
      }),
      prisma.capitalCall.aggregate({
        where: { companyId },
        _sum: {
          amountCalled: true,
        },
      }),
      prisma.capitalPayment.aggregate({
        where: { companyId },
        _sum: {
          amount: true,
        },
      }),
    ]);

    const capitalStatuses = capitalOperationStatusCounts.reduce((acc, item) => {
      acc[item.status] = item._count._all;
      return acc;
    }, {});

    const subscribedNominal = Number(subscriptionAgg._sum.nominalAmount || 0);
    const subscribedPremium = Number(subscriptionAgg._sum.premiumAmount || 0);
    const calledAmount = Number(callAgg._sum.amountCalled || 0);
    const paidAmount = Number(paymentAgg._sum.amount || 0);
    const registeredNominal = Number(registeredCapitalAgg._sum.nominalTarget || 0);
    const registeredPremium = Number(registeredCapitalAgg._sum.premiumTarget || 0);
    const targetNominal = Number(capitalTargetAgg._sum.nominalTarget || 0);
    const targetPremium = Number(capitalTargetAgg._sum.premiumTarget || 0);

    let capitalStateLabel = "Capital non paramétré";
    if ((capitalStatuses.REGISTERED || 0) > 0) {
      capitalStateLabel = "Capital enregistré";
    } else if ((capitalStatuses.OPEN || 0) > 0 || (capitalStatuses.CLOSED || 0) > 0) {
      capitalStateLabel = "Opération de capital en cours";
    } else if ((capitalStatuses.DRAFT || 0) > 0) {
      capitalStateLabel = "Projet de capital à finaliser";
    }

    return NextResponse.json({
      company: {
        name: company?.name || null,
        legalForm: company?.legalForm || null,
        country: company?.country || null,
        currency: company?.currency || "XOF",
        fiscalCurrency: company?.currency || "XOF",
        fiscalYearStart: company?.fiscalYearStart || null,
      },
      capital: {
        statusLabel: capitalStateLabel,
        operationsCount: capitalOperationCount,
        statuses: capitalStatuses,
        targetNominal,
        targetPremium,
        registeredNominal,
        registeredPremium,
        subscribedNominal,
        subscribedPremium,
        calledAmount,
        paidAmount,
        uncalledAmount: Math.max(subscribedNominal - calledAmount, 0),
        unpaidCalledAmount: Math.max(calledAmount - paidAmount, 0),
      },
      clients: { count: totalClients },
      invoices: {
        count: totalInvoices,
        overdue: overdueInvoices,
        totalAmount: Number(invoicedAgg._sum.totalAmount || 0),
      },
      transactions: { totalAmount: Number(totalTransactions._sum.amount || 0) },
      suppliers: { count: totalSuppliers },
      incomingInvoices: {
        count: totalIncomingInvoices,
        overdue: overdueIncomingInvoices,
        totalAmount: Number(incomingAgg._sum.totalAmount || 0),
      },
    });
  } catch (e) {
    console.error("GET /api/dashboard-summary error", e);
    return NextResponse.json({ error: "Erreur récupération dashboard." }, { status: 500 });
  }
}
