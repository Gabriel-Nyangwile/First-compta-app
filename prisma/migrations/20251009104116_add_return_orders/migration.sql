-- CreateEnum
CREATE TYPE "ReturnOrderStatus" AS ENUM ('DRAFT', 'SENT', 'CLOSED', 'CANCELLED');

-- AlterTable
ALTER TABLE "PurchaseOrderLine" ADD COLUMN     "returnedQty" DECIMAL(14,3) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "returnOrderLineId" TEXT;

-- CreateTable
CREATE TABLE "ReturnOrder" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "ReturnOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "supplierId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "goodsReceiptId" TEXT,
    "reason" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnOrderLine" (
    "id" TEXT NOT NULL,
    "returnOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "goodsReceiptLineId" TEXT,
    "purchaseOrderLineId" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitCost" DECIMAL(14,4) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReturnOrder_number_key" ON "ReturnOrder"("number");

-- CreateIndex
CREATE INDEX "ReturnOrder_supplierId_idx" ON "ReturnOrder"("supplierId");

-- CreateIndex
CREATE INDEX "ReturnOrder_purchaseOrderId_idx" ON "ReturnOrder"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "ReturnOrder_goodsReceiptId_idx" ON "ReturnOrder"("goodsReceiptId");

-- CreateIndex
CREATE INDEX "ReturnOrder_status_idx" ON "ReturnOrder"("status");

-- CreateIndex
CREATE INDEX "ReturnOrderLine_returnOrderId_idx" ON "ReturnOrderLine"("returnOrderId");

-- CreateIndex
CREATE INDEX "ReturnOrderLine_goodsReceiptLineId_idx" ON "ReturnOrderLine"("goodsReceiptLineId");

-- CreateIndex
CREATE INDEX "ReturnOrderLine_purchaseOrderLineId_idx" ON "ReturnOrderLine"("purchaseOrderLineId");

-- CreateIndex
CREATE INDEX "ReturnOrderLine_productId_idx" ON "ReturnOrderLine"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_returnOrderLineId_idx" ON "StockMovement"("returnOrderLineId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_returnOrderLineId_fkey" FOREIGN KEY ("returnOrderLineId") REFERENCES "ReturnOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnOrder" ADD CONSTRAINT "ReturnOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnOrder" ADD CONSTRAINT "ReturnOrder_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnOrder" ADD CONSTRAINT "ReturnOrder_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnOrder" ADD CONSTRAINT "ReturnOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnOrderLine" ADD CONSTRAINT "ReturnOrderLine_returnOrderId_fkey" FOREIGN KEY ("returnOrderId") REFERENCES "ReturnOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnOrderLine" ADD CONSTRAINT "ReturnOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnOrderLine" ADD CONSTRAINT "ReturnOrderLine_goodsReceiptLineId_fkey" FOREIGN KEY ("goodsReceiptLineId") REFERENCES "GoodsReceiptLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnOrderLine" ADD CONSTRAINT "ReturnOrderLine_purchaseOrderLineId_fkey" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
