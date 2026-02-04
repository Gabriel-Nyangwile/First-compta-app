/*
  Warnings:

  - A unique constraint covering the columns `[companyId,number]` on the table `Account` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,ref]` on the table `Asset` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,code]` on the table `AssetCategory` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,number]` on the table `AssetPurchaseOrder` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,category]` on the table `Bareme` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,ref]` on the table `CapitalOperation` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,email]` on the table `Client` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,code]` on the table `ContributionScheme` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,code]` on the table `CostCenter` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,year,month]` on the table `DepreciationPeriodLock` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,email]` on the table `Employee` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,employeeNumber]` on the table `Employee` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,date,baseCurrency,quoteCurrency]` on the table `FxRate` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,number]` on the table `GoodsReceipt` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,entryNumber]` on the table `IncomingInvoice` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,number]` on the table `InventoryCount` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,invoiceNumber]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,number]` on the table `JournalEntry` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,code]` on the table `MoneyAccount` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,iban]` on the table `MoneyAccount` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,voucherRef]` on the table `MoneyMovement` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,code]` on the table `PayrollAccountMapping` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,ref]` on the table `PayrollPeriod` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,ref]` on the table `Payslip` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,sku]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,number]` on the table `PurchaseOrder` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,number]` on the table `ReturnOrder` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,number]` on the table `SalesOrder` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,name]` on the table `Sequence` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,voucherRef]` on the table `StockMovement` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,number]` on the table `StockWithdrawal` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,code]` on the table `StorageLocation` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,code]` on the table `TaxRule` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,docNumber]` on the table `TreasuryAuthorization` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Account_number_key";

-- DropIndex
DROP INDEX "Asset_ref_key";

-- DropIndex
DROP INDEX "AssetCategory_code_key";

-- DropIndex
DROP INDEX "AssetPurchaseOrder_number_key";

-- DropIndex
DROP INDEX "CapitalOperation_ref_key";

-- DropIndex
DROP INDEX "Client_email_key";

-- DropIndex
DROP INDEX "ContributionScheme_code_key";

-- DropIndex
DROP INDEX "CostCenter_code_key";

-- DropIndex
DROP INDEX "DepreciationPeriodLock_year_month_key";

-- DropIndex
DROP INDEX "Employee_email_key";

-- DropIndex
DROP INDEX "Employee_employeeNumber_key";

-- DropIndex
DROP INDEX "FxRate_date_baseCurrency_quoteCurrency_key";

-- DropIndex
DROP INDEX "GoodsReceipt_number_key";

-- DropIndex
DROP INDEX "IncomingInvoice_entryNumber_key";

-- DropIndex
DROP INDEX "InventoryCount_number_key";

-- DropIndex
DROP INDEX "Invoice_invoiceNumber_key";

-- DropIndex
DROP INDEX "JournalEntry_number_key";

-- DropIndex
DROP INDEX "MoneyAccount_code_key";

-- DropIndex
DROP INDEX "MoneyAccount_iban_key";

-- DropIndex
DROP INDEX "MoneyMovement_voucherRef_key";

-- DropIndex
DROP INDEX "PayrollAccountMapping_code_key";

-- DropIndex
DROP INDEX "PayrollPeriod_ref_key";

-- DropIndex
DROP INDEX "Payslip_ref_key";

-- DropIndex
DROP INDEX "Product_sku_key";

-- DropIndex
DROP INDEX "PurchaseOrder_number_key";

-- DropIndex
DROP INDEX "ReturnOrder_number_key";

-- DropIndex
DROP INDEX "SalesOrder_number_key";

-- DropIndex
DROP INDEX "Sequence_name_key";

-- DropIndex
DROP INDEX "StockMovement_voucherRef_key";

-- DropIndex
DROP INDEX "StockWithdrawal_number_key";

-- DropIndex
DROP INDEX "StorageLocation_code_key";

-- DropIndex
DROP INDEX "TaxRule_code_key";

-- DropIndex
DROP INDEX "TreasuryAuthorization_docNumber_key";

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "AssetCategory" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "AssetDisposal" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "AssetPurchaseOrder" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "AssetPurchaseOrderLine" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "BankAdvice" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Bareme" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "CapitalCall" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "CapitalOperation" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "CapitalPayment" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "CapitalSubscription" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "ContributionScheme" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "CostCenter" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "DepreciationLine" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "DepreciationPeriodLock" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "EmployeeAttendance" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "EmployeeCostAllocation" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "EmployeeHistory" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "FxRate" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "GoodsReceipt" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "GoodsReceiptLine" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "IncomingInvoice" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "IncomingInvoiceLine" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "InventoryCount" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "InventoryCountLine" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "InvoiceLine" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Lettering" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "MoneyAccount" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "MoneyMovement" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "PaymentInvoiceLink" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "PayrollAccountMapping" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "PayrollPeriod" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "PayrollVariable" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Payslip" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "PayslipCostAllocation" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "PayslipLine" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Position" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "ProductInventory" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseOrderLine" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseOrderStatusLog" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "ReturnOrder" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "ReturnOrderLine" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "SalesOrderLine" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Sequence" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Shareholder" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "StockWithdrawal" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "StockWithdrawalLine" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "StorageLocation" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "TaxRule" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "TreasuryAuthorization" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "isDeveloper" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalForm" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "vatPolicy" TEXT,
    "country" TEXT,
    "timezone" TEXT,
    "fiscalYearStart" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_companyId_number_key" ON "Account"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_companyId_ref_key" ON "Asset"("companyId", "ref");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCategory_companyId_code_key" ON "AssetCategory"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "AssetPurchaseOrder_companyId_number_key" ON "AssetPurchaseOrder"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Bareme_companyId_category_key" ON "Bareme"("companyId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "CapitalOperation_companyId_ref_key" ON "CapitalOperation"("companyId", "ref");

-- CreateIndex
CREATE UNIQUE INDEX "Client_companyId_email_key" ON "Client"("companyId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "ContributionScheme_companyId_code_key" ON "ContributionScheme"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_companyId_code_key" ON "CostCenter"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "DepreciationPeriodLock_companyId_year_month_key" ON "DepreciationPeriodLock"("companyId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_companyId_email_key" ON "Employee"("companyId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_companyId_employeeNumber_key" ON "Employee"("companyId", "employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FxRate_companyId_date_baseCurrency_quoteCurrency_key" ON "FxRate"("companyId", "date", "baseCurrency", "quoteCurrency");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_companyId_number_key" ON "GoodsReceipt"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "IncomingInvoice_companyId_entryNumber_key" ON "IncomingInvoice"("companyId", "entryNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCount_companyId_number_key" ON "InventoryCount"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_companyId_invoiceNumber_key" ON "Invoice"("companyId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_companyId_number_key" ON "JournalEntry"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyAccount_companyId_code_key" ON "MoneyAccount"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyAccount_companyId_iban_key" ON "MoneyAccount"("companyId", "iban");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyMovement_companyId_voucherRef_key" ON "MoneyMovement"("companyId", "voucherRef");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollAccountMapping_companyId_code_key" ON "PayrollAccountMapping"("companyId", "code");

-- CreateIndex
CREATE INDEX "PayrollPeriod_companyId_year_month_idx" ON "PayrollPeriod"("companyId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_companyId_ref_key" ON "PayrollPeriod"("companyId", "ref");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_companyId_ref_key" ON "Payslip"("companyId", "ref");

-- CreateIndex
CREATE UNIQUE INDEX "Product_companyId_sku_key" ON "Product"("companyId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_companyId_number_key" ON "PurchaseOrder"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnOrder_companyId_number_key" ON "ReturnOrder"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_companyId_number_key" ON "SalesOrder"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Sequence_companyId_name_key" ON "Sequence"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_companyId_voucherRef_key" ON "StockMovement"("companyId", "voucherRef");

-- CreateIndex
CREATE UNIQUE INDEX "StockWithdrawal_companyId_number_key" ON "StockWithdrawal"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "StorageLocation_companyId_code_key" ON "StorageLocation"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRule_companyId_code_key" ON "TaxRule"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryAuthorization_companyId_docNumber_key" ON "TreasuryAuthorization"("companyId", "docNumber");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentInvoiceLink" ADD CONSTRAINT "PaymentInvoiceLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lettering" ADD CONSTRAINT "Lettering_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPurchaseOrder" ADD CONSTRAINT "AssetPurchaseOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPurchaseOrderLine" ADD CONSTRAINT "AssetPurchaseOrderLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageLocation" ADD CONSTRAINT "StorageLocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductInventory" ADD CONSTRAINT "ProductInventory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockWithdrawal" ADD CONSTRAINT "StockWithdrawal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockWithdrawalLine" ADD CONSTRAINT "StockWithdrawalLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingInvoice" ADD CONSTRAINT "IncomingInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingInvoiceLine" ADD CONSTRAINT "IncomingInvoiceLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnOrder" ADD CONSTRAINT "ReturnOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnOrderLine" ADD CONSTRAINT "ReturnOrderLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyAccount" ADD CONSTRAINT "MoneyAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderStatusLog" ADD CONSTRAINT "PurchaseOrderStatusLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryAuthorization" ADD CONSTRAINT "TreasuryAuthorization_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAdvice" ADD CONSTRAINT "BankAdvice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeHistory" ADD CONSTRAINT "EmployeeHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bareme" ADD CONSTRAINT "Bareme_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipLine" ADD CONSTRAINT "PayslipLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionScheme" ADD CONSTRAINT "ContributionScheme_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRule" ADD CONSTRAINT "TaxRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCostAllocation" ADD CONSTRAINT "EmployeeCostAllocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipCostAllocation" ADD CONSTRAINT "PayslipCostAllocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAccountMapping" ADD CONSTRAINT "PayrollAccountMapping_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FxRate" ADD CONSTRAINT "FxRate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCategory" ADD CONSTRAINT "AssetCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepreciationLine" ADD CONSTRAINT "DepreciationLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepreciationPeriodLock" ADD CONSTRAINT "DepreciationPeriodLock_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDisposal" ADD CONSTRAINT "AssetDisposal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAttendance" ADD CONSTRAINT "EmployeeAttendance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollVariable" ADD CONSTRAINT "PayrollVariable_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shareholder" ADD CONSTRAINT "Shareholder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalOperation" ADD CONSTRAINT "CapitalOperation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalSubscription" ADD CONSTRAINT "CapitalSubscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalCall" ADD CONSTRAINT "CapitalCall_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalPayment" ADD CONSTRAINT "CapitalPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
