-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "dentistId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "procedureNote" TEXT,
    "signerName" TEXT NOT NULL,
    "signerDocument" TEXT,
    "signerRelation" TEXT NOT NULL,
    "witnessName" TEXT,
    "signature" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OdontogramSnapshot" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OdontogramSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Consent_patientId_signedAt_idx" ON "Consent"("patientId", "signedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OdontogramSnapshot_patientId_kind_key" ON "OdontogramSnapshot"("patientId", "kind");

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_dentistId_fkey" FOREIGN KEY ("dentistId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OdontogramSnapshot" ADD CONSTRAINT "OdontogramSnapshot_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OdontogramSnapshot" ADD CONSTRAINT "OdontogramSnapshot_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
