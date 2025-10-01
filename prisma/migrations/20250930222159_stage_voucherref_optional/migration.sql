/*
  Warnings:

  - You are about to drop the column `transferGroupId` on the `MoneyMovement` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[voucherRef]` on the table `StockMovement` will be added. If there are existing duplicate values, this will fail.
  - Made the column `voucherRef` on table `MoneyMovement` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "public"."MoneyMovement_transferGroupId_idx";

-- DropIndex
DROP INDEX "public"."StockMovement_goodsReceiptLineId_idx";

-- AlterTable
ALTER TABLE "public"."IncomingInvoice" ADD COLUMN     "purchaseOrderId" TEXT;

-- AlterTable
-- Retain transferGroupId for now if data still references it; comment out drop until backfill/cleanup
-- ALTER TABLE "public"."MoneyMovement" DROP COLUMN "transferGroupId";
-- Keep voucherRef nullable at this stage (backfill first)
-- ALTER TABLE "public"."MoneyMovement" ALTER COLUMN "voucherRef" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."PurchaseOrderLine" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
-- StockMovement no longer needs voucherRef column in this stage; remove if accidentally added in diff
-- ALTER TABLE "public"."StockMovement" ADD COLUMN     "voucherRef" TEXT;

-- CreateTable
CREATE TABLE "public"."PurchaseOrderStatusLog" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "oldStatus" "public"."PurchaseOrderStatus",
    "newStatus" "public"."PurchaseOrderStatus" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "PurchaseOrderStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseOrderStatusLog_purchaseOrderId_idx" ON "public"."PurchaseOrderStatusLog"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "public"."AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "public"."AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "IncomingInvoice_purchaseOrderId_idx" ON "public"."IncomingInvoice"("purchaseOrderId");

-- CreateIndex
-- (Removed) Unique index on StockMovement.voucherRef skipped (column not added)

-- AddForeignKey
ALTER TABLE "public"."IncomingInvoice" ADD CONSTRAINT "IncomingInvoice_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "public"."PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderStatusLog" ADD CONSTRAINT "PurchaseOrderStatusLog_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "public"."PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
