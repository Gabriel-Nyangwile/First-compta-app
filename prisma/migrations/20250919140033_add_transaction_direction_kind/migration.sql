/*
  Warnings:

  - Added the required column `direction` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `kind` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."TransactionDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "public"."TransactionKind" AS ENUM ('RECEIVABLE', 'SALE', 'VAT_COLLECTED', 'PAYMENT');

-- AlterTable
ALTER TABLE "public"."Transaction" ADD COLUMN     "direction" "public"."TransactionDirection" NOT NULL,
ADD COLUMN     "kind" "public"."TransactionKind" NOT NULL;
