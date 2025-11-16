-- AlterEnum
ALTER TYPE "JournalSourceType" ADD VALUE 'PAYROLL';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionKind" ADD VALUE 'SALARY_EXPENSE';
ALTER TYPE "TransactionKind" ADD VALUE 'EMPLOYER_SOCIAL_EXPENSE';
ALTER TYPE "TransactionKind" ADD VALUE 'EMPLOYEE_SOCIAL_WITHHOLDING';
ALTER TYPE "TransactionKind" ADD VALUE 'EMPLOYER_SOCIAL_WITHHOLDING';
ALTER TYPE "TransactionKind" ADD VALUE 'INCOME_TAX_WITHHOLDING';
ALTER TYPE "TransactionKind" ADD VALUE 'OTHER_PAYROLL_LIABILITY';
ALTER TYPE "TransactionKind" ADD VALUE 'WAGES_PAYABLE';
ALTER TYPE "TransactionKind" ADD VALUE 'BENEFIT_IN_KIND_EXPENSE';
