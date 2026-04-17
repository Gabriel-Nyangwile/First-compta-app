/*
  Warnings:

  - Made the column `companyId` on table `AssetPurchaseOrder` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `AssetPurchaseOrderLine` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `BankAdvice` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `Bareme` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `CapitalCall` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `CapitalOperation` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `CapitalPayment` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `CapitalSubscription` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `DepreciationPeriodLock` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `Employee` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `EmployeeCostAllocation` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `EmployeeHistory` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `FxRate` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `Lettering` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `Payment` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `PaymentInvoiceLink` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `PayrollAccountMapping` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `Position` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `ProductInventory` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `PurchaseOrderStatusLog` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `SalesOrder` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `SalesOrderLine` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `Sequence` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `Shareholder` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `StockMovement` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `StorageLocation` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `TreasuryAuthorization` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "AssetPurchaseOrder" DROP CONSTRAINT "AssetPurchaseOrder_companyId_fkey";

-- DropForeignKey
ALTER TABLE "AssetPurchaseOrderLine" DROP CONSTRAINT "AssetPurchaseOrderLine_companyId_fkey";

-- DropForeignKey
ALTER TABLE "BankAdvice" DROP CONSTRAINT "BankAdvice_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Bareme" DROP CONSTRAINT "Bareme_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CapitalCall" DROP CONSTRAINT "CapitalCall_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CapitalOperation" DROP CONSTRAINT "CapitalOperation_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CapitalPayment" DROP CONSTRAINT "CapitalPayment_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CapitalSubscription" DROP CONSTRAINT "CapitalSubscription_companyId_fkey";

-- DropForeignKey
ALTER TABLE "DepreciationPeriodLock" DROP CONSTRAINT "DepreciationPeriodLock_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_companyId_fkey";

-- DropForeignKey
ALTER TABLE "EmployeeCostAllocation" DROP CONSTRAINT "EmployeeCostAllocation_companyId_fkey";

-- DropForeignKey
ALTER TABLE "EmployeeHistory" DROP CONSTRAINT "EmployeeHistory_companyId_fkey";

-- DropForeignKey
ALTER TABLE "FxRate" DROP CONSTRAINT "FxRate_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Lettering" DROP CONSTRAINT "Lettering_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_companyId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentInvoiceLink" DROP CONSTRAINT "PaymentInvoiceLink_companyId_fkey";

-- DropForeignKey
ALTER TABLE "PayrollAccountMapping" DROP CONSTRAINT "PayrollAccountMapping_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Position" DROP CONSTRAINT "Position_companyId_fkey";

-- DropForeignKey
ALTER TABLE "ProductInventory" DROP CONSTRAINT "ProductInventory_companyId_fkey";

-- DropForeignKey
ALTER TABLE "PurchaseOrderStatusLog" DROP CONSTRAINT "PurchaseOrderStatusLog_companyId_fkey";

-- DropForeignKey
ALTER TABLE "SalesOrder" DROP CONSTRAINT "SalesOrder_companyId_fkey";

-- DropForeignKey
ALTER TABLE "SalesOrderLine" DROP CONSTRAINT "SalesOrderLine_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Sequence" DROP CONSTRAINT "Sequence_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Shareholder" DROP CONSTRAINT "Shareholder_companyId_fkey";

-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_companyId_fkey";

-- DropForeignKey
ALTER TABLE "StorageLocation" DROP CONSTRAINT "StorageLocation_companyId_fkey";

-- DropForeignKey
ALTER TABLE "TreasuryAuthorization" DROP CONSTRAINT "TreasuryAuthorization_companyId_fkey";

-- AlterTable
ALTER TABLE "AssetPurchaseOrder" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "AssetPurchaseOrderLine" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "BankAdvice" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Bareme" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "CapitalCall" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "CapitalOperation" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "CapitalPayment" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "CapitalSubscription" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "DepreciationPeriodLock" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Employee" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "EmployeeCostAllocation" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "EmployeeHistory" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "FxRate" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Lettering" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PaymentInvoiceLink" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PayrollAccountMapping" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Position" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ProductInventory" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PurchaseOrderStatusLog" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "SalesOrder" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "SalesOrderLine" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Sequence" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Shareholder" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "StockMovement" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "StorageLocation" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "TreasuryAuthorization" ALTER COLUMN "companyId" SET NOT NULL;

-- CreateTable
CREATE TABLE "CompanyMembership" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyMembership_userId_idx" ON "CompanyMembership"("userId");

-- CreateIndex
CREATE INDEX "CompanyMembership_companyId_isDefault_idx" ON "CompanyMembership"("companyId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMembership_companyId_userId_key" ON "CompanyMembership"("companyId", "userId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentInvoiceLink" ADD CONSTRAINT "PaymentInvoiceLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lettering" ADD CONSTRAINT "Lettering_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMembership" ADD CONSTRAINT "CompanyMembership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMembership" ADD CONSTRAINT "CompanyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPurchaseOrder" ADD CONSTRAINT "AssetPurchaseOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPurchaseOrderLine" ADD CONSTRAINT "AssetPurchaseOrderLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageLocation" ADD CONSTRAINT "StorageLocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductInventory" ADD CONSTRAINT "ProductInventory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderStatusLog" ADD CONSTRAINT "PurchaseOrderStatusLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryAuthorization" ADD CONSTRAINT "TreasuryAuthorization_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAdvice" ADD CONSTRAINT "BankAdvice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeHistory" ADD CONSTRAINT "EmployeeHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bareme" ADD CONSTRAINT "Bareme_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCostAllocation" ADD CONSTRAINT "EmployeeCostAllocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAccountMapping" ADD CONSTRAINT "PayrollAccountMapping_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FxRate" ADD CONSTRAINT "FxRate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepreciationPeriodLock" ADD CONSTRAINT "DepreciationPeriodLock_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shareholder" ADD CONSTRAINT "Shareholder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalOperation" ADD CONSTRAINT "CapitalOperation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalSubscription" ADD CONSTRAINT "CapitalSubscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalCall" ADD CONSTRAINT "CapitalCall_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalPayment" ADD CONSTRAINT "CapitalPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
