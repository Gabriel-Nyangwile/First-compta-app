-- AlterTable
ALTER TABLE "PayrollPeriod" ADD COLUMN     "fiscalCurrency" TEXT NOT NULL DEFAULT 'CDF',
ADD COLUMN     "fxRate" DECIMAL(18,6),
ADD COLUMN     "processingCurrency" TEXT NOT NULL DEFAULT 'XOF';

-- AlterTable
ALTER TABLE "Payslip" ADD COLUMN     "fiscalCurrency" TEXT NOT NULL DEFAULT 'CDF',
ADD COLUMN     "fxRate" DECIMAL(18,6),
ADD COLUMN     "processingCurrency" TEXT NOT NULL DEFAULT 'XOF';

-- Backfill historical payroll records from their company currency.
-- Existing generated payslips keep their amounts unchanged; this only freezes
-- the currency context that was previously implicit.
UPDATE "PayrollPeriod" pp
SET
  "processingCurrency" = COALESCE(NULLIF(UPPER(c."currency"), ''), 'XOF'),
  "fiscalCurrency" = 'CDF',
  "fxRate" = CASE
    WHEN COALESCE(NULLIF(UPPER(c."currency"), ''), 'XOF') = 'CDF' THEN 1
    ELSE pp."fxRate"
  END
FROM "Company" c
WHERE pp."companyId" = c."id";

UPDATE "Payslip" ps
SET
  "processingCurrency" = pp."processingCurrency",
  "fiscalCurrency" = pp."fiscalCurrency",
  "fxRate" = pp."fxRate"
FROM "PayrollPeriod" pp
WHERE ps."periodId" = pp."id";
