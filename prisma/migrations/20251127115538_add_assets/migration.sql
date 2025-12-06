-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('LINEAR');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISPOSED');

-- CreateEnum
CREATE TYPE "DepreciationLineStatus" AS ENUM ('PLANNED', 'POSTED');

-- AlterEnum
ALTER TYPE "JournalSourceType" ADD VALUE 'ASSET';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionKind" ADD VALUE 'ASSET_ACQUISITION';
ALTER TYPE "TransactionKind" ADD VALUE 'ASSET_CLEARING';
ALTER TYPE "TransactionKind" ADD VALUE 'ASSET_DEPRECIATION_EXPENSE';
ALTER TYPE "TransactionKind" ADD VALUE 'ASSET_DEPRECIATION_RESERVE';
ALTER TYPE "TransactionKind" ADD VALUE 'ASSET_DISPOSAL_GAIN';
ALTER TYPE "TransactionKind" ADD VALUE 'ASSET_DISPOSAL_LOSS';

-- CreateTable
CREATE TABLE "AssetCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "method" "DepreciationMethod" NOT NULL DEFAULT 'LINEAR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "assetAccountId" TEXT,
    "assetAccountNumber" TEXT,
    "depreciationAccountId" TEXT,
    "depreciationAccountNumber" TEXT,
    "expenseAccountId" TEXT,
    "expenseAccountNumber" TEXT,
    "disposalGainAccountId" TEXT,
    "disposalGainAccountNumber" TEXT,
    "disposalLossAccountId" TEXT,
    "disposalLossAccountNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "acquisitionDate" TIMESTAMP(3) NOT NULL,
    "inServiceDate" TIMESTAMP(3),
    "cost" DECIMAL(16,2) NOT NULL,
    "salvage" DECIMAL(16,2),
    "usefulLifeMonths" INTEGER NOT NULL,
    "method" "DepreciationMethod" NOT NULL DEFAULT 'LINEAR',
    "status" "AssetStatus" NOT NULL DEFAULT 'DRAFT',
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepreciationLine" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "cumulative" DECIMAL(16,2) NOT NULL,
    "status" "DepreciationLineStatus" NOT NULL DEFAULT 'PLANNED',
    "journalEntryId" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepreciationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetDisposal" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "proceed" DECIMAL(16,2) NOT NULL,
    "gainLoss" DECIMAL(16,2),
    "journalEntryId" TEXT,
    "reason" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetDisposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetCategory_code_key" ON "AssetCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_ref_key" ON "Asset"("ref");

-- CreateIndex
CREATE INDEX "Asset_categoryId_idx" ON "Asset"("categoryId");

-- CreateIndex
CREATE INDEX "Asset_status_idx" ON "Asset"("status");

-- CreateIndex
CREATE INDEX "DepreciationLine_journalEntryId_idx" ON "DepreciationLine"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "DepreciationLine_assetId_year_month_key" ON "DepreciationLine"("assetId", "year", "month");

-- CreateIndex
CREATE INDEX "AssetDisposal_assetId_idx" ON "AssetDisposal"("assetId");

-- CreateIndex
CREATE INDEX "AssetDisposal_journalEntryId_idx" ON "AssetDisposal"("journalEntryId");

-- AddForeignKey
ALTER TABLE "AssetCategory" ADD CONSTRAINT "AssetCategory_assetAccountId_fkey" FOREIGN KEY ("assetAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCategory" ADD CONSTRAINT "AssetCategory_depreciationAccountId_fkey" FOREIGN KEY ("depreciationAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCategory" ADD CONSTRAINT "AssetCategory_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCategory" ADD CONSTRAINT "AssetCategory_disposalGainAccountId_fkey" FOREIGN KEY ("disposalGainAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCategory" ADD CONSTRAINT "AssetCategory_disposalLossAccountId_fkey" FOREIGN KEY ("disposalLossAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepreciationLine" ADD CONSTRAINT "DepreciationLine_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepreciationLine" ADD CONSTRAINT "DepreciationLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDisposal" ADD CONSTRAINT "AssetDisposal_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDisposal" ADD CONSTRAINT "AssetDisposal_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
