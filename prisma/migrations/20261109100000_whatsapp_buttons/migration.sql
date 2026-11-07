ALTER TABLE "Clinic" ADD COLUMN "whatsappButtons" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Clinic" ADD COLUMN "whatsappAppSecret" TEXT;
ALTER TABLE "Clinic" ADD COLUMN "whatsappVerifyToken" TEXT;
