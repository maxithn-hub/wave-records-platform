-- CreateTable
CREATE TABLE "EscrowRoyaltyHold" (
    "id" UUID NOT NULL,
    "splitAgreementId" UUID NOT NULL,
    "trackId" UUID NOT NULL,
    "sourceTenantId" UUID NOT NULL,
    "collaboratorEmail" VARCHAR(255) NOT NULL,
    "heldAmountUsd" DECIMAL(18,10) NOT NULL,
    "statementIdempotencyKey" VARCHAR(128) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'HELD_IN_ESCROW',
    "claimedByTenantId" UUID,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowRoyaltyHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoyaltyStatementIngest" (
    "id" UUID NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "trackId" UUID NOT NULL,
    "releaseId" UUID NOT NULL,
    "ownerTenantId" UUID NOT NULL,
    "dspStore" VARCHAR(40) NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "streamsCount" INTEGER NOT NULL,
    "grossRevenueUsd" DECIMAL(18,10) NOT NULL,
    "waveCommissionUsd" DECIMAL(18,10) NOT NULL,
    "netDistributableUsd" DECIMAL(18,10) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoyaltyStatementIngest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EscrowRoyaltyHold_statementIdempotencyKey_key" ON "EscrowRoyaltyHold"("statementIdempotencyKey");

-- CreateIndex
CREATE INDEX "EscrowRoyaltyHold_collaboratorEmail_status_idx" ON "EscrowRoyaltyHold"("collaboratorEmail", "status");

-- CreateIndex
CREATE INDEX "EscrowRoyaltyHold_sourceTenantId_status_idx" ON "EscrowRoyaltyHold"("sourceTenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RoyaltyStatementIngest_idempotencyKey_key" ON "RoyaltyStatementIngest"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RoyaltyStatementIngest_ownerTenantId_createdAt_idx" ON "RoyaltyStatementIngest"("ownerTenantId", "createdAt");

-- CreateIndex
CREATE INDEX "RoyaltyStatementIngest_trackId_idx" ON "RoyaltyStatementIngest"("trackId");

-- AddForeignKey
ALTER TABLE "EscrowRoyaltyHold" ADD CONSTRAINT "EscrowRoyaltyHold_splitAgreementId_fkey" FOREIGN KEY ("splitAgreementId") REFERENCES "SplitAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
