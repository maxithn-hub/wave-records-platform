import type { PrismaClient } from '@prisma/client';
import {
  type InitMultipartUploadPayload,
  type InitMultipartUploadResponse,
  type Result,
  ok,
  err,
  createDomainError,
} from '@wave/contracts';
import { isReleaseEditableByTenant } from '@wave/domain-core';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';

const RECOMMENDED_CHUNK_BYTES = 5 * 1024 * 1024; // 5 MB per chunk

export async function initMultipartUploadUseCase(params: {
  prisma: PrismaClient;
  sessionTenantId: string;
  payload: InitMultipartUploadPayload;
}): Promise<Result<InitMultipartUploadResponse>> {
  return executeIsolatedUseCase('InitMultipartUploadUseCase', async () => {
    const release = await params.prisma.release.findUnique({
      where: { id: params.payload.releaseId },
    });

    if (!release || release.tenantId !== params.sessionTenantId) {
      return err(
        createDomainError({
          code: 'FORBIDDEN_IDOR',
          moduleName: 'InitMultipartUploadUseCase',
          message: 'Lanzamiento no encontrado o perteneciente a otro Tenant.',
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
          moduleName: 'InitMultipartUploadUseCase',
          message: `No se pueden subir nuevos archivos cuando el lanzamiento está en estado "${release.status}".`,
        }),
      );
    }

    if (params.payload.assetKind === 'TRACK_WAV' && !params.payload.trackId) {
      return err(
        createDomainError({
          code: 'VALIDATION_ERROR',
          moduleName: 'InitMultipartUploadUseCase',
          message: 'Debes indicar el trackId al iniciar una subida de audio WAV.',
        }),
      );
    }

    const session = await params.prisma.$transaction(async (tx) => {
      if (release.status === 'DRAFT') {
        await tx.release.update({
          where: { id: release.id },
          data: { status: 'UPLOADING_ASSETS' },
        });
      }

      return tx.multipartUploadSession.create({
        data: {
          tenantId: params.sessionTenantId,
          releaseId: params.payload.releaseId,
          trackId: params.payload.trackId ?? null,
          assetKind: params.payload.assetKind,
          fileName: params.payload.fileName,
          expectedByteSize: params.payload.expectedByteSize,
          expectedSha256Hex: params.payload.expectedSha256Hex.toLowerCase(),
          totalParts: params.payload.totalParts,
          status: 'INITIATED',
        },
      });
    });

    return ok({
      uploadSessionId: session.id,
      recommendedChunkBytes: RECOMMENDED_CHUNK_BYTES,
      totalParts: session.totalParts,
    });
  });
}
