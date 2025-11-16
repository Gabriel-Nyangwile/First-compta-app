-- CreateEnum
CREATE TYPE "TransactionLetterStatus" AS ENUM ('UNMATCHED', 'PARTIAL', 'MATCHED');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "letterRef" TEXT,
ADD COLUMN     "letterStatus" "TransactionLetterStatus" NOT NULL DEFAULT 'UNMATCHED',
ADD COLUMN     "letteredAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "letteredAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Transaction_letterRef_idx" ON "Transaction"("letterRef");

-- CreateIndex
CREATE INDEX "Transaction_letterStatus_idx" ON "Transaction"("letterStatus");
