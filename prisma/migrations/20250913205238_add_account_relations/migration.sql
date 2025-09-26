/*
  Warnings:

  - You are about to drop the column `accountNumber` on the `Client` table. All the data in the column will be lost.
  - You are about to drop the column `accountNumber` on the `Supplier` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Client" DROP COLUMN "accountNumber",
ADD COLUMN     "accountId" TEXT;

-- AlterTable
ALTER TABLE "public"."Supplier" DROP COLUMN "accountNumber",
ADD COLUMN     "accountId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."Client" ADD CONSTRAINT "Client_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Supplier" ADD CONSTRAINT "Supplier_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
