-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."MoneyMovementKind" ADD VALUE 'ASSOCIATE_CONTRIBUTION';
ALTER TYPE "public"."MoneyMovementKind" ADD VALUE 'ASSOCIATE_WITHDRAWAL';
ALTER TYPE "public"."MoneyMovementKind" ADD VALUE 'SALARY_PAYMENT';
ALTER TYPE "public"."MoneyMovementKind" ADD VALUE 'SALARY_ADVANCE';

-- AlterTable
ALTER TABLE "public"."IncomingInvoice" ADD COLUMN     "outstandingAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."Invoice" ADD COLUMN     "outstandingAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
