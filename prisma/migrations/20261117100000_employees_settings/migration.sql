-- Finanzas, fases 4 y 5: empleados, novedades y pagos del periodo, y cifras configurables (salario mínimo, retenciones sugeridas).
-- CreateTable
CREATE TABLE "FinanceSettings" (
    "clinicId" TEXT NOT NULL,
    "minWage" INTEGER NOT NULL DEFAULT 1750905,
    "transportAid" INTEGER NOT NULL DEFAULT 249095,
    "retHonorarios" DOUBLE PRECISION NOT NULL DEFAULT 11,
    "retServicios" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "retCompras" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "applyRetention" BOOLEAN NOT NULL DEFAULT false,
    "accountantName" TEXT,
    "accountantEmail" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceSettings_pkey" PRIMARY KEY ("clinicId")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "branchId" TEXT,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "position" TEXT NOT NULL,
    "contractType" TEXT NOT NULL,
    "salary" INTEGER NOT NULL,
    "payEvery" TEXT NOT NULL DEFAULT 'QUINCENAL',
    "startDate" DATE NOT NULL,
    "eps" TEXT,
    "pension" TEXT,
    "cesantias" TEXT,
    "arl" TEXT,
    "bank" TEXT,
    "phone" TEXT,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "endDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollNovelty" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "payLineId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,

    CONSTRAINT "PayrollNovelty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayRun" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,

    CONSTRAINT "PayRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayRunLine" (
    "id" TEXT NOT NULL,
    "payRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "base" INTEGER NOT NULL,
    "transport" INTEGER NOT NULL DEFAULT 0,
    "additions" INTEGER NOT NULL DEFAULT 0,
    "deductions" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "expenseId" TEXT,
    "detail" JSONB,

    CONSTRAINT "PayRunLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Employee_clinicId_active_idx" ON "Employee"("clinicId", "active");

-- CreateIndex
CREATE INDEX "PayrollNovelty_employeeId_payLineId_idx" ON "PayrollNovelty"("employeeId", "payLineId");

-- CreateIndex
CREATE INDEX "PayRun_clinicId_periodKey_idx" ON "PayRun"("clinicId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "PayRun_clinicId_number_key" ON "PayRun"("clinicId", "number");

-- CreateIndex
CREATE INDEX "PayRunLine_payRunId_idx" ON "PayRunLine"("payRunId");

-- CreateIndex
CREATE INDEX "PayRunLine_employeeId_idx" ON "PayRunLine"("employeeId");

-- AddForeignKey
ALTER TABLE "PayrollNovelty" ADD CONSTRAINT "PayrollNovelty_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRunLine" ADD CONSTRAINT "PayRunLine_payRunId_fkey" FOREIGN KEY ("payRunId") REFERENCES "PayRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRunLine" ADD CONSTRAINT "PayRunLine_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AlterTable: costo de compra por unidad en los lotes de inventario.
ALTER TABLE "SupplyLot" ADD COLUMN "unitCost" INTEGER;
