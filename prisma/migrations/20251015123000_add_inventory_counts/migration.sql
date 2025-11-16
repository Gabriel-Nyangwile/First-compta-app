-- CreateEnum
CREATE TYPE "InventoryCountStatus" AS ENUM ('DRAFT', 'COMPLETED', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryCountLineStatus" AS ENUM ('PENDING', 'COUNTED', 'POSTED');

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "inventoryCountLineId" TEXT;

-- CreateTable
CREATE TABLE "InventoryCount" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "InventoryCountStatus" NOT NULL DEFAULT 'DRAFT',
    "countedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCountLine" (
    "id" TEXT NOT NULL,
    "inventoryCountId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "InventoryCountLineStatus" NOT NULL DEFAULT 'PENDING',
    "snapshotQty" DECIMAL(18,3) NOT NULL,
    "snapshotAvgCost" DECIMAL(14,4),
    "countedQty" DECIMAL(18,3),
    "deltaQty" DECIMAL(18,3),
    "deltaValue" DECIMAL(16,2),
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryCountLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryCount_number_key" ON "InventoryCount"("number");

CREATE INDEX "InventoryCount_status_idx" ON "InventoryCount"("status");

CREATE INDEX "InventoryCount_createdById_idx" ON "InventoryCount"("createdById");

CREATE INDEX "InventoryCountLine_inventoryCountId_idx" ON "InventoryCountLine"("inventoryCountId");

CREATE INDEX "InventoryCountLine_productId_idx" ON "InventoryCountLine"("productId");

CREATE INDEX "InventoryCountLine_status_idx" ON "InventoryCountLine"("status");


CREATE UNIQUE INDEX "InventoryCountLine_journalEntryId_key" ON "InventoryCountLine"("journalEntryId");

CREATE INDEX "StockMovement_inventoryCountLineId_idx" ON "StockMovement"("inventoryCountLineId");
CREATE UNIQUE INDEX "StockMovement_inventoryCountLineId_key" ON "StockMovement"("inventoryCountLineId");

ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_inventoryCountId_fkey" FOREIGN KEY ("inventoryCountId") REFERENCES "InventoryCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_inventoryCountLineId_fkey" FOREIGN KEY ("inventoryCountLineId") REFERENCES "InventoryCountLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
