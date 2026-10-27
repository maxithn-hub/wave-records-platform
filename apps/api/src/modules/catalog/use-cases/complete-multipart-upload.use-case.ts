import type { PrismaClient } from '@prisma/client';
import { type Result, ok, err, createDomainError } from '@wave/contracts';
import { parseAndValidateWavPcmHeader } from '@wave/domain-core';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';
import type { QuarantineMultipartStoragePort } from '../ports/quarantine-multipart.port.js';

export async function completeMultipartUploadUseCase(params: {
  prisma: PrismaClient;
  storage: QuarantineMultipartStoragePort;
  actorUserId: string;
  sessionTenantId: string;
  uploadSessionId: string;
  ip?: string;
}): Promise<
  Result<{
    quarantineObjectKey: string;
    verifiedSha256Hex: string;
    wavTechnical?: {
      sampleRateHz: number;
      bitDepth: number;
      channels: number;
      durationSeconds: number;
    };
  }>
> {
  return executeIsolatedUseCase('CompleteMultipartUploadUseCase', async () => {
    const session = await params.prisma.multipartUploadSession.findUnique({
      where: { id: params.uploadSessionId },
    });

    if (!session || session.tenantId !== params.sessionTenantId) {
      return err(
        createDomainError({
          code: 'FORBIDDEN_IDOR',
          moduleName: 'CompleteMultipartUploadUseCase',
          message: 'Sesión de subida no encontrada o perteneciente a otro Tenant.',
        }),
      );
    }

    if (session.status !== 'INITIATED') {
      return err(
        createDomainError({
          code: 'INVALID_STATE_TRANSITION',
          moduleName: 'CompleteMultipartUploadUseCase',
          message: `La sesión de subida ya está en estado "${session.status}".`,
        }),
      );
    }

    const assembledRes = await params.storage.assembleAndVerifyMultipartUpload({
      uploadSessionId: session.id,
      tenantId: session.tenantId,
      releaseId: session.releaseId,
      totalParts: session.totalParts,
      expectedSha256Hex: session.expectedSha256Hex,
      extension: session.assetKind === 'TRACK_WAV' ? 'wav' : 'img',
    });

    if (!assembledRes.ok) {
      await params.prisma.multipartUploadSession.update({
        where: { id: session.id },
        data: { status: 'ABORTED' },
      });
      return assembledRes;
    }

    const { quarantineObjectKey, actualSha256Hex, totalBytes, headerSampleBuffer } =
      assembledRes.value;

    if (session.assetKind === 'TRACK_WAV') {
      const wavMetaRes = parseAndValidateWavPcmHeader(headerSampleBuffer, totalBytes);
      if (!wavMetaRes.ok) {
        await params.prisma.multipartUploadSession.update({
          where: { id: session.id },
          data: { status: 'ABORTED' },
        });
        return wavMetaRes;
      }

      const wavMeta = wavMetaRes.value;

      await params.prisma.$transaction(async (tx) => {
        await tx.multipartUploadSession.update({
          where: { id: session.id },
          data: {
            status: 'COMPLETED',
            quarantineObjectKey,
            completedAt: new Date(),
          },
        });

        if (session.trackId) {
          await tx.track.update({
            where: { id: session.trackId },
            data: {
              wavQuarantineKey: quarantineObjectKey,
              wavSha256Hash: actualSha256Hex,
              sampleRateHz: wavMeta.sampleRateHz,
              bitDepth: wavMeta.bitDepth,
              channels: wavMeta.channels,
              durationSeconds: wavMeta.durationSeconds,
            },
          });
        }

        await tx.complianceAuditLog.create({
          data: {
            actorUserId: params.actorUserId,
            targetTenantId: session.tenantId,
            action: 'TRACK_WAV_UPLOADED_AND_VERIFIED',
            entityType: 'TRACK',
            entityId: session.trackId ?? session.releaseId,
            details: `SHA256=${actualSha256Hex}; ${wavMeta.sampleRateHz}Hz/${wavMeta.bitDepth}bit`,
            ...(params.ip !== undefined ? { ip: params.ip } : {}),
          },
        });
      });

      return ok({
        quarantineObjectKey,
        verifiedSha256Hex: actualSha256Hex,
        wavTechnical: {
          sampleRateHz: wavMeta.sampleRateHz,
          bitDepth: wavMeta.bitDepth,
          channels: wavMeta.channels,
          durationSeconds: wavMeta.durationSeconds,
        },
      });
    }

    // Artwork validation: must be JPEG (FF D8 FF) or PNG (89 50 4E 47)
    const isPng =
      headerSampleBuffer.byteLength >= 4 &&
      headerSampleBuffer[0] === 0x89 &&
      headerSampleBuffer[1] === 0x50 &&
      headerSampleBuffer[2] === 0x4e &&
      headerSampleBuffer[3] === 0x47;
    const isJpeg =
      headerSampleBuffer.byteLength >= 3 &&
      headerSampleBuffer[0] === 0xff &&
      headerSampleBuffer[1] === 0xd8 &&
      headerSampleBuffer[2] === 0xff;

    if (!isPng && !isJpeg) {
      await params.prisma.multipartUploadSession.update({
        where: { id: session.id },
        data: { status: 'ABORTED' },
      });
      return err(
        createDomainError({
          code: 'FORENSIC_REJECTED',
          moduleName: 'CompleteMultipartUploadUseCase',
          message: 'La portada debe ser un archivo JPEG o PNG auténtico.',
        }),
      );
    }

    await params.prisma.$transaction(async (tx) => {
      await tx.multipartUploadSession.update({
        where: { id: session.id },
        data: {
          status: 'COMPLETED',
          quarantineObjectKey,
          completedAt: new Date(),
        },
      });

      await tx.release.update({
        where: { id: session.releaseId },
        data: {
          artworkQuarantineKey: quarantineObjectKey,
          artworkSha256Hash: actualSha256Hex,
        },
      });
    });

    return ok({
      quarantineObjectKey,
      verifiedSha256Hex: actualSha256Hex,
    });
  });
}
