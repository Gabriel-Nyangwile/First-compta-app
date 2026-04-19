ALTER TABLE "JournalEntry"
ADD COLUMN "preparedByUserId" TEXT,
ADD COLUMN "preparedAt" TIMESTAMP(3),
ADD COLUMN "validatedByUserId" TEXT,
ADD COLUMN "validatedAt" TIMESTAMP(3);

CREATE INDEX "JournalEntry_preparedByUserId_idx" ON "JournalEntry"("preparedByUserId");
CREATE INDEX "JournalEntry_validatedByUserId_idx" ON "JournalEntry"("validatedByUserId");

ALTER TABLE "JournalEntry"
ADD CONSTRAINT "JournalEntry_preparedByUserId_fkey"
FOREIGN KEY ("preparedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JournalEntry"
ADD CONSTRAINT "JournalEntry_validatedByUserId_fkey"
FOREIGN KEY ("validatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
