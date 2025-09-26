-- AlterTable
ALTER TABLE "public"."Transaction" ADD COLUMN     "incomingInvoiceLineId" TEXT,
ADD COLUMN     "invoiceLineId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_invoiceLineId_fkey" FOREIGN KEY ("invoiceLineId") REFERENCES "public"."InvoiceLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_incomingInvoiceLineId_fkey" FOREIGN KEY ("incomingInvoiceLineId") REFERENCES "public"."IncomingInvoiceLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
