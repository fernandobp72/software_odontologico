-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBranch" (
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "UserBranch_pkey" PRIMARY KEY ("userId","branchId")
);

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "branchIds" TEXT[];

-- Cada consultorio existente recibe una "Sede principal" con su dirección y teléfono.
INSERT INTO "Branch" ("id", "clinicId", "name", "address", "phone", "active", "createdAt")
SELECT 'br_' || "id", "id", 'Sede principal', "address", "phone", true, CURRENT_TIMESTAMP FROM "Clinic";

-- Las citas y cajas existentes pasan a la sede principal; luego el campo se vuelve obligatorio.
ALTER TABLE "Appointment" ADD COLUMN "branchId" TEXT;
UPDATE "Appointment" SET "branchId" = 'br_' || "clinicId";
ALTER TABLE "Appointment" ALTER COLUMN "branchId" SET NOT NULL;

ALTER TABLE "CashSession" ADD COLUMN "branchId" TEXT;
UPDATE "CashSession" SET "branchId" = 'br_' || "clinicId";
ALTER TABLE "CashSession" ALTER COLUMN "branchId" SET NOT NULL;

-- Todas las personas existentes quedan asignadas a la sede principal de su consultorio.
INSERT INTO "UserBranch" ("userId", "branchId") SELECT "id", 'br_' || "clinicId" FROM "User";

-- CreateIndex
CREATE INDEX "Branch_clinicId_idx" ON "Branch"("clinicId");

-- CreateIndex
CREATE INDEX "Appointment_branchId_startsAt_idx" ON "Appointment"("branchId", "startsAt");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
