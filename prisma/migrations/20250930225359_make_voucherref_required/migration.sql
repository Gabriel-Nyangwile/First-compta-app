/*
  Warnings:

  - Made the column `voucherRef` on table `MoneyMovement` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."MoneyMovement" ALTER COLUMN "voucherRef" SET NOT NULL;
