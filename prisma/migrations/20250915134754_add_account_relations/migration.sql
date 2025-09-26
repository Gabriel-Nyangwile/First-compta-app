-- AlterTable
ALTER TABLE "public"."Invoice" ADD COLUMN     "totalAmountHt" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "vat" DECIMAL(4,2) NOT NULL DEFAULT 0.2;
