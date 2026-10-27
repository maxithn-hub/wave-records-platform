import type { PrismaClient } from '@prisma/client';
import {
  type AcrCloudVerdictTier,
  type ForensicScanReportDto,
  type Result,
  ok,
  err,
  createDomainError,
} from '@wave/contracts';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';

export async function getLatestForensicReportUseCase(params: {
  prisma: PrismaClient;
  sessionTenantId: string;
  releaseId: string;
}): Promise<Result<ForensicScanReportDto | null>> {
  return executeIsolatedUseCase('GetLatestForensicReportUseCase', async () => {
    const release = await params.prisma.release.findUnique({
      where: { id: params.releaseId },
      include: {
        forensicReports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!release || release.tenantId !== params.sessionTenantId) {
      return err(
        createDomainError({
          code: 'FORBIDDEN_IDOR',
          moduleName: 'GetLatestForensicReportUseCase',
          message: 'El lanzamiento no existe o pertenece a otro Tenant.',
        }),
      );
    }

    const latest = release.forensicReports[0];
    if (!latest) {
      return ok(null);
    }

    return ok({
      id: latest.id,
      releaseId: release.id,
      artworkWidthPx: latest.artworkWidthPx,
      artworkHeightPx: latest.artworkHeightPx,
      artworkColorSpace: latest.artworkColorSpace,
      artworkPassed: latest.artworkPassed,
      audioSilenceMaxRatio: latest.audioSilenceMaxRatio,
      audioSignalPassed: latest.audioSignalPassed,
      maxAcrCloudScore: latest.maxAcrCloudScore,
      acrCloudVerdict: latest.acrCloudVerdict as AcrCloudVerdictTier,
      matchedTitle: latest.matchedTitle,
      matchedArtist: latest.matchedArtist,
      summaryReason: latest.summaryReason,
      resultingReleaseStatus: release.status,
      blockUgcMonetization: release.blockUgcMonetization,
      hasUploadedLicensePdf: Boolean(release.licenseDocumentKey),
      createdAt: latest.createdAt.toISOString(),
    });
  });
}
