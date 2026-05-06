-- CreateEnum
CREATE TYPE "BillOfMaterialStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ManufacturingOrderStatus" AS ENUM ('DRAFT', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ManufacturingComponentStatus" AS ENUM ('PLANNED', 'CONSUMED', 'ADJUSTED');

-- AlterEnum
ALTER TYPE "JournalSourceType" ADD VALUE 'MANUFACTURING_ORDER';

-- AlterEnum
ALTER TYPE "TransactionKind" ADD VALUE 'PRODUCTION_WIP';

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "manufacturingOrderComponentId" TEXT,
ADD COLUMN     "manufacturingOutputId" TEXT;

-- CreateTable
CREATE TABLE "BillOfMaterial" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "BillOfMaterialStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillOfMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillOfMaterialLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "billOfMaterialId" TEXT NOT NULL,
    "componentProductId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "lossRate" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillOfMaterialLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManufacturingOrder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "ManufacturingOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "billOfMaterialId" TEXT,
    "productId" TEXT NOT NULL,
    "plannedQty" DECIMAL(14,3) NOT NULL,
    "producedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "scrapQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "storageLocationId" TEXT,
    "wipAccountId" TEXT NOT NULL,
    "plannedDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManufacturingOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManufacturingOrderComponent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "manufacturingOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "plannedQty" DECIMAL(14,3) NOT NULL,
    "consumedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "varianceQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "status" "ManufacturingComponentStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManufacturingOrderComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManufacturingOutput" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "manufacturingOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitCost" DECIMAL(14,4) NOT NULL,
    "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManufacturingOutput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillOfMaterial_productId_idx" ON "BillOfMaterial"("productId");

-- CreateIndex
CREATE INDEX "BillOfMaterial_status_idx" ON "BillOfMaterial"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BillOfMaterial_companyId_code_key" ON "BillOfMaterial"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "BillOfMaterial_companyId_productId_version_key" ON "BillOfMaterial"("companyId", "productId", "version");

-- CreateIndex
CREATE INDEX "BillOfMaterialLine_billOfMaterialId_idx" ON "BillOfMaterialLine"("billOfMaterialId");

-- CreateIndex
CREATE INDEX "BillOfMaterialLine_componentProductId_idx" ON "BillOfMaterialLine"("componentProductId");

-- CreateIndex
CREATE INDEX "ManufacturingOrder_status_idx" ON "ManufacturingOrder"("status");

-- CreateIndex
CREATE INDEX "ManufacturingOrder_billOfMaterialId_idx" ON "ManufacturingOrder"("billOfMaterialId");

-- CreateIndex
CREATE INDEX "ManufacturingOrder_productId_idx" ON "ManufacturingOrder"("productId");

-- CreateIndex
CREATE INDEX "ManufacturingOrder_wipAccountId_idx" ON "ManufacturingOrder"("wipAccountId");

-- CreateIndex
CREATE INDEX "ManufacturingOrder_createdById_idx" ON "ManufacturingOrder"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "ManufacturingOrder_companyId_number_key" ON "ManufacturingOrder"("companyId", "number");

-- CreateIndex
CREATE INDEX "ManufacturingOrderComponent_manufacturingOrderId_idx" ON "ManufacturingOrderComponent"("manufacturingOrderId");

-- CreateIndex
CREATE INDEX "ManufacturingOrderComponent_productId_idx" ON "ManufacturingOrderComponent"("productId");

-- CreateIndex
CREATE INDEX "ManufacturingOrderComponent_status_idx" ON "ManufacturingOrderComponent"("status");

-- CreateIndex
CREATE INDEX "ManufacturingOutput_manufacturingOrderId_idx" ON "ManufacturingOutput"("manufacturingOrderId");

-- CreateIndex
CREATE INDEX "ManufacturingOutput_productId_idx" ON "ManufacturingOutput"("productId");

-- CreateIndex
CREATE INDEX "ManufacturingOutput_declaredAt_idx" ON "ManufacturingOutput"("declaredAt");

-- CreateIndex
CREATE INDEX "StockMovement_manufacturingOrderComponentId_idx" ON "StockMovement"("manufacturingOrderComponentId");

-- CreateIndex
CREATE INDEX "StockMovement_manufacturingOutputId_idx" ON "StockMovement"("manufacturingOutputId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_manufacturingOrderComponentId_fkey" FOREIGN KEY ("manufacturingOrderComponentId") REFERENCES "ManufacturingOrderComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_manufacturingOutputId_fkey" FOREIGN KEY ("manufacturingOutputId") REFERENCES "ManufacturingOutput"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillOfMaterial" ADD CONSTRAINT "BillOfMaterial_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillOfMaterial" ADD CONSTRAINT "BillOfMaterial_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillOfMaterialLine" ADD CONSTRAINT "BillOfMaterialLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillOfMaterialLine" ADD CONSTRAINT "BillOfMaterialLine_billOfMaterialId_fkey" FOREIGN KEY ("billOfMaterialId") REFERENCES "BillOfMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillOfMaterialLine" ADD CONSTRAINT "BillOfMaterialLine_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingOrder" ADD CONSTRAINT "ManufacturingOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingOrder" ADD CONSTRAINT "ManufacturingOrder_billOfMaterialId_fkey" FOREIGN KEY ("billOfMaterialId") REFERENCES "BillOfMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingOrder" ADD CONSTRAINT "ManufacturingOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingOrder" ADD CONSTRAINT "ManufacturingOrder_wipAccountId_fkey" FOREIGN KEY ("wipAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingOrder" ADD CONSTRAINT "ManufacturingOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingOrderComponent" ADD CONSTRAINT "ManufacturingOrderComponent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingOrderComponent" ADD CONSTRAINT "ManufacturingOrderComponent_manufacturingOrderId_fkey" FOREIGN KEY ("manufacturingOrderId") REFERENCES "ManufacturingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingOrderComponent" ADD CONSTRAINT "ManufacturingOrderComponent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingOutput" ADD CONSTRAINT "ManufacturingOutput_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingOutput" ADD CONSTRAINT "ManufacturingOutput_manufacturingOrderId_fkey" FOREIGN KEY ("manufacturingOrderId") REFERENCES "ManufacturingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingOutput" ADD CONSTRAINT "ManufacturingOutput_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
