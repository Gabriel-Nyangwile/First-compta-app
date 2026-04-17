-- CreateEnum
CREATE TYPE "CompanyCreationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'PLATFORM_ADMIN';

-- CreateTable
CREATE TABLE "CompanyCreationRequest" (
    "id" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "createdCompanyId" TEXT,
    "status" "CompanyCreationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedName" TEXT NOT NULL,
    "address" TEXT,
    "legalForm" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "rccmNumber" TEXT,
    "idNatNumber" TEXT,
    "taxNumber" TEXT,
    "cnssNumber" TEXT,
    "onemNumber" TEXT,
    "inppNumber" TEXT,
    "vatPolicy" TEXT,
    "country" TEXT,
    "timezone" TEXT,
    "fiscalYearStart" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "CompanyCreationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyCreationRequest_requesterUserId_status_idx" ON "CompanyCreationRequest"("requesterUserId", "status");

-- CreateIndex
CREATE INDEX "CompanyCreationRequest_status_createdAt_idx" ON "CompanyCreationRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CompanyCreationRequest_createdCompanyId_idx" ON "CompanyCreationRequest"("createdCompanyId");

-- AddForeignKey
ALTER TABLE "CompanyCreationRequest" ADD CONSTRAINT "CompanyCreationRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyCreationRequest" ADD CONSTRAINT "CompanyCreationRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyCreationRequest" ADD CONSTRAINT "CompanyCreationRequest_createdCompanyId_fkey" FOREIGN KEY ("createdCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
