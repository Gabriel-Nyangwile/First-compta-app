-- CreateEnum
CREATE TYPE "public"."MoneyAccountType" AS ENUM ('CASH', 'BANK');

-- CreateEnum
CREATE TYPE "public"."MovementDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "public"."MoneyMovementKind" AS ENUM ('CLIENT_RECEIPT', 'SUPPLIER_PAYMENT', 'VAT_PAYMENT', 'TAX_PAYMENT', 'CASH_PURCHASE', 'TRANSFER', 'OTHER');

-- AlterTable
ALTER TABLE "public"."Transaction" ADD COLUMN     "moneyMovementId" TEXT;

-- CreateTable
CREATE TABLE "public"."MoneyAccount" (
    "id" TEXT NOT NULL,
    "type" "public"."MoneyAccountType" NOT NULL,
    "label" TEXT NOT NULL,
    "code" TEXT,
    "iban" TEXT,
    "bic" TEXT,
    "bankName" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ledgerAccountId" TEXT,

    CONSTRAINT "MoneyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MoneyMovement" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(14,2) NOT NULL,
    "direction" "public"."MovementDirection" NOT NULL,
    "kind" "public"."MoneyMovementKind" NOT NULL,
    "moneyAccountId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "incomingInvoiceId" TEXT,
    "transferGroupId" TEXT,
    "description" TEXT,
    "voucherRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoneyMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MoneyAccount_code_key" ON "public"."MoneyAccount"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyAccount_iban_key" ON "public"."MoneyAccount"("iban");

-- CreateIndex
CREATE INDEX "MoneyAccount_ledgerAccountId_idx" ON "public"."MoneyAccount"("ledgerAccountId");

-- CreateIndex
CREATE INDEX "MoneyMovement_moneyAccountId_date_idx" ON "public"."MoneyMovement"("moneyAccountId", "date");

-- CreateIndex
CREATE INDEX "MoneyMovement_invoiceId_idx" ON "public"."MoneyMovement"("invoiceId");

-- CreateIndex
CREATE INDEX "MoneyMovement_incomingInvoiceId_idx" ON "public"."MoneyMovement"("incomingInvoiceId");

-- CreateIndex
CREATE INDEX "MoneyMovement_transferGroupId_idx" ON "public"."MoneyMovement"("transferGroupId");

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_moneyMovementId_fkey" FOREIGN KEY ("moneyMovementId") REFERENCES "public"."MoneyMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MoneyAccount" ADD CONSTRAINT "MoneyAccount_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "public"."Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MoneyMovement" ADD CONSTRAINT "MoneyMovement_moneyAccountId_fkey" FOREIGN KEY ("moneyAccountId") REFERENCES "public"."MoneyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MoneyMovement" ADD CONSTRAINT "MoneyMovement_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MoneyMovement" ADD CONSTRAINT "MoneyMovement_incomingInvoiceId_fkey" FOREIGN KEY ("incomingInvoiceId") REFERENCES "public"."IncomingInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
