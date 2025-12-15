/*
  Warnings:

  - A unique constraint covering the columns `[incomingInvoiceId]` on the table `AssetPurchaseOrder` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "AssetPurchaseOrder" ADD COLUMN     "incomingInvoiceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AssetPurchaseOrder_incomingInvoiceId_key" ON "AssetPurchaseOrder"("incomingInvoiceId");

-- AddForeignKey
ALTER TABLE "AssetPurchaseOrder" ADD CONSTRAINT "AssetPurchaseOrder_incomingInvoiceId_fkey" FOREIGN KEY ("incomingInvoiceId") REFERENCES "IncomingInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
