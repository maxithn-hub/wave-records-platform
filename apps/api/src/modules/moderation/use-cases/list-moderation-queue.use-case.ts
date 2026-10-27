import type { PrismaClient } from '@prisma/client';
import {
  type Result,
  type ModerationQueueItem,
  type AcrCloudVerdictTier,
  ok,
  err,
  createDomainError,
} from '@wave/contracts';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';

export async function listModerationQueueUseCase(params: {
  prisma: PrismaClient;
  actorRole: string;
}): Promise<Result<ModerationQueueItem[]>> {
  return executeIsolatedUseCase('ListModerationQueueUseCase', async () => {
    if (params.actorRole !== 'WAVE_COMPLIANCE_ADMIN') {
      return err(
        createDomainError({
          code: 'FORBIDDEN_IDOR',
          moduleName: 'ListModerationQueueUseCase',
          message: 'Solo los administradores de moderación pueden consultar la cola de lanzamientos.',
        }),
      );
    }

    const releases = await params.prisma.release.findMany({
      where: {
        status: {
          in: [
            'MANUAL_COPYRIGHT_REVIEW',
            'MODERATION_QUEUE',
            'APPROVED_FOR_DELIVERY',
            'DISPATCHING_TO_REVELATOR',
            'LIVE_ON_DSPS',
            'REJECTED',
          ],
        },
      },
      include: {
        tenant: true,
        tracks: {
          orderBy: { trackNumber: 'asc' },
        },
        forensicReports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        deliveryJobs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const items: ModerationQueueItem[] = releases.map((rel) => {
      const latestForensic = rel.forensicReports[0] ?? null;
      const latestJob = rel.deliveryJobs[0] ?? null;

      return {
        releaseId: rel.id,
        tenantId: rel.tenantId,
        tenantDisplayName: rel.tenant.displayName,
        tenantLegalName: rel.tenant.legalName,
        tenantTier: rel.tenant.tier,
        title: rel.title,
        primaryArtist: rel.primaryArtist,
        releaseType: rel.releaseType,
        primaryGenre: rel.primaryGenre,
        upcCode: rel.upcCode,
        status: rel.status,
        blockUgcMonetization: rel.blockUgcMonetization,
        hasBeatLicensePdf: Boolean(rel.licenseDocumentKey),
        moderationNotes: rel.moderationNotes,
        revelatorReleaseId: rel.revelatorReleaseId,
        createdAt: rel.createdAt.toISOString(),
        latestForensicReport: latestForensic
          ? {
              artworkPassed: latestForensic.artworkPassed,
              artworkWidthPx: latestForensic.artworkWidthPx,
              artworkHeightPx: latestForensic.artworkHeightPx,
              artworkColorSpace: latestForensic.artworkColorSpace,
              audioSignalPassed: latestForensic.audioSignalPassed,
              audioSilenceMaxRatio: latestForensic.audioSilenceMaxRatio,
              maxAcrCloudScore: latestForensic.maxAcrCloudScore,
              acrCloudVerdict: latestForensic.acrCloudVerdict as AcrCloudVerdictTier,
              matchedTitle: latestForensic.matchedTitle,
              matchedArtist: latestForensic.matchedArtist,
              summaryReason: latestForensic.summaryReason,
            }
          : null,
        tracks: rel.tracks.map((t) => ({
          trackId: t.id,
          trackNumber: t.trackNumber,
          title: t.title,
          isrcCode: t.isrcCode,
          sampleRateHz: t.sampleRateHz,
          bitDepth: t.bitDepth,
          durationSeconds: t.durationSeconds,
          acrCloudScore: t.acrCloudScore,
          acrCloudVerdict: t.acrCloudVerdict,
        })),
        latestDeliveryJob: latestJob
          ? {
              deliveryJobId: latestJob.id,
              releaseId: latestJob.releaseId,
              releaseStatus: rel.status,
              revelatorEnterpriseId: latestJob.revelatorEnterpriseId,
              revelatorUserId: latestJob.revelatorUserId,
              revelatorPlanType: latestJob.revelatorPlanType,
              revelatorReleaseId: latestJob.revelatorReleaseId,
              unpromptedTokenCached: latestJob.unpromptedTokenCached,
              ugcMonetizationBlocked: latestJob.ugcMonetizationBlocked,
              ugcMonetizationPolicy:
                latestJob.ugcMonetizationPolicy === 'BLOCKED_BEAT_LEASE_GREY_AREA'
                  ? 'BLOCKED_BEAT_LEASE_GREY_AREA'
                  : 'MONETIZE_ALL',
              dspTargets: JSON.parse(latestJob.dspTargetsJson) as string[],
              deliveryStatus: latestJob.deliveryStatus,
              attemptCount: latestJob.attemptCount,
              dispatchedAt: latestJob.dispatchedAt
                ? latestJob.dispatchedAt.toISOString()
                : null,
            }
          : null,
      };
    });

    return ok(items);
  });
}
