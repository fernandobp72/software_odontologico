-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN     "whatsappAuto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappLang" TEXT,
ADD COLUMN     "whatsappPhoneId" TEXT,
ADD COLUMN     "whatsappTemplate" TEXT,
ADD COLUMN     "whatsappToken" TEXT;

