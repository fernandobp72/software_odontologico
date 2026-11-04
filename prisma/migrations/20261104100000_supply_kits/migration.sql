-- AlterTable
ALTER TABLE "SupplyItem" ADD COLUMN "packLabel" TEXT,
ADD COLUMN "packSize" INTEGER;

ALTER TABLE "SupplyMovement" ADD COLUMN "refId" TEXT;

-- CreateTable
CREATE TABLE "SupplyKitLine" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "procId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "SupplyKitLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplyMovement_refId_idx" ON "SupplyMovement"("refId");
CREATE UNIQUE INDEX "SupplyKitLine_clinicId_procId_itemId_key" ON "SupplyKitLine"("clinicId", "procId", "itemId");
CREATE INDEX "SupplyKitLine_clinicId_procId_idx" ON "SupplyKitLine"("clinicId", "procId");

-- AddForeignKey
ALTER TABLE "SupplyKitLine" ADD CONSTRAINT "SupplyKitLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "SupplyItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
