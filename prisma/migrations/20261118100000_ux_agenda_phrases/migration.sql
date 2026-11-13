-- Mejoras de uso: quién canceló la cita y por qué, y frases frecuentes propias de cada profesional.
-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledBy" TEXT;

-- CreateTable
CREATE TABLE "NotePhrase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotePhrase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotePhrase_userId_idx" ON "NotePhrase"("userId");

