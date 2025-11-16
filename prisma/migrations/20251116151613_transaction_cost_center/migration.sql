-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "costCenterId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_costCenterId_idx" ON "Transaction"("costCenterId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
