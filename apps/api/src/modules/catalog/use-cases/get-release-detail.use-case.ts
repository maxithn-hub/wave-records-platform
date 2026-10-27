import type { PrismaClient } from '@prisma/client';
import {
  type CatalogReleaseDetailDto,
  type Result,
  ok,
  err,
  createDomainError,
} from '@wave/contracts';
import { isReleaseEditableByTenant } from '@wave/domain-core';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';

export async function getReleaseDetailUseCase(params: {
  prisma: PrismaClient;
  sessionTenantId: string;
  releaseId: string;
}): Promise<Result<CatalogReleaseDetailDto>> {
  return executeIsolatedUseCase('GetReleaseDetailUseCase', async () => {
    const release = await params.prisma.release.findUnique({
      where: { id: params.releaseId },
      include: {
        tracks: {
          orderBy: { trackNumber: 'asc' },
        },
      },
    });

    if (!release || release.tenantId !== params.sessionTenantId) {
      return err(
        createDomainError({
          code: 'FORBIDDEN_IDOR',
          moduleName: 'GetReleaseDetailUseCase',
          message: 'El lanzamiento no existe o pertenece a otro Tenant.',
        }),
      );
    }

    return ok({
      id: release.id,
      tenantId: release.tenantId,
      title: release.title,
      versionTitle: release.versionTitle,
      primaryArtist: release.primaryArtist,
      releaseType: release.releaseType,
      primaryGenre: release.primaryGenre,
      releaseDateIso: release.releaseDate
        ? release.releaseDate.toISOString().slice(0, 10)
        : null,
      pLineYear: release.pLineYear,
      pLineOwner: release.pLineOwner,
      cLineYear: release.cLineYear,
      cLineOwner: release.cLineOwner,
      upcCode: release.upcCode,
      status: release.status,
      artworkQuarantineKey: release.artworkQuarantineKey,
      artworkSha256Hash: release.artworkSha256Hash,
      artworkVerified: release.artworkVerified,
      isEditable:
        isReleaseEditableByTenant(release.status) ||
        release.status === 'UPLOADING_ASSETS',
      tracks: release.tracks.map((t) => ({
        id: t.id,
        trackNumber: t.trackNumber,
        title: t.title,
        versionTitle: t.versionTitle,
        primaryArtist: t.primaryArtist,
        isExplicit: t.isExplicit,
        isInstrumental: t.isInstrumental,
        audioLanguage: t.audioLanguage,
        isrcCode: t.isrcCode,
        wavQuarantineKey: t.wavQuarantineKey,
        wavSha256Hash: t.wavSha256Hash,
        sampleRateHz: t.sampleRateHz,
        bitDepth: t.bitDepth,
        channels: t.channels,
        durationSeconds: t.durationSeconds,
      })),
      createdAt: release.createdAt.toISOString(),
    });
  });
}
