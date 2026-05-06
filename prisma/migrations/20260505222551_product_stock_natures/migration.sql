-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProductStockNature" ADD VALUE 'RAW_MATERIALS';
ALTER TYPE "ProductStockNature" ADD VALUE 'CONSUMABLE_SUPPLIES';
ALTER TYPE "ProductStockNature" ADD VALUE 'WORK_IN_PROGRESS';
ALTER TYPE "ProductStockNature" ADD VALUE 'SERVICE_IN_PROGRESS';
ALTER TYPE "ProductStockNature" ADD VALUE 'FINISHED_GOODS';
ALTER TYPE "ProductStockNature" ADD VALUE 'INTERMEDIATE_RESIDUAL_PRODUCTS';
