-- AlterTable
ALTER TABLE "Consent" ADD COLUMN "signMethod" TEXT,
ADD COLUMN "signIp" TEXT,
ADD COLUMN "signAgent" TEXT,
ADD COLUMN "requestId" TEXT;

-- CreateTable
CREATE TABLE "ConsentRequest" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
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
    "method" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "consentId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Consent_requestId_key" ON "Consent"("requestId");
CREATE UNIQUE INDEX "ConsentRequest_tokenHash_key" ON "ConsentRequest"("tokenHash");
CREATE INDEX "ConsentRequest_patientId_createdAt_idx" ON "ConsentRequest"("patientId", "createdAt");
