/*
  Warnings:

  - Made the column `companyId` on table `AuditLog` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_companyId_fkey";

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "companyId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
