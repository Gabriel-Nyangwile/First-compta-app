-- CreateEnum
CREATE TYPE "StockWithdrawalType" AS ENUM ('SALE', 'PRODUCTION', 'SAMPLE', 'OTHER');

-- CreateEnum
CREATE TYPE "StockWithdrawalStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'POSTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "stockWithdrawalLineId" TEXT;

-- CreateTable
CREATE TABLE "StockWithdrawal" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "StockWithdrawalStatus" NOT NULL DEFAULT 'DRAFT',
    "type" "StockWithdrawalType" NOT NULL DEFAULT 'SALE',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "notes" TEXT,
    "manufacturingOrderRef" TEXT,
    "salesOrderRef" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockWithdrawalLine" (
    "id" TEXT NOT NULL,
    "stockWithdrawalId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "description" TEXT,
    "requestedQty" DECIMAL(14,3) NOT NULL,
    "confirmedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "postedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "unitCostSnapshot" DECIMAL(14,4),
    "totalCostSnapshot" DECIMAL(16,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockWithdrawalLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockWithdrawal_number_key" ON "StockWithdrawal"("number");

-- CreateIndex
CREATE INDEX "StockWithdrawal_status_idx" ON "StockWithdrawal"("status");

-- CreateIndex
CREATE INDEX "StockWithdrawal_type_idx" ON "StockWithdrawal"("type");

-- CreateIndex
CREATE INDEX "StockWithdrawal_createdById_idx" ON "StockWithdrawal"("createdById");

-- CreateIndex
CREATE INDEX "StockWithdrawalLine_stockWithdrawalId_idx" ON "StockWithdrawalLine"("stockWithdrawalId");

-- CreateIndex
CREATE INDEX "StockWithdrawalLine_productId_idx" ON "StockWithdrawalLine"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_stockWithdrawalLineId_idx" ON "StockMovement"("stockWithdrawalLineId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_stockWithdrawalLineId_fkey" FOREIGN KEY ("stockWithdrawalLineId") REFERENCES "StockWithdrawalLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockWithdrawal" ADD CONSTRAINT "StockWithdrawal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockWithdrawalLine" ADD CONSTRAINT "StockWithdrawalLine_stockWithdrawalId_fkey" FOREIGN KEY ("stockWithdrawalId") REFERENCES "StockWithdrawal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockWithdrawalLine" ADD CONSTRAINT "StockWithdrawalLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
