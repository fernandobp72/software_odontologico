-- CreateTable
CREATE TABLE "IntakeForm" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "data" JSONB,
    "signerName" TEXT,
    "signature" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeForm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntakeForm_tokenHash_key" ON "IntakeForm"("tokenHash");

-- CreateIndex
CREATE INDEX "IntakeForm_patientId_createdAt_idx" ON "IntakeForm"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "IntakeForm_clinicId_submittedAt_idx" ON "IntakeForm"("clinicId", "submittedAt");

-- AddForeignKey
ALTER TABLE "IntakeForm" ADD CONSTRAINT "IntakeForm_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

