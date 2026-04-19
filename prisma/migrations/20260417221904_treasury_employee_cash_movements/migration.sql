-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MoneyMovementKind" ADD VALUE 'EMPLOYEE_EXPENSE';
ALTER TYPE "MoneyMovementKind" ADD VALUE 'MISSION_ADVANCE';
ALTER TYPE "MoneyMovementKind" ADD VALUE 'PETTY_CASH_OUT';

-- AlterTable
ALTER TABLE "MoneyMovement" ADD COLUMN     "beneficiaryLabel" TEXT,
ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "supportRef" TEXT;

-- CreateIndex
CREATE INDEX "MoneyMovement_employeeId_idx" ON "MoneyMovement"("employeeId");

-- AddForeignKey
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
