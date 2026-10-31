-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "patientId" TEXT NOT NULL,
    "dentistId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diagnosisCode" TEXT,
    "diagnosisText" TEXT,
    "weightKg" DOUBLE PRECISION,
    "notes" TEXT,
    "vademecum" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionItem" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "drugId" TEXT,
    "name" TEXT NOT NULL,
    "concentration" TEXT NOT NULL,
    "form" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "dose" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "quantityText" TEXT NOT NULL,
    "instructions" TEXT,
    "alerts" JSONB,
    "override" TEXT,

    CONSTRAINT "PrescriptionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvimaCache" (
    "atc" TEXT NOT NULL,
    "rows" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvimaCache_pkey" PRIMARY KEY ("atc")
);

-- CreateIndex
CREATE INDEX "Prescription_patientId_issuedAt_idx" ON "Prescription"("patientId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Prescription_clinicId_number_key" ON "Prescription"("clinicId", "number");

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_dentistId_fkey" FOREIGN KEY ("dentistId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionItem" ADD CONSTRAINT "PrescriptionItem_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

