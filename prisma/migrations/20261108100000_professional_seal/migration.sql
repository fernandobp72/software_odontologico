ALTER TABLE "User" ADD COLUMN "sealGeneration" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Clinic" ADD COLUMN "requireSello" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "SigningCredential" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "serial" INTEGER NOT NULL,
  "generation" INTEGER NOT NULL DEFAULT 0,
  "kind" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "credentialId" TEXT,
  "publicKey" BYTEA,
  "counter" INTEGER NOT NULL DEFAULT 0,
  "transports" TEXT,
  "deviceType" TEXT,
  "backedUp" BOOLEAN NOT NULL DEFAULT false,
  "pinHash" TEXT,
  "pinFailures" INTEGER NOT NULL DEFAULT 0,
  "pinLockedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedReason" TEXT,
  "revokedById" TEXT,
  "compromisedSince" TIMESTAMP(3),
  CONSTRAINT "SigningCredential_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SigningCredential_credentialId_key" ON "SigningCredential"("credentialId");
CREATE INDEX "SigningCredential_userId_idx" ON "SigningCredential"("userId");
CREATE UNIQUE INDEX "SigningCredential_userId_serial_key" ON "SigningCredential"("userId","serial");
ALTER TABLE "SigningCredential" ADD CONSTRAINT "SigningCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SigningChallenge" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "challenge" TEXT NOT NULL,
  "contentHash" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SigningChallenge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SigningChallenge_userId_idx" ON "SigningChallenge"("userId");

CREATE TABLE "SigningGrant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  CONSTRAINT "SigningGrant_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SigningGrant_userId_idx" ON "SigningGrant"("userId");
ALTER TABLE "SigningGrant" ADD CONSTRAINT "SigningGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ProSignature" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "credentialId" TEXT,
  "docKind" TEXT NOT NULL,
  "docId" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "assertion" JSONB,
  "generation" INTEGER NOT NULL DEFAULT 0,
  "ip" TEXT,
  "agent" TEXT,
  "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProSignature_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProSignature_docKind_docId_key" ON "ProSignature"("docKind","docId");
CREATE INDEX "ProSignature_userId_idx" ON "ProSignature"("userId");
ALTER TABLE "ProSignature" ADD CONSTRAINT "ProSignature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProSignature" ADD CONSTRAINT "ProSignature_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "SigningCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
