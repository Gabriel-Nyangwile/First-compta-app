-- CreateEnum
CREATE TYPE "UserAccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "CompanyCreationRequest" ADD COLUMN     "resultDeliveredAt" TIMESTAMP(3),
ADD COLUMN     "visibleAfterAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserAccessRequest" (
    "id" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "UserAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedRole" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "reviewedByUserId" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "visibleAfterAt" TIMESTAMP(3),
    "resultDeliveredAt" TIMESTAMP(3),

    CONSTRAINT "UserAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAccessRequest_companyId_status_createdAt_idx" ON "UserAccessRequest"("companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "UserAccessRequest_requesterUserId_status_idx" ON "UserAccessRequest"("requesterUserId", "status");

-- CreateIndex
CREATE INDEX "UserAccessRequest_visibleAfterAt_idx" ON "UserAccessRequest"("visibleAfterAt");

-- CreateIndex
CREATE INDEX "CompanyCreationRequest_visibleAfterAt_idx" ON "CompanyCreationRequest"("visibleAfterAt");

-- AddForeignKey
ALTER TABLE "UserAccessRequest" ADD CONSTRAINT "UserAccessRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessRequest" ADD CONSTRAINT "UserAccessRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessRequest" ADD CONSTRAINT "UserAccessRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
