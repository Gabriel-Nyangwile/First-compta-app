-- AlterTable
ALTER TABLE "CapitalPayment" ADD COLUMN     "accountId" TEXT;

-- CreateIndex
CREATE INDEX "CapitalPayment_accountId_idx" ON "CapitalPayment"("accountId");

-- AddForeignKey
ALTER TABLE "CapitalPayment" ADD CONSTRAINT "CapitalPayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
