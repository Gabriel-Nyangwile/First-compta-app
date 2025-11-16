-- AlterEnum
ALTER TYPE "JournalSourceType" ADD VALUE 'RETURN_ORDER';

-- AlterEnum
ALTER TYPE "TransactionKind" ADD VALUE 'PURCHASE_RETURN';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "returnOrderId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_returnOrderId_idx" ON "Transaction"("returnOrderId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_returnOrderId_fkey" FOREIGN KEY ("returnOrderId") REFERENCES "ReturnOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
