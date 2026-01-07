-- AlterTable
ALTER TABLE "CapitalPayment" ADD COLUMN     "journalEntryId" TEXT;

-- CreateIndex
CREATE INDEX "CapitalPayment_journalEntryId_idx" ON "CapitalPayment"("journalEntryId");

-- AddForeignKey
ALTER TABLE "CapitalPayment" ADD CONSTRAINT "CapitalPayment_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
