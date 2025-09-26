-- AlterTable
ALTER TABLE "public"."IncomingInvoiceLine" ADD COLUMN     "vatRate" DECIMAL(4,2);

-- AlterTable
ALTER TABLE "public"."InvoiceLine" ADD COLUMN     "vatRate" DECIMAL(4,2);
