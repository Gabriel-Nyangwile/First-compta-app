-- CreateEnum
CREATE TYPE "PayrollVariableKind" AS ENUM ('BONUS', 'ALLOWANCE', 'DEDUCTION');

-- CreateTable
CREATE TABLE "EmployeeAttendance" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "daysWorked" DECIMAL(8,3) NOT NULL,
    "workingDays" DECIMAL(8,3),
    "overtimeHours" DECIMAL(8,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollVariable" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kind" "PayrollVariableKind" NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "costCenterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollVariable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeAttendance_periodId_idx" ON "EmployeeAttendance"("periodId");

-- CreateIndex
CREATE INDEX "EmployeeAttendance_employeeId_idx" ON "EmployeeAttendance"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeAttendance_periodId_employeeId_key" ON "EmployeeAttendance"("periodId", "employeeId");

-- CreateIndex
CREATE INDEX "PayrollVariable_periodId_idx" ON "PayrollVariable"("periodId");

-- CreateIndex
CREATE INDEX "PayrollVariable_employeeId_idx" ON "PayrollVariable"("employeeId");

-- CreateIndex
CREATE INDEX "PayrollVariable_costCenterId_idx" ON "PayrollVariable"("costCenterId");

-- AddForeignKey
ALTER TABLE "EmployeeAttendance" ADD CONSTRAINT "EmployeeAttendance_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAttendance" ADD CONSTRAINT "EmployeeAttendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollVariable" ADD CONSTRAINT "PayrollVariable_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollVariable" ADD CONSTRAINT "PayrollVariable_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollVariable" ADD CONSTRAINT "PayrollVariable_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
