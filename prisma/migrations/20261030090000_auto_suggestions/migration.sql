-- AlterTable
ALTER TABLE "Diagnosis" ADD COLUMN     "note" TEXT,
ADD COLUMN     "sourceKey" TEXT;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "autoPlanAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TreatmentItem" ADD COLUMN     "sourceKey" TEXT;

-- CreateTable
CREATE TABLE "DismissedSuggestion" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DismissedSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DismissedSuggestion_patientId_key_key" ON "DismissedSuggestion"("patientId", "key");

-- AddForeignKey
ALTER TABLE "DismissedSuggestion" ADD CONSTRAINT "DismissedSuggestion_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

