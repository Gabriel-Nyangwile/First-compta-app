/*
  Warnings:

  - You are about to drop the column `contractId` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the `Contract` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('OPEN', 'LOCKED', 'POSTED');

-- CreateEnum
CREATE TYPE "PayslipLineKind" AS ENUM ('BASE', 'PRIME', 'RETENUE', 'COTISATION_SALARIALE', 'COTISATION_PATRONALE', 'IMPOT', 'AJUSTEMENT');

-- CreateEnum
CREATE TYPE "ContributionBaseKind" AS ENUM ('BASE_SALAIRE', 'BRUT', 'IMPOSABLE');

-- CreateEnum
CREATE TYPE "TaxRoundingMode" AS ENUM ('NONE', 'BANKERS', 'UP', 'DOWN');

-- DropForeignKey
ALTER TABLE "public"."Employee" DROP CONSTRAINT "Employee_contractId_fkey";

-- DropIndex
DROP INDEX "public"."Employee_contractId_key";

-- AlterTable
ALTER TABLE "Employee" DROP COLUMN "contractId";

-- DropTable
DROP TABLE "public"."Contract";

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "grossAmount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayslipLine" (
    "id" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "kind" "PayslipLineKind" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "baseAmount" DECIMAL(16,2),
    "order" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB,

    CONSTRAINT "PayslipLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContributionScheme" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "employeeRate" DECIMAL(8,6) NOT NULL,
    "employerRate" DECIMAL(8,6) NOT NULL,
    "ceiling" DECIMAL(16,2),
    "baseKind" "ContributionBaseKind" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContributionScheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "brackets" JSONB NOT NULL,
    "roundingMode" "TaxRoundingMode" NOT NULL DEFAULT 'BANKERS',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCenter" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeCostAllocation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "percent" DECIMAL(8,6) NOT NULL,

    CONSTRAINT "EmployeeCostAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayslipCostAllocation" (
    "id" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "percent" DECIMAL(8,6) NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,

    CONSTRAINT "PayslipCostAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAccountMapping" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "accountId" TEXT,
    "accountNumber" TEXT,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollAccountMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FxRate" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "quoteCurrency" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_ref_key" ON "PayrollPeriod"("ref");

-- CreateIndex
CREATE INDEX "PayrollPeriod_year_month_idx" ON "PayrollPeriod"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_ref_key" ON "Payslip"("ref");

-- CreateIndex
CREATE INDEX "Payslip_employeeId_idx" ON "Payslip"("employeeId");

-- CreateIndex
CREATE INDEX "Payslip_periodId_idx" ON "Payslip"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "ContributionScheme_code_key" ON "ContributionScheme"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRule_code_key" ON "TaxRule"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_code_key" ON "CostCenter"("code");

-- CreateIndex
CREATE INDEX "EmployeeCostAllocation_employeeId_idx" ON "EmployeeCostAllocation"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeCostAllocation_costCenterId_idx" ON "EmployeeCostAllocation"("costCenterId");

-- CreateIndex
CREATE INDEX "PayslipCostAllocation_payslipId_idx" ON "PayslipCostAllocation"("payslipId");

-- CreateIndex
CREATE INDEX "PayslipCostAllocation_costCenterId_idx" ON "PayslipCostAllocation"("costCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollAccountMapping_code_key" ON "PayrollAccountMapping"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FxRate_date_baseCurrency_quoteCurrency_key" ON "FxRate"("date", "baseCurrency", "quoteCurrency");

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipLine" ADD CONSTRAINT "PayslipLine_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "Payslip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCostAllocation" ADD CONSTRAINT "EmployeeCostAllocation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCostAllocation" ADD CONSTRAINT "EmployeeCostAllocation_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipCostAllocation" ADD CONSTRAINT "PayslipCostAllocation_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "Payslip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipCostAllocation" ADD CONSTRAINT "PayslipCostAllocation_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
