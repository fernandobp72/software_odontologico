-- AlterTable
ALTER TABLE "Consent" ADD COLUMN "signDevice" TEXT,
ADD COLUMN "signReadSec" INTEGER,
ADD COLUMN "receiptTokenHash" TEXT,
ADD COLUMN "receiptExpiresAt" TIMESTAMP(3),
ADD COLUMN "receiptFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "receiptSentAt" TIMESTAMP(3),
ADD COLUMN "receiptSentTo" TEXT;

ALTER TABLE "ConsentRequest" ADD COLUMN "unlockedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Consent_receiptTokenHash_key" ON "Consent"("receiptTokenHash");
