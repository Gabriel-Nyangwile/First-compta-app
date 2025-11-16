-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "childrenUnder18" INTEGER DEFAULT 0,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "maritalStatus" "MaritalStatus",
ADD COLUMN     "socialSecurityNumber" TEXT;
