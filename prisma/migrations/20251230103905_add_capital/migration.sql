-- CreateEnum
CREATE TYPE "ShareholderType" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "CapitalOperationType" AS ENUM ('CONSTITUTION', 'AUGMENTATION');

-- CreateEnum
CREATE TYPE "CapitalForm" AS ENUM ('SARL', 'SA');

-- CreateEnum
CREATE TYPE "CapitalStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'REGISTERED');

-- CreateEnum
CREATE TYPE "CapitalCallStatus" AS ENUM ('OPEN', 'PARTIAL', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CapitalPaymentMethod" AS ENUM ('BANK', 'CASH');

-- CreateTable
CREATE TABLE "Shareholder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ShareholderType" NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shareholder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapitalOperation" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "type" "CapitalOperationType" NOT NULL,
    "form" "CapitalForm" NOT NULL,
    "status" "CapitalStatus" NOT NULL DEFAULT 'DRAFT',
    "resolutionDate" TIMESTAMP(3),
    "decisionRef" TEXT,
    "nominalTarget" DECIMAL(16,2) NOT NULL,
    "premiumTarget" DECIMAL(16,2),
    "note" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapitalOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapitalSubscription" (
    "id" TEXT NOT NULL,
    "capitalOperationId" TEXT NOT NULL,
    "shareholderId" TEXT NOT NULL,
    "nominalAmount" DECIMAL(16,2) NOT NULL,
    "premiumAmount" DECIMAL(16,2),
    "sharesCount" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapitalSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapitalCall" (
    "id" TEXT NOT NULL,
    "capitalOperationId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "callNumber" INTEGER NOT NULL,
    "label" TEXT,
    "amountCalled" DECIMAL(16,2) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "CapitalCallStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapitalCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapitalPayment" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "method" "CapitalPaymentMethod" NOT NULL DEFAULT 'BANK',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapitalPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CapitalOperation_ref_key" ON "CapitalOperation"("ref");

-- CreateIndex
CREATE INDEX "CapitalSubscription_capitalOperationId_idx" ON "CapitalSubscription"("capitalOperationId");

-- CreateIndex
CREATE INDEX "CapitalSubscription_shareholderId_idx" ON "CapitalSubscription"("shareholderId");

-- CreateIndex
CREATE INDEX "CapitalCall_subscriptionId_idx" ON "CapitalCall"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "CapitalCall_capitalOperationId_callNumber_key" ON "CapitalCall"("capitalOperationId", "callNumber");

-- CreateIndex
CREATE INDEX "CapitalPayment_callId_idx" ON "CapitalPayment"("callId");

-- AddForeignKey
ALTER TABLE "CapitalSubscription" ADD CONSTRAINT "CapitalSubscription_capitalOperationId_fkey" FOREIGN KEY ("capitalOperationId") REFERENCES "CapitalOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalSubscription" ADD CONSTRAINT "CapitalSubscription_shareholderId_fkey" FOREIGN KEY ("shareholderId") REFERENCES "Shareholder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalCall" ADD CONSTRAINT "CapitalCall_capitalOperationId_fkey" FOREIGN KEY ("capitalOperationId") REFERENCES "CapitalOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalCall" ADD CONSTRAINT "CapitalCall_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "CapitalSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalPayment" ADD CONSTRAINT "CapitalPayment_callId_fkey" FOREIGN KEY ("callId") REFERENCES "CapitalCall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
