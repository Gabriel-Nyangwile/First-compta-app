/*
  Warnings:

  - You are about to drop the column `transferGroupId` on the `MoneyMovement` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[voucherRef]` on the table `StockMovement` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."MoneyMovement" DROP COLUMN "transferGroupId";

-- AlterTable
ALTER TABLE "public"."StockMovement" ADD COLUMN     "voucherRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_voucherRef_key" ON "public"."StockMovement"("voucherRef");
