/*
  Warnings:

  - Made the column `companyId` on table `Account` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `Asset` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `AssetCategory` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `AssetDisposal` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `Client` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `ContributionScheme` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `CostCenter` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `DepreciationLine` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `EmployeeAttendance` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `GoodsReceipt` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `GoodsReceiptLine` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `IncomingInvoice` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `IncomingInvoiceLine` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `InventoryCount` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `InventoryCountLine` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `Invoice` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `InvoiceLine` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `JournalEntry` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `MoneyAccount` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `MoneyMovement` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `PayrollPeriod` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `PayrollVariable` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `Payslip` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `PayslipCostAllocation` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `PayslipLine` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `Product` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `PurchaseOrder` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `PurchaseOrderLine` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `ReturnOrder` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `ReturnOrderLine` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `StockWithdrawal` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `StockWithdrawalLine` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `Supplier` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `TaxRule` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `Transaction` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_companyId_fkey";

-- DropForeignKey
ALTER TABLE "AssetCategory" DROP CONSTRAINT "AssetCategory_companyId_fkey";

-- DropForeignKey
ALTER TABLE "AssetDisposal" DROP CONSTRAINT "AssetDisposal_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Client" DROP CONSTRAINT "Client_companyId_fkey";

-- DropForeignKey
ALTER TABLE "ContributionScheme" DROP CONSTRAINT "ContributionScheme_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CostCenter" DROP CONSTRAINT "CostCenter_companyId_fkey";

-- DropForeignKey
ALTER TABLE "DepreciationLine" DROP CONSTRAINT "DepreciationLine_companyId_fkey";

-- DropForeignKey
ALTER TABLE "EmployeeAttendance" DROP CONSTRAINT "EmployeeAttendance_companyId_fkey";

-- DropForeignKey
ALTER TABLE "GoodsReceipt" DROP CONSTRAINT "GoodsReceipt_companyId_fkey";

-- DropForeignKey
ALTER TABLE "GoodsReceiptLine" DROP CONSTRAINT "GoodsReceiptLine_companyId_fkey";

-- DropForeignKey
ALTER TABLE "IncomingInvoice" DROP CONSTRAINT "IncomingInvoice_companyId_fkey";

-- DropForeignKey
ALTER TABLE "IncomingInvoiceLine" DROP CONSTRAINT "IncomingInvoiceLine_companyId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryCount" DROP CONSTRAINT "InventoryCount_companyId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryCountLine" DROP CONSTRAINT "InventoryCountLine_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_companyId_fkey";

-- DropForeignKey
ALTER TABLE "InvoiceLine" DROP CONSTRAINT "InvoiceLine_companyId_fkey";

-- DropForeignKey
ALTER TABLE "JournalEntry" DROP CONSTRAINT "JournalEntry_companyId_fkey";

-- DropForeignKey
ALTER TABLE "MoneyAccount" DROP CONSTRAINT "MoneyAccount_companyId_fkey";

-- DropForeignKey
ALTER TABLE "MoneyMovement" DROP CONSTRAINT "MoneyMovement_companyId_fkey";

-- DropForeignKey
ALTER TABLE "PayrollPeriod" DROP CONSTRAINT "PayrollPeriod_companyId_fkey";

-- DropForeignKey
ALTER TABLE "PayrollVariable" DROP CONSTRAINT "PayrollVariable_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Payslip" DROP CONSTRAINT "Payslip_companyId_fkey";

-- DropForeignKey
ALTER TABLE "PayslipCostAllocation" DROP CONSTRAINT "PayslipCostAllocation_companyId_fkey";

-- DropForeignKey
ALTER TABLE "PayslipLine" DROP CONSTRAINT "PayslipLine_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_companyId_fkey";

-- DropForeignKey
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_companyId_fkey";

-- DropForeignKey
ALTER TABLE "PurchaseOrderLine" DROP CONSTRAINT "PurchaseOrderLine_companyId_fkey";

-- DropForeignKey
ALTER TABLE "ReturnOrder" DROP CONSTRAINT "ReturnOrder_companyId_fkey";

-- DropForeignKey
ALTER TABLE "ReturnOrderLine" DROP CONSTRAINT "ReturnOrderLine_companyId_fkey";

-- DropForeignKey
ALTER TABLE "StockWithdrawal" DROP CONSTRAINT "StockWithdrawal_companyId_fkey";

-- DropForeignKey
ALTER TABLE "StockWithdrawalLine" DROP CONSTRAINT "StockWithdrawalLine_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Supplier" DROP CONSTRAINT "Supplier_companyId_fkey";

-- DropForeignKey
ALTER TABLE "TaxRule" DROP CONSTRAINT "TaxRule_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_companyId_fkey";

-- AlterTable
ALTER TABLE "Account" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Asset" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "AssetCategory" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "AssetDisposal" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Client" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ContributionScheme" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "CostCenter" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "DepreciationLine" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "EmployeeAttendance" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "GoodsReceipt" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "GoodsReceiptLine" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "IncomingInvoice" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "IncomingInvoiceLine" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "InventoryCount" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "InventoryCountLine" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "InvoiceLine" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "MoneyAccount" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "MoneyMovement" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PayrollPeriod" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PayrollVariable" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Payslip" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PayslipCostAllocation" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PayslipLine" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PurchaseOrder" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PurchaseOrderLine" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ReturnOrder" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ReturnOrderLine" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "StockWithdrawal" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "StockWithdrawalLine" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Supplier" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "TaxRule" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "companyId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockWithdrawal" ADD CONSTRAINT "StockWithdrawal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockWithdrawalLine" ADD CONSTRAINT "StockWithdrawalLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingInvoice" ADD CONSTRAINT "IncomingInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingInvoiceLine" ADD CONSTRAINT "IncomingInvoiceLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnOrder" ADD CONSTRAINT "ReturnOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnOrderLine" ADD CONSTRAINT "ReturnOrderLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyAccount" ADD CONSTRAINT "MoneyAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipLine" ADD CONSTRAINT "PayslipLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionScheme" ADD CONSTRAINT "ContributionScheme_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRule" ADD CONSTRAINT "TaxRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipCostAllocation" ADD CONSTRAINT "PayslipCostAllocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCategory" ADD CONSTRAINT "AssetCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepreciationLine" ADD CONSTRAINT "DepreciationLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDisposal" ADD CONSTRAINT "AssetDisposal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAttendance" ADD CONSTRAINT "EmployeeAttendance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollVariable" ADD CONSTRAINT "PayrollVariable_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
