-- CreateTable
CREATE TABLE "SupplyItem" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "perishable" BOOLEAN NOT NULL DEFAULT true,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "warnDays" INTEGER NOT NULL DEFAULT 60,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "catalogKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyLot" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lotCode" TEXT,
    "quantity" INTEGER NOT NULL,
    "initialQty" INTEGER NOT NULL,
    "expiresAt" DATE,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "SupplyLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyMovement" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lotId" TEXT,
    "kind" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "note" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplyItem_clinicId_idx" ON "SupplyItem"("clinicId");
CREATE UNIQUE INDEX "SupplyItem_clinicId_name_key" ON "SupplyItem"("clinicId", "name");
CREATE INDEX "SupplyLot_itemId_branchId_idx" ON "SupplyLot"("itemId", "branchId");
CREATE INDEX "SupplyLot_clinicId_branchId_idx" ON "SupplyLot"("clinicId", "branchId");
CREATE INDEX "SupplyMovement_clinicId_branchId_createdAt_idx" ON "SupplyMovement"("clinicId", "branchId", "createdAt");
CREATE INDEX "SupplyMovement_itemId_idx" ON "SupplyMovement"("itemId");

-- AddForeignKey
ALTER TABLE "SupplyLot" ADD CONSTRAINT "SupplyLot_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "SupplyItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplyMovement" ADD CONSTRAINT "SupplyMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "SupplyItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
