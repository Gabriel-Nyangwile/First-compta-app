-- CreateTable
CREATE TABLE "public"."ProductInventory" (
    "productId" TEXT NOT NULL,
    "qtyOnHand" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "avgCost" DECIMAL(14,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductInventory_pkey" PRIMARY KEY ("productId")
);

-- AddForeignKey
ALTER TABLE "public"."ProductInventory" ADD CONSTRAINT "ProductInventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
