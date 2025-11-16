-- CreateTable
CREATE TABLE "Lettering" (
    "id" TEXT NOT NULL,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "anomaly" BOOLEAN NOT NULL DEFAULT false,
    "invoiceId" TEXT,
    "supplierId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lettering_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lettering_invoiceId_idx" ON "Lettering"("invoiceId");

-- CreateIndex
CREATE INDEX "Lettering_supplierId_idx" ON "Lettering"("supplierId");
