-- AlterEnum
ALTER TYPE "JournalSourceType" ADD VALUE 'MISSION_ADVANCE_REGULARIZATION';

-- CreateTable
CREATE TABLE "MissionAdvanceRegularization" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "advanceMovementId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "expenseAccountId" TEXT NOT NULL,
    "supportRef" TEXT,
    "description" TEXT,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionAdvanceRegularization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MissionAdvanceRegularization_advanceMovementId_idx" ON "MissionAdvanceRegularization"("advanceMovementId");

-- CreateIndex
CREATE INDEX "MissionAdvanceRegularization_employeeId_idx" ON "MissionAdvanceRegularization"("employeeId");

-- CreateIndex
CREATE INDEX "MissionAdvanceRegularization_journalEntryId_idx" ON "MissionAdvanceRegularization"("journalEntryId");

-- AddForeignKey
ALTER TABLE "MissionAdvanceRegularization" ADD CONSTRAINT "MissionAdvanceRegularization_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionAdvanceRegularization" ADD CONSTRAINT "MissionAdvanceRegularization_advanceMovementId_fkey" FOREIGN KEY ("advanceMovementId") REFERENCES "MoneyMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionAdvanceRegularization" ADD CONSTRAINT "MissionAdvanceRegularization_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionAdvanceRegularization" ADD CONSTRAINT "MissionAdvanceRegularization_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionAdvanceRegularization" ADD CONSTRAINT "MissionAdvanceRegularization_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
