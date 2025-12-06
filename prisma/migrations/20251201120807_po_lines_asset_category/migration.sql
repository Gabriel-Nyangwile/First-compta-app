-- AlterTable
ALTER TABLE "PurchaseOrderLine" ADD COLUMN     "assetCategoryId" TEXT;

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_assetCategoryId_idx" ON "PurchaseOrderLine"("assetCategoryId");

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_assetCategoryId_fkey" FOREIGN KEY ("assetCategoryId") REFERENCES "AssetCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
