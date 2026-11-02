-- AlterTable
ALTER TABLE "Evolution" ADD COLUMN "seal" TEXT;
ALTER TABLE "Consent" ADD COLUMN "seal" TEXT;
ALTER TABLE "Prescription" ADD COLUMN "seal" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Evolution_seal_key" ON "Evolution"("seal");
CREATE UNIQUE INDEX "Consent_seal_key" ON "Consent"("seal");
CREATE UNIQUE INDEX "Prescription_seal_key" ON "Prescription"("seal");
