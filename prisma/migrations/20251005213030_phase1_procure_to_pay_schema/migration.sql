-- CreateEnum
CREATE TYPE "public"."StockMovementStage" AS ENUM ('STAGED', 'AVAILABLE');

-- CreateEnum
CREATE TYPE "public"."GoodsReceiptLineStatus" AS ENUM ('RECEIVED', 'QC_PENDING', 'QC_REJECTED', 'PUTAWAY_PENDING', 'PUTAWAY_DONE');

-- CreateEnum
CREATE TYPE "public"."QualityStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."GoodsReceiptStatus" ADD VALUE 'QC_PENDING';
ALTER TYPE "public"."GoodsReceiptStatus" ADD VALUE 'PUTAWAY_PENDING';
ALTER TYPE "public"."GoodsReceiptStatus" ADD VALUE 'PUTAWAY_DONE';

-- AlterTable
ALTER TABLE "public"."GoodsReceipt" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "putAwayCompletedAt" TIMESTAMP(3),
ADD COLUMN     "qcCompletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."GoodsReceiptLine" ADD COLUMN     "putAwayAt" TIMESTAMP(3),
ADD COLUMN     "qcCheckedAt" TIMESTAMP(3),
ADD COLUMN     "qcNote" TEXT,
ADD COLUMN     "qcStatus" "public"."QualityStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "qtyPutAway" DECIMAL(14,3) NOT NULL DEFAULT 0,
ADD COLUMN     "status" "public"."GoodsReceiptLineStatus" NOT NULL DEFAULT 'RECEIVED',
ADD COLUMN     "storageLocationId" TEXT;

-- AlterTable
ALTER TABLE "public"."IncomingInvoiceLine" ADD COLUMN     "goodsReceiptLineId" TEXT,
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "purchaseOrderLineId" TEXT;

-- AlterTable
ALTER TABLE "public"."ProductInventory" ADD COLUMN     "qtyStaged" DECIMAL(18,3) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."PurchaseOrderLine" ADD COLUMN     "billedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
ADD COLUMN     "expectedUnitPrice" DECIMAL(14,4),
ADD COLUMN     "expectedVatRate" DECIMAL(4,2);

-- AlterTable
ALTER TABLE "public"."StockMovement" ADD COLUMN     "stage" "public"."StockMovementStage" NOT NULL DEFAULT 'AVAILABLE';

-- CreateTable
CREATE TABLE "public"."StorageLocation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StorageLocation_code_key" ON "public"."StorageLocation"("code");

-- CreateIndex
CREATE INDEX "GoodsReceipt_createdById_idx" ON "public"."GoodsReceipt"("createdById");

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_storageLocationId_idx" ON "public"."GoodsReceiptLine"("storageLocationId");

-- CreateIndex
CREATE INDEX "IncomingInvoiceLine_goodsReceiptLineId_idx" ON "public"."IncomingInvoiceLine"("goodsReceiptLineId");

-- CreateIndex
CREATE INDEX "IncomingInvoiceLine_purchaseOrderLineId_idx" ON "public"."IncomingInvoiceLine"("purchaseOrderLineId");

-- CreateIndex
CREATE INDEX "IncomingInvoiceLine_productId_idx" ON "public"."IncomingInvoiceLine"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_stage_idx" ON "public"."StockMovement"("stage");

-- AddForeignKey
ALTER TABLE "public"."GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "public"."StorageLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IncomingInvoiceLine" ADD CONSTRAINT "IncomingInvoiceLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IncomingInvoiceLine" ADD CONSTRAINT "IncomingInvoiceLine_goodsReceiptLineId_fkey" FOREIGN KEY ("goodsReceiptLineId") REFERENCES "public"."GoodsReceiptLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IncomingInvoiceLine" ADD CONSTRAINT "IncomingInvoiceLine_purchaseOrderLineId_fkey" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "public"."PurchaseOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
