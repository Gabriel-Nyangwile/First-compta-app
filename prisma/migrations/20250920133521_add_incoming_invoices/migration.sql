-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."TransactionKind" ADD VALUE 'PAYABLE';
ALTER TYPE "public"."TransactionKind" ADD VALUE 'PURCHASE';
ALTER TYPE "public"."TransactionKind" ADD VALUE 'VAT_DEDUCTIBLE';

-- AlterTable
ALTER TABLE "public"."Transaction" ADD COLUMN     "incomingInvoiceId" TEXT;

-- CreateTable
CREATE TABLE "public"."IncomingInvoice" (
    "id" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplierInvoiceNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalAmountHt" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "vat" DECIMAL(4,2) NOT NULL DEFAULT 0.2,
    "vatAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "supplierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncomingInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IncomingInvoiceLine" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unitOfMeasure" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "lineTotal" DECIMAL(10,2) NOT NULL,
    "accountId" TEXT NOT NULL,
    "incomingInvoiceId" TEXT NOT NULL,

    CONSTRAINT "IncomingInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IncomingInvoice_entryNumber_key" ON "public"."IncomingInvoice"("entryNumber");

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_incomingInvoiceId_fkey" FOREIGN KEY ("incomingInvoiceId") REFERENCES "public"."IncomingInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IncomingInvoice" ADD CONSTRAINT "IncomingInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IncomingInvoiceLine" ADD CONSTRAINT "IncomingInvoiceLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IncomingInvoiceLine" ADD CONSTRAINT "IncomingInvoiceLine_incomingInvoiceId_fkey" FOREIGN KEY ("incomingInvoiceId") REFERENCES "public"."IncomingInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
