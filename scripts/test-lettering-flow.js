#!/usr/bin/env node
import assert from "node:assert/strict";
import prisma from "../src/lib/prisma.js";
import { matchPartyInvoice } from "../src/lib/lettering/matchPartyInvoice.js";

function toNumber(value) {
  return value?.toNumber?.() ?? Number(value ?? 0);
}

async function main() {
  const company = await prisma.company.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, currency: true },
  });

  if (!company) {
    throw new Error("Aucune société disponible");
  }

  const suffix = `LTRFLOW-${Date.now()}`;
  const created = {
    transactions: [],
    movements: [],
    invoices: [],
    incomingInvoices: [],
    clients: [],
    suppliers: [],
    accounts: [],
    moneyAccounts: [],
  };

  try {
    const bankAccount = await prisma.account.create({
      data: {
        companyId: company.id,
        number: `521${Date.now().toString().slice(-6)}`,
        label: `${suffix} banque`,
      },
      select: { id: true },
    });
    created.accounts.push(bankAccount.id);

    const clientAccount = await prisma.account.create({
      data: {
        companyId: company.id,
        number: `411${Date.now().toString().slice(-6)}`,
        label: `${suffix} client`,
      },
      select: { id: true },
    });
    created.accounts.push(clientAccount.id);

    const supplierAccount = await prisma.account.create({
      data: {
        companyId: company.id,
        number: `401${Date.now().toString().slice(-6)}`,
        label: `${suffix} fournisseur`,
      },
      select: { id: true },
    });
    created.accounts.push(supplierAccount.id);

    const moneyAccount = await prisma.moneyAccount.create({
      data: {
        companyId: company.id,
        type: "BANK",
        label: `${suffix} banque principale`,
        code: suffix,
        currency: company.currency || "XOF",
        openingBalance: 0,
        ledgerAccountId: bankAccount.id,
      },
      select: { id: true },
    });
    created.moneyAccounts.push(moneyAccount.id);

    const client = await prisma.client.create({
      data: {
        companyId: company.id,
        name: `${suffix} client`,
        email: `${suffix.toLowerCase()}@client.test`,
        accountId: clientAccount.id,
      },
      select: { id: true },
    });
    created.clients.push(client.id);

    const wrongClient = await prisma.client.create({
      data: {
        companyId: company.id,
        name: `${suffix} client mismatch`,
        email: `${suffix.toLowerCase()}-mismatch@client.test`,
      },
      select: { id: true },
    });
    created.clients.push(wrongClient.id);

    const supplier = await prisma.supplier.create({
      data: {
        companyId: company.id,
        name: `${suffix} fournisseur`,
        accountId: supplierAccount.id,
      },
      select: { id: true },
    });
    created.suppliers.push(supplier.id);

    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invoice = await prisma.invoice.create({
      data: {
        companyId: company.id,
        invoiceNumber: `${suffix}-CLI`,
        clientId: client.id,
        dueDate,
        totalAmount: 100,
        totalAmountHt: 100,
        vat: 0,
        vatAmount: 0,
        paidAmount: 0,
        outstandingAmount: 100,
      },
      select: { id: true },
    });
    created.invoices.push(invoice.id);

    const incomingInvoice = await prisma.incomingInvoice.create({
      data: {
        companyId: company.id,
        entryNumber: `${suffix}-SUP`,
        supplierInvoiceNumber: `${suffix}-SUP-REF`,
        supplierId: supplier.id,
        dueDate,
        totalAmount: 80,
        totalAmountHt: 80,
        vat: 0,
        vatAmount: 0,
        paidAmount: 0,
        outstandingAmount: 80,
      },
      select: { id: true },
    });
    created.incomingInvoices.push(incomingInvoice.id);

    const clientMovement = await prisma.moneyMovement.create({
      data: {
        companyId: company.id,
        amount: 100,
        direction: "IN",
        kind: "CLIENT_RECEIPT",
        moneyAccountId: moneyAccount.id,
        invoiceId: invoice.id,
        description: `${suffix} encaissement client`,
        voucherRef: `${suffix}-MV-CLI`,
      },
      select: { id: true },
    });
    created.movements.push(clientMovement.id);

    const supplierMovement = await prisma.moneyMovement.create({
      data: {
        companyId: company.id,
        amount: 50,
        direction: "OUT",
        kind: "SUPPLIER_PAYMENT",
        moneyAccountId: moneyAccount.id,
        incomingInvoiceId: incomingInvoice.id,
        supplierId: supplier.id,
        description: `${suffix} paiement fournisseur`,
        voucherRef: `${suffix}-MV-SUP`,
      },
      select: { id: true },
    });
    created.movements.push(supplierMovement.id);

    const clientInvoiceTx = await prisma.transaction.create({
      data: {
        companyId: company.id,
        amount: 100,
        direction: "DEBIT",
        kind: "RECEIVABLE",
        accountId: clientAccount.id,
        invoiceId: invoice.id,
        clientId: client.id,
        description: `${suffix} créance client`,
      },
      select: { id: true },
    });
    created.transactions.push(clientInvoiceTx.id);

    const clientPaymentTx = await prisma.transaction.create({
      data: {
        companyId: company.id,
        amount: 100,
        direction: "CREDIT",
        kind: "PAYMENT",
        accountId: bankAccount.id,
        clientId: client.id,
        moneyMovementId: clientMovement.id,
        description: `${suffix} règlement client`,
      },
      select: { id: true },
    });
    created.transactions.push(clientPaymentTx.id);

    const supplierInvoiceTx = await prisma.transaction.create({
      data: {
        companyId: company.id,
        amount: 80,
        direction: "CREDIT",
        kind: "PAYABLE",
        accountId: supplierAccount.id,
        incomingInvoiceId: incomingInvoice.id,
        supplierId: supplier.id,
        description: `${suffix} dette fournisseur`,
      },
      select: { id: true },
    });
    created.transactions.push(supplierInvoiceTx.id);

    const supplierPaymentTx = await prisma.transaction.create({
      data: {
        companyId: company.id,
        amount: 50,
        direction: "DEBIT",
        kind: "PAYMENT",
        accountId: bankAccount.id,
        supplierId: supplier.id,
        moneyMovementId: supplierMovement.id,
        description: `${suffix} règlement fournisseur`,
      },
      select: { id: true },
    });
    created.transactions.push(supplierPaymentTx.id);

    const clientResult = await matchPartyInvoice({
      party: "client",
      invoiceId: invoice.id,
      expectedPartyId: client.id,
      companyId: company.id,
    });

    assert.equal(clientResult.status, "MATCHED");
    assert.equal(clientResult.paymentCount, 1);
    assert.equal(clientResult.allocatedAmount, "100");

    const refreshedClientTransactions = await prisma.transaction.findMany({
      where: { id: { in: [clientInvoiceTx.id, clientPaymentTx.id] } },
      orderBy: { id: "asc" },
      select: {
        id: true,
        letterRef: true,
        letterStatus: true,
        letteredAmount: true,
      },
    });

    assert.equal(refreshedClientTransactions.length, 2);
    assert.ok(refreshedClientTransactions.every((tx) => tx.letterRef === clientResult.letterRef));
    assert.ok(refreshedClientTransactions.every((tx) => tx.letterStatus === "MATCHED"));
    assert.ok(refreshedClientTransactions.every((tx) => toNumber(tx.letteredAmount) === 100));

    const supplierResult = await matchPartyInvoice({
      party: "supplier",
      invoiceId: incomingInvoice.id,
      expectedPartyId: supplier.id,
      companyId: company.id,
    });

    assert.equal(supplierResult.status, "PARTIAL");
    assert.equal(supplierResult.paymentCount, 1);
    assert.equal(supplierResult.allocatedAmount, "50");
    assert.equal(supplierResult.remainingOnInvoice, "30");

    const refreshedSupplierTransactions = await prisma.transaction.findMany({
      where: { id: { in: [supplierInvoiceTx.id, supplierPaymentTx.id] } },
      orderBy: { id: "asc" },
      select: {
        id: true,
        letterRef: true,
        letterStatus: true,
        letteredAmount: true,
      },
    });

    assert.equal(refreshedSupplierTransactions.length, 2);
    assert.ok(refreshedSupplierTransactions.every((tx) => tx.letterRef === supplierResult.letterRef));
    const partialSupplierInvoiceTx = refreshedSupplierTransactions.find(
      (tx) => tx.id === supplierInvoiceTx.id
    );
    const matchedSupplierPaymentTx = refreshedSupplierTransactions.find(
      (tx) => tx.id === supplierPaymentTx.id
    );
    assert.equal(partialSupplierInvoiceTx?.letterStatus, "PARTIAL");
    assert.equal(toNumber(partialSupplierInvoiceTx?.letteredAmount), 50);
    assert.equal(matchedSupplierPaymentTx?.letterStatus, "MATCHED");
    assert.equal(toNumber(matchedSupplierPaymentTx?.letteredAmount), 50);

    await assert.rejects(
      () =>
        matchPartyInvoice({
          party: "client",
          invoiceId: invoice.id,
          expectedPartyId: wrongClient.id,
          companyId: company.id,
        }),
      /La facture ne correspond pas au tiers demandé/
    );

    console.log("test-lettering-flow: OK");
    console.log(
      JSON.stringify(
        {
          companyId: company.id,
          clientLetterRef: clientResult.letterRef,
          supplierLetterRef: supplierResult.letterRef,
        },
        null,
        2
      )
    );
  } finally {
    if (created.transactions.length) {
      await prisma.transaction.deleteMany({ where: { id: { in: created.transactions } } });
    }
    if (created.movements.length) {
      await prisma.moneyMovement.deleteMany({ where: { id: { in: created.movements } } });
    }
    if (created.invoices.length) {
      await prisma.invoice.deleteMany({ where: { id: { in: created.invoices } } });
    }
    if (created.incomingInvoices.length) {
      await prisma.incomingInvoice.deleteMany({
        where: { id: { in: created.incomingInvoices } },
      });
    }
    if (created.clients.length) {
      await prisma.client.deleteMany({ where: { id: { in: created.clients } } });
    }
    if (created.suppliers.length) {
      await prisma.supplier.deleteMany({ where: { id: { in: created.suppliers } } });
    }
    if (created.moneyAccounts.length) {
      await prisma.moneyAccount.deleteMany({
        where: { id: { in: created.moneyAccounts } },
      });
    }
    if (created.accounts.length) {
      await prisma.account.deleteMany({ where: { id: { in: created.accounts } } });
    }
  }
}

main()
  .catch((error) => {
    console.error("test-lettering-flow: FAILED");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });