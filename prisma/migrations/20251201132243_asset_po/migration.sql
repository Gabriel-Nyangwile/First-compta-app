-- CreateTable
CREATE TABLE "AssetPurchaseOrder" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "supplierId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetPurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetPurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "assetPurchaseOrderId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "assetCategoryId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,4) NOT NULL,
    "vatRate" DECIMAL(4,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetPurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetPurchaseOrder_number_key" ON "AssetPurchaseOrder"("number");

-- CreateIndex
CREATE INDEX "AssetPurchaseOrder_supplierId_idx" ON "AssetPurchaseOrder"("supplierId");

-- CreateIndex
CREATE INDEX "AssetPurchaseOrder_status_idx" ON "AssetPurchaseOrder"("status");

-- CreateIndex
CREATE INDEX "AssetPurchaseOrderLine_assetPurchaseOrderId_idx" ON "AssetPurchaseOrderLine"("assetPurchaseOrderId");

-- CreateIndex
CREATE INDEX "AssetPurchaseOrderLine_assetCategoryId_idx" ON "AssetPurchaseOrderLine"("assetCategoryId");

-- AddForeignKey
ALTER TABLE "AssetPurchaseOrder" ADD CONSTRAINT "AssetPurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPurchaseOrderLine" ADD CONSTRAINT "AssetPurchaseOrderLine_assetPurchaseOrderId_fkey" FOREIGN KEY ("assetPurchaseOrderId") REFERENCES "AssetPurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPurchaseOrderLine" ADD CONSTRAINT "AssetPurchaseOrderLine_assetCategoryId_fkey" FOREIGN KEY ("assetCategoryId") REFERENCES "AssetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
