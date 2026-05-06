-- CreateEnum
CREATE TYPE "FiscalYearClosingStatus" AS ENUM ('CLOSED', 'REOPENED');

-- CreateTable
CREATE TABLE "FiscalYearClosing" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "openingDate" TIMESTAMP(3) NOT NULL,
    "openingJournalEntryId" TEXT,
    "status" "FiscalYearClosingStatus" NOT NULL DEFAULT 'CLOSED',
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reopenedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalYearClosing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FiscalYearClosing_companyId_status_idx" ON "FiscalYearClosing"("companyId", "status");

-- CreateIndex
CREATE INDEX "FiscalYearClosing_openingJournalEntryId_idx" ON "FiscalYearClosing"("openingJournalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalYearClosing_companyId_year_key" ON "FiscalYearClosing"("companyId", "year");

-- AddForeignKey
ALTER TABLE "FiscalYearClosing" ADD CONSTRAINT "FiscalYearClosing_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalYearClosing" ADD CONSTRAINT "FiscalYearClosing_openingJournalEntryId_fkey" FOREIGN KEY ("openingJournalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
