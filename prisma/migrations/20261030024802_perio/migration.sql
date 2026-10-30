-- CreateTable
CREATE TABLE "PerioExam" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerioExam_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PerioExam_patientId_createdAt_idx" ON "PerioExam"("patientId", "createdAt");

-- AddForeignKey
ALTER TABLE "PerioExam" ADD CONSTRAINT "PerioExam_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerioExam" ADD CONSTRAINT "PerioExam_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
