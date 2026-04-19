-- AlterEnum
ALTER TYPE "MoneyMovementKind" ADD VALUE 'MISSION_ADVANCE_REFUND';

-- AlterTable
ALTER TABLE "MoneyMovement" ADD COLUMN     "relatedAdvanceMovementId" TEXT;

-- CreateIndex
CREATE INDEX "MoneyMovement_relatedAdvanceMovementId_idx" ON "MoneyMovement"("relatedAdvanceMovementId");

-- AddForeignKey
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_relatedAdvanceMovementId_fkey" FOREIGN KEY ("relatedAdvanceMovementId") REFERENCES "MoneyMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
