-- CreateEnum
CREATE TYPE "TenantTier" AS ENUM ('INDIVIDUAL_LAUNCH', 'LABEL_GROWTH');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ONBOARDING', 'ACTIVE', 'RESTRICTED_COMPLIANCE', 'SUSPENDED_FRAUD');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NOT_STARTED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TaxFormType" AS ENUM ('W9', 'W8BEN', 'W8BENE');

-- CreateEnum
CREATE TYPE "TaxDeclarationStatus" AS ENUM ('MISSING', 'SUBMITTED_UNDER_REVIEW', 'VALIDATED', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReleaseStatus" AS ENUM ('DRAFT', 'UPLOADING_ASSETS', 'FORENSIC_PROCESSING', 'MANUAL_COPYRIGHT_REVIEW', 'MODERATION_QUEUE', 'APPROVED_FOR_DELIVERY', 'DISPATCHING_TO_REVELATOR', 'LIVE_ON_DSPS', 'REJECTED', 'TAKEDOWN_REQUESTED');

-- CreateEnum
CREATE TYPE "SplitStatus" AS ENUM ('PENDING_INVITATION_ESCROW', 'ACCEPTED_ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('DSP_ROYALTY_CREDIT', 'WAVE_COMMISSION_DEDUCTION', 'ESCROW_SPLIT_HOLD', 'ESCROW_SPLIT_RELEASE', 'PAYOUT_WITHDRAWAL_DEBIT');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('TENANT_OWNER', 'TENANT_MEMBER', 'WAVE_COMPLIANCE_ADMIN');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "legalName" VARCHAR(160) NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "tier" "TenantTier" NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ONBOARDING',
    "countryCode" CHAR(2) NOT NULL,
    "commissionRatePercent" DECIMAL(18,10) NOT NULL DEFAULT 15.0000000000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'TENANT_OWNER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" UUID,
    "userAgent" VARCHAR(255),
    "ip" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceAuditLog" (
    "id" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "targetTenantId" UUID NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "entityType" VARCHAR(40) NOT NULL,
    "entityId" UUID NOT NULL,
    "details" VARCHAR(1000),
    "ip" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevelatorTenantMapping" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "revelatorEnterpriseId" INTEGER NOT NULL,
    "revelatorUserId" VARCHAR(128) NOT NULL,
    "revelatorPlanType" VARCHAR(32) NOT NULL,
    "provisionedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevelatorTenantMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycVerification" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "documentType" VARCHAR(40),
    "s3ObjectKey" VARCHAR(512),
    "mimeType" VARCHAR(64),
    "encryptionIvHex" VARCHAR(32),
    "encryptionAuthTagHex" VARCHAR(32),
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" VARCHAR(500),
    "reviewedByUserId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxDeclaration" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "formType" "TaxFormType" NOT NULL,
    "status" "TaxDeclarationStatus" NOT NULL DEFAULT 'SUBMITTED_UNDER_REVIEW',
    "taxpayerLegalName" VARCHAR(160) NOT NULL,
    "residenceCountryCode" CHAR(2) NOT NULL,
    "encryptedTaxIdHex" TEXT,
    "encryptionIvHex" VARCHAR(32),
    "encryptionAuthTagHex" VARCHAR(32),
    "taxIdLast4" VARCHAR(4),
    "formDataJson" TEXT,
    "pdfDocumentKey" VARCHAR(512),
    "pdfIvHex" VARCHAR(32),
    "pdfAuthTagHex" VARCHAR(32),
    "treatyClaimed" BOOLEAN NOT NULL DEFAULT false,
    "electronicSignature" VARCHAR(160) NOT NULL,
    "signerIp" VARCHAR(64),
    "signerUserAgent" VARCHAR(255),
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "reviewedByUserId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" VARCHAR(500),

    CONSTRAINT "TaxDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Release" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "primaryArtist" VARCHAR(160) NOT NULL,
    "upcCode" VARCHAR(13),
    "status" "ReleaseStatus" NOT NULL DEFAULT 'DRAFT',
    "artworkQuarantineKey" VARCHAR(512),
    "artworkVerified" BOOLEAN NOT NULL DEFAULT false,
    "blockUgcMonetization" BOOLEAN NOT NULL DEFAULT false,
    "licenseDocumentKey" VARCHAR(512),
    "revelatorReleaseId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Track" (
    "id" UUID NOT NULL,
    "releaseId" UUID NOT NULL,
    "trackNumber" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "isrcCode" CHAR(12),
    "wavQuarantineKey" VARCHAR(512),
    "wavSha256Hash" CHAR(64),
    "sampleRateHz" INTEGER,
    "bitDepth" INTEGER,
    "channels" INTEGER,
    "acrCloudScore" INTEGER,
    "acrCloudVerdict" VARCHAR(40),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SplitAgreement" (
    "id" UUID NOT NULL,
    "trackId" UUID NOT NULL,
    "collaboratorEmail" VARCHAR(255) NOT NULL,
    "collaboratorTenantId" UUID,
    "sharePercentage" DECIMAL(18,10) NOT NULL,
    "status" "SplitStatus" NOT NULL DEFAULT 'PENDING_INVITATION_ESCROW',
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SplitAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoyaltyLedgerEntry" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "entryType" "LedgerEntryType" NOT NULL,
    "amountUsd" DECIMAL(18,10) NOT NULL,
    "runningBalance" DECIMAL(18,10) NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "referenceId" VARCHAR(128),
    "description" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoyaltyLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutRequest" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "requestedAmount" DECIMAL(18,10) NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'PENDING_APPROVAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "ComplianceAuditLog_targetTenantId_createdAt_idx" ON "ComplianceAuditLog"("targetTenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RevelatorTenantMapping_tenantId_key" ON "RevelatorTenantMapping"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "RevelatorTenantMapping_revelatorEnterpriseId_key" ON "RevelatorTenantMapping"("revelatorEnterpriseId");

-- CreateIndex
CREATE INDEX "KycVerification_tenantId_status_idx" ON "KycVerification"("tenantId", "status");

-- CreateIndex
CREATE INDEX "TaxDeclaration_tenantId_status_idx" ON "TaxDeclaration"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Release_upcCode_key" ON "Release"("upcCode");

-- CreateIndex
CREATE UNIQUE INDEX "Release_revelatorReleaseId_key" ON "Release"("revelatorReleaseId");

-- CreateIndex
CREATE INDEX "Release_tenantId_status_idx" ON "Release"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Track_isrcCode_key" ON "Track"("isrcCode");

-- CreateIndex
CREATE INDEX "Track_releaseId_idx" ON "Track"("releaseId");

-- CreateIndex
CREATE INDEX "SplitAgreement_trackId_idx" ON "SplitAgreement"("trackId");

-- CreateIndex
CREATE INDEX "SplitAgreement_collaboratorEmail_idx" ON "SplitAgreement"("collaboratorEmail");

-- CreateIndex
CREATE UNIQUE INDEX "RoyaltyLedgerEntry_idempotencyKey_key" ON "RoyaltyLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RoyaltyLedgerEntry_tenantId_createdAt_idx" ON "RoyaltyLedgerEntry"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutRequest_idempotencyKey_key" ON "PayoutRequest"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PayoutRequest_tenantId_status_idx" ON "PayoutRequest"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevelatorTenantMapping" ADD CONSTRAINT "RevelatorTenantMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycVerification" ADD CONSTRAINT "KycVerification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxDeclaration" ADD CONSTRAINT "TaxDeclaration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Release" ADD CONSTRAINT "Release_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitAgreement" ADD CONSTRAINT "SplitAgreement_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoyaltyLedgerEntry" ADD CONSTRAINT "RoyaltyLedgerEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
