-- CreateEnum
CREATE TYPE "public"."AuthorizationDocType" AS ENUM ('PCD', 'PCR', 'OP');

-- CreateEnum
CREATE TYPE "public"."AuthorizationScope" AS ENUM ('CASH', 'BANK');

-- CreateEnum
CREATE TYPE "public"."FlowDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "public"."AuthorizationStatus" AS ENUM ('DRAFT', 'AUTHORIZED', 'EXECUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."BeneficiaryType" AS ENUM ('SUPPLIER', 'CLIENT', 'EMPLOYEE', 'ASSOCIATE', 'STATE', 'ORGANISM', 'INTERNAL_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."InstrumentType" AS ENUM ('CASH', 'CHEQUE', 'TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."BankAdviceType" AS ENUM ('DEBIT', 'CREDIT');

-- AlterTable
ALTER TABLE "public"."MoneyMovement" ADD COLUMN     "authorizationId" TEXT,
ADD COLUMN     "bankAdviceId" TEXT;

-- CreateTable
CREATE TABLE "public"."TreasuryAuthorization" (
    "id" TEXT NOT NULL,
    "docType" "public"."AuthorizationDocType" NOT NULL,
    "scope" "public"."AuthorizationScope" NOT NULL,
    "flow" "public"."FlowDirection" NOT NULL,
    "status" "public"."AuthorizationStatus" NOT NULL DEFAULT 'DRAFT',
    "docNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "beneficiaryType" "public"."BeneficiaryType",
    "beneficiaryAccountId" TEXT,
    "invoiceId" TEXT,
    "incomingInvoiceId" TEXT,
    "purpose" TEXT,
    "instrumentType" "public"."InstrumentType",
    "instrumentRef" TEXT,
    "executedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreasuryAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BankAdvice" (
    "id" TEXT NOT NULL,
    "adviceType" "public"."BankAdviceType" NOT NULL,
    "refNumber" TEXT,
    "adviceDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "authorizationId" TEXT,
    "purpose" TEXT,
    "invoiceId" TEXT,
    "incomingInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAdvice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryAuthorization_docNumber_key" ON "public"."TreasuryAuthorization"("docNumber");

-- CreateIndex
CREATE INDEX "TreasuryAuthorization_docType_issueDate_idx" ON "public"."TreasuryAuthorization"("docType", "issueDate");

-- CreateIndex
CREATE INDEX "TreasuryAuthorization_status_idx" ON "public"."TreasuryAuthorization"("status");

-- CreateIndex
CREATE INDEX "BankAdvice_adviceType_adviceDate_idx" ON "public"."BankAdvice"("adviceType", "adviceDate");

-- CreateIndex
CREATE INDEX "BankAdvice_authorizationId_idx" ON "public"."BankAdvice"("authorizationId");

-- CreateIndex
CREATE INDEX "MoneyMovement_authorizationId_idx" ON "public"."MoneyMovement"("authorizationId");

-- CreateIndex
CREATE INDEX "MoneyMovement_bankAdviceId_idx" ON "public"."MoneyMovement"("bankAdviceId");

-- AddForeignKey
ALTER TABLE "public"."MoneyMovement" ADD CONSTRAINT "MoneyMovement_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "public"."TreasuryAuthorization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MoneyMovement" ADD CONSTRAINT "MoneyMovement_bankAdviceId_fkey" FOREIGN KEY ("bankAdviceId") REFERENCES "public"."BankAdvice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TreasuryAuthorization" ADD CONSTRAINT "TreasuryAuthorization_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TreasuryAuthorization" ADD CONSTRAINT "TreasuryAuthorization_incomingInvoiceId_fkey" FOREIGN KEY ("incomingInvoiceId") REFERENCES "public"."IncomingInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BankAdvice" ADD CONSTRAINT "BankAdvice_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "public"."TreasuryAuthorization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BankAdvice" ADD CONSTRAINT "BankAdvice_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BankAdvice" ADD CONSTRAINT "BankAdvice_incomingInvoiceId_fkey" FOREIGN KEY ("incomingInvoiceId") REFERENCES "public"."IncomingInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
