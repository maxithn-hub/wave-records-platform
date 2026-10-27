import type { PrismaClient } from '@prisma/client';
import {
  type UpsertTrackMetadataPayload,
  type Result,
  ok,
  err,
  createDomainError,
} from '@wave/contracts';
import {
  isReleaseEditableByTenant,
  normalizeAndValidateIsrc,
} from '@wave/domain-core';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';

export async function upsertTrackMetadataUseCase(params: {
  prisma: PrismaClient;
  sessionTenantId: string;
  releaseId: string;
  payload: UpsertTrackMetadataPayload;
}): Promise<Result<{ trackId: string; normalizedIsrc: string }>> {
  return executeIsolatedUseCase('UpsertTrackMetadataUseCase', async () => {
    const release = await params.prisma.release.findUnique({
      where: { id: params.releaseId },
    });

    if (!release || release.tenantId !== params.sessionTenantId) {
      return err(
        createDomainError({
          code: 'FORBIDDEN_IDOR',
          moduleName: 'UpsertTrackMetadataUseCase',
          message: 'El lanzamiento no existe o pertenece a otro Tenant.',
        }),
      );
    }

    if (
      !isReleaseEditableByTenant(release.status) &&
      release.status !== 'UPLOADING_ASSETS'
    ) {
      return err(
        createDomainError({
          code: 'INVALID_STATE_TRANSITION',
          moduleName: 'UpsertTrackMetadataUseCase',
          message: `Inmutabilidad de catálogo activa: no se pueden modificar tracks cuando el lanzamiento está en estado "${release.status}".`,
        }),
      );
    }

    const isrcRes = normalizeAndValidateIsrc(params.payload.isrcCode);
    if (!isrcRes.ok) {
      return isrcRes;
    }

    const conflictingIsrc = await params.prisma.track.findUnique({
      where: { isrcCode: isrcRes.value },
      select: { id: true, releaseId: true, trackNumber: true },
    });

    if (
      conflictingIsrc &&
      (conflictingIsrc.releaseId !== params.releaseId ||
        conflictingIsrc.trackNumber !== params.payload.trackNumber)
    ) {
      return err(
        createDomainError({
          code: 'VALIDATION_ERROR',
          moduleName: 'UpsertTrackMetadataUseCase',
          message: `El código ISRC "${isrcRes.value}" ya está asignado a otro track en el catálogo.`,
        }),
      );
    }

    const track = await params.prisma.track.upsert({
      where: {
        releaseId_trackNumber: {
          releaseId: params.releaseId,
          trackNumber: params.payload.trackNumber,
        },
      },
      create: {
        releaseId: params.releaseId,
        trackNumber: params.payload.trackNumber,
        title: params.payload.title,
        versionTitle: params.payload.versionTitle ?? null,
        primaryArtist: params.payload.primaryArtist,
        isExplicit: params.payload.isExplicit,
        isInstrumental: params.payload.isInstrumental,
        audioLanguage: params.payload.audioLanguage,
        isrcCode: isrcRes.value,
      },
      update: {
        title: params.payload.title,
        versionTitle: params.payload.versionTitle ?? null,
        primaryArtist: params.payload.primaryArtist,
        isExplicit: params.payload.isExplicit,
        isInstrumental: params.payload.isInstrumental,
        audioLanguage: params.payload.audioLanguage,
        isrcCode: isrcRes.value,
      },
    });

    return ok({
      trackId: track.id,
      normalizedIsrc: isrcRes.value,
    });
  });
}
