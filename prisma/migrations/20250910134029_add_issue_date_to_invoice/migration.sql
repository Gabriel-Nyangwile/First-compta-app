-- AlterTable
ALTER TABLE "public"."Invoice" ADD COLUMN     "updatedAt" TIMESTAMP(3),
ALTER COLUMN "issueDate" SET DEFAULT CURRENT_TIMESTAMP;
