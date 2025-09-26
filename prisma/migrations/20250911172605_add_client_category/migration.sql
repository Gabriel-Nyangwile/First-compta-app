-- CreateEnum
CREATE TYPE "public"."ClientCategory" AS ENUM ('CASH', 'DAYS_15', 'DAYS_30', 'DAYS_45');

-- AlterTable
ALTER TABLE "public"."Client" ADD COLUMN     "category" "public"."ClientCategory" NOT NULL DEFAULT 'DAYS_30';
