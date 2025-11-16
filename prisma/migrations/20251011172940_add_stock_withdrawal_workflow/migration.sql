/*
  Warnings:

  - You are about to drop the column `createdById` on the `StockWithdrawal` table. All the data in the column will be lost.
  - You are about to drop the column `confirmedQty` on the `StockWithdrawalLine` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `StockWithdrawalLine` table. All the data in the column will be lost.
  - You are about to drop the column `postedQty` on the `StockWithdrawalLine` table. All the data in the column will be lost.
  - You are about to drop the column `requestedQty` on the `StockWithdrawalLine` table. All the data in the column will be lost.
  - You are about to drop the column `totalCostSnapshot` on the `StockWithdrawalLine` table. All the data in the column will be lost.
  - You are about to drop the column `unitCostSnapshot` on the `StockWithdrawalLine` table. All the data in the column will be lost.
  - Added the required column `quantity` to the `StockWithdrawalLine` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."StockWithdrawal" DROP CONSTRAINT "StockWithdrawal_createdById_fkey";

-- DropIndex
DROP INDEX "public"."StockWithdrawal_createdById_idx";

-- AlterTable
ALTER TABLE "StockWithdrawal" DROP COLUMN "createdById",
ADD COLUMN     "requestedById" TEXT,
ALTER COLUMN "type" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "StockWithdrawalLine" DROP COLUMN "confirmedQty",
DROP COLUMN "description",
DROP COLUMN "postedQty",
DROP COLUMN "requestedQty",
DROP COLUMN "totalCostSnapshot",
DROP COLUMN "unitCostSnapshot",
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "quantity" DECIMAL(14,3) NOT NULL,
ADD COLUMN     "totalCost" DECIMAL(16,2),
ADD COLUMN     "unitCost" DECIMAL(14,4),
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "StockWithdrawal_requestedById_idx" ON "StockWithdrawal"("requestedById");

-- AddForeignKey
ALTER TABLE "StockWithdrawal" ADD CONSTRAINT "StockWithdrawal_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
