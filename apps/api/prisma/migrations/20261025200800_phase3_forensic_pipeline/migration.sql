-- AlterTable
ALTER TABLE "Release" ADD COLUMN     "licensePdfAuthTagHex" VARCHAR(32),
ADD COLUMN     "licensePdfIvHex" VARCHAR(32);

-- CreateTable
CREATE TABLE "ForensicScanReport" (
    "id" UUID NOT NULL,
    "releaseId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "artworkWidthPx" INTEGER,
    "artworkHeightPx" INTEGER,
    "artworkColorSpace" VARCHAR(16),
    "artworkPassed" BOOLEAN NOT NULL DEFAULT false,
    "audioSilenceMaxRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "audioSignalPassed" BOOLEAN NOT NULL DEFAULT false,
    "maxAcrCloudScore" INTEGER NOT NULL DEFAULT 0,
    "acrCloudVerdict" VARCHAR(40) NOT NULL,
    "matchedTitle" VARCHAR(200),
    "matchedArtist" VARCHAR(160),
    "summaryReason" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForensicScanReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ForensicScanReport_releaseId_createdAt_idx" ON "ForensicScanReport"("releaseId", "createdAt");

-- AddForeignKey
ALTER TABLE "ForensicScanReport" ADD CONSTRAINT "ForensicScanReport_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;

