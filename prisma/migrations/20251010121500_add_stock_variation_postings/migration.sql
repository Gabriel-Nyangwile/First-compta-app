-- Add stock nature metadata on products and extend enums for stock variation postings
CREATE TYPE "ProductStockNature" AS ENUM ('PURCHASED', 'PRODUCED');

ALTER TABLE "Product"
  ADD COLUMN "stockNature" "ProductStockNature" NOT NULL DEFAULT 'PURCHASED',
  ADD COLUMN "inventoryAccountId" TEXT,
  ADD COLUMN "stockVariationAccountId" TEXT;

ALTER TYPE "TransactionKind" ADD VALUE 'INVENTORY_ASSET';
ALTER TYPE "TransactionKind" ADD VALUE 'STOCK_VARIATION';
ALTER TYPE "JournalSourceType" ADD VALUE 'GOODS_RECEIPT';

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_inventoryAccountId_fkey" FOREIGN KEY ("inventoryAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Product_stockVariationAccountId_fkey" FOREIGN KEY ("stockVariationAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Product_inventoryAccountId_idx" ON "Product"("inventoryAccountId");
CREATE INDEX "Product_stockVariationAccountId_idx" ON "Product"("stockVariationAccountId");
