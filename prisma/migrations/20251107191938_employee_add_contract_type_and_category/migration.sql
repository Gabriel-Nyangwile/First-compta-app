-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('CDI', 'CDD', 'CI');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "category" TEXT,
ADD COLUMN     "contractType" "ContractType";
