-- CreateTable
CREATE TABLE "ClinicProcedure" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "procId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cups" TEXT,
    "group" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "price" INTEGER NOT NULL DEFAULT 0,
    "materials" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicProcedure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClinicProcedure_clinicId_procId_key" ON "ClinicProcedure"("clinicId", "procId");

-- AddForeignKey
ALTER TABLE "ClinicProcedure" ADD CONSTRAINT "ClinicProcedure_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

