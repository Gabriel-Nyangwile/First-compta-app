-- AlterTable
ALTER TABLE "Position" ADD COLUMN     "baremeId" TEXT;

-- CreateTable
CREATE TABLE "Bareme" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tension" TEXT,
    "legalSalary" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bareme_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_baremeId_fkey" FOREIGN KEY ("baremeId") REFERENCES "Bareme"("id") ON DELETE SET NULL ON UPDATE CASCADE;
