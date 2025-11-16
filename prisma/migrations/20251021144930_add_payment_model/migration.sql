-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('VIREMENT', 'CHEQUE', 'ESPECES', 'CB', 'AUTRE');

-- DropForeignKey
ALTER TABLE "public"."InventoryCountLine" DROP CONSTRAINT "InventoryCountLine_inventoryCountId_fkey";

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(14,2) NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentInvoiceLink" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "incomingInvoiceId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentInvoiceLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentInvoiceLink_paymentId_idx" ON "PaymentInvoiceLink"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentInvoiceLink_invoiceId_idx" ON "PaymentInvoiceLink"("invoiceId");

-- CreateIndex
CREATE INDEX "PaymentInvoiceLink_incomingInvoiceId_idx" ON "PaymentInvoiceLink"("incomingInvoiceId");

-- AddForeignKey
ALTER TABLE "PaymentInvoiceLink" ADD CONSTRAINT "PaymentInvoiceLink_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentInvoiceLink" ADD CONSTRAINT "PaymentInvoiceLink_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentInvoiceLink" ADD CONSTRAINT "PaymentInvoiceLink_incomingInvoiceId_fkey" FOREIGN KEY ("incomingInvoiceId") REFERENCES "IncomingInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_inventoryCountId_fkey" FOREIGN KEY ("inventoryCountId") REFERENCES "InventoryCount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
