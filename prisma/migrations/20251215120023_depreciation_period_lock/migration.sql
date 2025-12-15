-- CreateTable
CREATE TABLE "DepreciationPeriodLock" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "DepreciationPeriodLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DepreciationPeriodLock_year_month_key" ON "DepreciationPeriodLock"("year", "month");
