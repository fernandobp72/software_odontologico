-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "shareTokenHash" TEXT,
ADD COLUMN "shareExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_shareTokenHash_key" ON "Payment"("shareTokenHash");
