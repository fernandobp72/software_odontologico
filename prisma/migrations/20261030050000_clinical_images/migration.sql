-- CreateTable
CREATE TABLE "ClinicalImage" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tooth" INTEGER,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "data" BYTEA NOT NULL,
    "thumb" BYTEA,
    "interpretation" TEXT,
    "interpretedById" TEXT,
    "interpretedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClinicalImage_patientId_takenAt_idx" ON "ClinicalImage"("patientId", "takenAt");

-- AddForeignKey
ALTER TABLE "ClinicalImage" ADD CONSTRAINT "ClinicalImage_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalImage" ADD CONSTRAINT "ClinicalImage_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

