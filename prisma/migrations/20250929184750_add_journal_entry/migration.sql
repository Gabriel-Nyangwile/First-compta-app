/*
  Warnings:

  - A unique constraint covering the columns `[voucherRef]` on the table `MoneyMovement` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."JournalStatus" AS ENUM ('DRAFT', 'POSTED');

-- CreateEnum
CREATE TYPE "public"."JournalSourceType" AS ENUM ('INVOICE', 'INCOMING_INVOICE', 'MONEY_MOVEMENT', 'AUTHORIZATION', 'BANK_ADVICE', 'OTHER');

-- AlterTable
ALTER TABLE "public"."Transaction" ADD COLUMN     "journalEntryId" TEXT;

-- CreateTable
CREATE TABLE "public"."Sequence" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JournalEntry" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" "public"."JournalSourceType" NOT NULL DEFAULT 'OTHER',
    "sourceId" TEXT,
    "description" TEXT,
    "status" "public"."JournalStatus" NOT NULL DEFAULT 'POSTED',
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sequence_name_key" ON "public"."Sequence"("name");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_number_key" ON "public"."JournalEntry"("number");

-- CreateIndex
CREATE INDEX "JournalEntry_sourceType_sourceId_idx" ON "public"."JournalEntry"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "JournalEntry_date_idx" ON "public"."JournalEntry"("date");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyMovement_voucherRef_key" ON "public"."MoneyMovement"("voucherRef");

-- CreateIndex
CREATE INDEX "Transaction_journalEntryId_idx" ON "public"."Transaction"("journalEntryId");

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "public"."JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
