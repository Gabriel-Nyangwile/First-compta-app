-- AlterTable
ALTER TABLE "MoneyMovement" ADD COLUMN     "supplierId" TEXT;

-- CreateIndex
CREATE INDEX "MoneyMovement_supplierId_idx" ON "MoneyMovement"("supplierId");

-- AddForeignKey
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
