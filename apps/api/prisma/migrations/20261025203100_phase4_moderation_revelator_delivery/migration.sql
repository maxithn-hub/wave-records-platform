-- AlterTable
ALTER TABLE "Release" ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "moderatedByUserId" UUID,
ADD COLUMN     "moderationNotes" VARCHAR(500);

-- CreateTable
CREATE TABLE "RevelatorDeliveryJob" (
    "id" UUID NOT NULL,
    "releaseId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "revelatorEnterpriseId" INTEGER NOT NULL,
    "revelatorUserId" VARCHAR(128) NOT NULL,
    "revelatorPlanType" VARCHAR(32) NOT NULL,
    "revelatorReleaseId" INTEGER,
    "unpromptedTokenCached" BOOLEAN NOT NULL DEFAULT false,
    "ugcMonetizationBlocked" BOOLEAN NOT NULL DEFAULT false,
    "ugcMonetizationPolicy" VARCHAR(40) NOT NULL,
    "dspTargetsJson" TEXT NOT NULL,
    "payloadSnapshotJson" TEXT NOT NULL,
    "deliveryStatus" VARCHAR(40) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "lastError" VARCHAR(500),
    "moderatedByUserId" UUID NOT NULL,
    "dispatchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevelatorDeliveryJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RevelatorDeliveryJob_releaseId_createdAt_idx" ON "RevelatorDeliveryJob"("releaseId", "createdAt");

-- AddForeignKey
ALTER TABLE "RevelatorDeliveryJob" ADD CONSTRAINT "RevelatorDeliveryJob_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;
