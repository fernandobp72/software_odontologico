-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "confirmToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_confirmToken_key" ON "Appointment"("confirmToken");

