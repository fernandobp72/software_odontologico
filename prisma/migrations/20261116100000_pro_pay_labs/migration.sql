-- Finanzas, fases 2 y 3: acuerdos y liquidaciones de profesionales por porcentaje, y órdenes de laboratorio.
-- CreateTable
CREATE TABLE "ProAgreement" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "percent" INTEGER NOT NULL,
    "deductLab" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProSettlement" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "percent" INTEGER NOT NULL,
    "deductLab" BOOLEAN NOT NULL,
    "total" INTEGER NOT NULL,
    "expenseId" TEXT,
    "retention" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,

    CONSTRAINT "ProSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProSettlementLine" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "itemId" TEXT,
    "patientName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3),
    "price" INTEGER NOT NULL DEFAULT 0,
    "collected" INTEGER NOT NULL DEFAULT 0,
    "lab" INTEGER NOT NULL DEFAULT 0,
    "earned" INTEGER NOT NULL DEFAULT 0,
    "amount" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "ProSettlementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabOrder" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "payeeId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "itemId" TEXT,
    "dentistId" TEXT NOT NULL,
    "workType" TEXT NOT NULL,
    "tooth" INTEGER,
    "shade" TEXT,
    "material" TEXT,
    "instructions" TEXT,
    "promisedAt" DATE,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),
    "placedAt" TIMESTAMP(3),
    "redoOfId" TEXT,
    "redoReason" TEXT,
    "redoPayer" TEXT,
    "expenseId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,

    CONSTRAINT "LabOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabOrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "byId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabOrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProAgreement_userId_key" ON "ProAgreement"("userId");

-- CreateIndex
CREATE INDEX "ProAgreement_clinicId_idx" ON "ProAgreement"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "ProSettlement_expenseId_key" ON "ProSettlement"("expenseId");

-- CreateIndex
CREATE INDEX "ProSettlement_clinicId_userId_idx" ON "ProSettlement"("clinicId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProSettlement_clinicId_number_key" ON "ProSettlement"("clinicId", "number");

-- CreateIndex
CREATE INDEX "ProSettlementLine_settlementId_idx" ON "ProSettlementLine"("settlementId");

-- CreateIndex
CREATE INDEX "ProSettlementLine_itemId_idx" ON "ProSettlementLine"("itemId");

-- CreateIndex
CREATE INDEX "LabOrder_clinicId_status_idx" ON "LabOrder"("clinicId", "status");

-- CreateIndex
CREATE INDEX "LabOrder_patientId_idx" ON "LabOrder"("patientId");

-- CreateIndex
CREATE INDEX "LabOrder_itemId_idx" ON "LabOrder"("itemId");

-- CreateIndex
CREATE INDEX "LabOrder_payeeId_expenseId_idx" ON "LabOrder"("payeeId", "expenseId");

-- CreateIndex
CREATE UNIQUE INDEX "LabOrder_clinicId_number_key" ON "LabOrder"("clinicId", "number");

-- CreateIndex
CREATE INDEX "LabOrderEvent_orderId_idx" ON "LabOrderEvent"("orderId");

-- AddForeignKey
ALTER TABLE "ProAgreement" ADD CONSTRAINT "ProAgreement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProSettlement" ADD CONSTRAINT "ProSettlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProSettlementLine" ADD CONSTRAINT "ProSettlementLine_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "ProSettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "Payee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_dentistId_fkey" FOREIGN KEY ("dentistId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrderEvent" ADD CONSTRAINT "LabOrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "LabOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

