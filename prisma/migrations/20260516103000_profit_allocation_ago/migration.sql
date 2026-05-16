CREATE TYPE "ProfitAllocationStatus" AS ENUM ('DRAFT', 'APPROVED', 'CANCELLED');
CREATE TYPE "CorporateTaxMode" AS ENUM ('NONE', 'STANDARD_IS', 'MINIMUM_TURNOVER');

CREATE TABLE "ProfitAllocationDecision" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "ProfitAllocationStatus" NOT NULL DEFAULT 'DRAFT',
    "decisionDate" TIMESTAMP(3),
    "agoReference" TEXT,
    "preTaxResult" DECIMAL(16,2) NOT NULL,
    "turnover" DECIMAL(16,2) NOT NULL,
    "corporateTaxMode" "CorporateTaxMode" NOT NULL DEFAULT 'NONE',
    "corporateTaxRate" DECIMAL(8,6) NOT NULL,
    "minimumTaxRate" DECIMAL(8,6) NOT NULL,
    "corporateTaxAmount" DECIMAL(16,2) NOT NULL,
    "netResult" DECIMAL(16,2) NOT NULL,
    "priorDebitRetainedEarnings" DECIMAL(16,2) NOT NULL,
    "priorCreditRetainedEarnings" DECIMAL(16,2) NOT NULL,
    "capitalAmount" DECIMAL(16,2) NOT NULL,
    "legalReserveCurrent" DECIMAL(16,2) NOT NULL,
    "legalReserveCap" DECIMAL(16,2) NOT NULL,
    "legalReserveRate" DECIMAL(8,6) NOT NULL,
    "legalReserveAmount" DECIMAL(16,2) NOT NULL,
    "statutoryReserveAmount" DECIMAL(16,2) NOT NULL,
    "optionalReserveAmount" DECIMAL(16,2) NOT NULL,
    "distributableProfit" DECIMAL(16,2) NOT NULL,
    "dividendsGrossAmount" DECIMAL(16,2) NOT NULL,
    "irmRate" DECIMAL(8,6) NOT NULL,
    "irmAmount" DECIMAL(16,2) NOT NULL,
    "dividendsNetAmount" DECIMAL(16,2) NOT NULL,
    "retainedEarningsAmount" DECIMAL(16,2) NOT NULL,
    "taxExpenseAccountNumber" TEXT NOT NULL,
    "taxPayableAccountNumber" TEXT NOT NULL,
    "legalReserveAccountNumber" TEXT NOT NULL,
    "statutoryReserveAccountNumber" TEXT,
    "optionalReserveAccountNumber" TEXT NOT NULL,
    "retainedEarningsAccountNumber" TEXT NOT NULL,
    "lossRetainedAccountNumber" TEXT NOT NULL,
    "dividendsPayableAccountNumber" TEXT NOT NULL,
    "irmPayableAccountNumber" TEXT NOT NULL,
    "taxJournalEntryId" TEXT,
    "openingJournalEntryId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfitAllocationDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DividendAllocationLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "shareholderId" TEXT NOT NULL,
    "basisAmount" DECIMAL(16,2) NOT NULL,
    "ownershipPct" DECIMAL(8,6) NOT NULL,
    "grossDividend" DECIMAL(16,2) NOT NULL,
    "irmAmount" DECIMAL(16,2) NOT NULL,
    "netDividend" DECIMAL(16,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DividendAllocationLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProfitAllocationDecision_companyId_year_key" ON "ProfitAllocationDecision"("companyId", "year");
CREATE INDEX "ProfitAllocationDecision_companyId_status_idx" ON "ProfitAllocationDecision"("companyId", "status");
CREATE INDEX "ProfitAllocationDecision_taxJournalEntryId_idx" ON "ProfitAllocationDecision"("taxJournalEntryId");
CREATE INDEX "ProfitAllocationDecision_openingJournalEntryId_idx" ON "ProfitAllocationDecision"("openingJournalEntryId");
CREATE INDEX "DividendAllocationLine_decisionId_idx" ON "DividendAllocationLine"("decisionId");
CREATE INDEX "DividendAllocationLine_shareholderId_idx" ON "DividendAllocationLine"("shareholderId");

ALTER TABLE "ProfitAllocationDecision" ADD CONSTRAINT "ProfitAllocationDecision_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfitAllocationDecision" ADD CONSTRAINT "ProfitAllocationDecision_taxJournalEntryId_fkey" FOREIGN KEY ("taxJournalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProfitAllocationDecision" ADD CONSTRAINT "ProfitAllocationDecision_openingJournalEntryId_fkey" FOREIGN KEY ("openingJournalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DividendAllocationLine" ADD CONSTRAINT "DividendAllocationLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DividendAllocationLine" ADD CONSTRAINT "DividendAllocationLine_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "ProfitAllocationDecision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DividendAllocationLine" ADD CONSTRAINT "DividendAllocationLine_shareholderId_fkey" FOREIGN KEY ("shareholderId") REFERENCES "Shareholder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
