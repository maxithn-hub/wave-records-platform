-- CreateEnum
CREATE TYPE "ReleaseType" AS ENUM ('SINGLE', 'EP', 'ALBUM');

-- AlterTable
ALTER TABLE "Release" ADD COLUMN     "artworkSha256Hash" CHAR(64),
ADD COLUMN     "cLineOwner" VARCHAR(160) NOT NULL DEFAULT 'Wave Records LLC',
ADD COLUMN     "cLineYear" INTEGER NOT NULL DEFAULT 2026,
ADD COLUMN     "pLineOwner" VARCHAR(160) NOT NULL DEFAULT 'Wave Records LLC',
ADD COLUMN     "pLineYear" INTEGER NOT NULL DEFAULT 2026,
ADD COLUMN     "primaryGenre" VARCHAR(80) NOT NULL DEFAULT 'Latin',
ADD COLUMN     "releaseDate" TIMESTAMP(3),
ADD COLUMN     "releaseType" "ReleaseType" NOT NULL DEFAULT 'SINGLE',
ADD COLUMN     "versionTitle" VARCHAR(120);

-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "audioLanguage" VARCHAR(8) NOT NULL DEFAULT 'es',
ADD COLUMN     "durationSeconds" INTEGER,
ADD COLUMN     "isExplicit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isInstrumental" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "primaryArtist" VARCHAR(160) NOT NULL DEFAULT '',
ADD COLUMN     "versionTitle" VARCHAR(120);

-- CreateTable
CREATE TABLE "MultipartUploadSession" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "releaseId" UUID NOT NULL,
    "trackId" UUID,
    "assetKind" VARCHAR(24) NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "expectedByteSize" INTEGER NOT NULL,
    "expectedSha256Hex" CHAR(64) NOT NULL,
    "totalParts" INTEGER NOT NULL,
    "uploadedPartsJson" TEXT NOT NULL DEFAULT '[]',
    "status" VARCHAR(24) NOT NULL DEFAULT 'INITIATED',
    "quarantineObjectKey" VARCHAR(512),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MultipartUploadSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MultipartUploadSession_tenantId_releaseId_idx" ON "MultipartUploadSession"("tenantId", "releaseId");

-- CreateIndex
CREATE UNIQUE INDEX "Track_releaseId_trackNumber_key" ON "Track"("releaseId", "trackNumber");

