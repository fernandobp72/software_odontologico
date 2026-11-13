-- Autoría en la historia clínica: los diagnósticos ya no se editan ni se borran (se reemplazan o se anulan con motivo)
-- y cada hallazgo del odontograma guarda quién lo marcó.
ALTER TYPE "DiagnosisStatus" ADD VALUE 'REPLACED';
ALTER TYPE "DiagnosisStatus" ADD VALUE 'VOIDED';

ALTER TABLE "Diagnosis" ADD COLUMN "closedById" TEXT;
ALTER TABLE "Diagnosis" ADD COLUMN "closeReason" TEXT;
ALTER TABLE "Diagnosis" ADD COLUMN "replacesId" TEXT;
ALTER TABLE "Diagnosis" ADD CONSTRAINT "Diagnosis_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Diagnosis" ADD CONSTRAINT "Diagnosis_replacesId_fkey" FOREIGN KEY ("replacesId") REFERENCES "Diagnosis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ToothFinding" ADD COLUMN "authorId" TEXT;
ALTER TABLE "ToothFinding" ADD CONSTRAINT "ToothFinding_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
