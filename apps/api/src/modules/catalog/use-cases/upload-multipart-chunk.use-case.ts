import type { PrismaClient } from '@prisma/client';
import { type Result, ok, err, createDomainError } from '@wave/contracts';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';
import type { QuarantineMultipartStoragePort } from '../ports/quarantine-multipart.port.js';

export async function uploadMultipartChunkUseCase(params: {
  prisma: PrismaClient;
  storage: QuarantineMultipartStoragePort;
  sessionTenantId: string;
  uploadSessionId: string;
  partNumber: number;
  chunkBuffer: Buffer;
}): Promise<Result<{ partNumber: number; receivedBytes: number }>> {
  return executeIsolatedUseCase('UploadMultipartChunkUseCase', async () => {
    const session = await params.prisma.multipartUploadSession.findUnique({
      where: { id: params.uploadSessionId },
    });

    if (!session || session.tenantId !== params.sessionTenantId) {
      return err(
        createDomainError({
          code: 'FORBIDDEN_IDOR',
          moduleName: 'UploadMultipartChunkUseCase',
          message: 'Sesión de subida no encontrada o perteneciente a otro Tenant.',
        }),
      );
    }

    if (session.status !== 'INITIATED') {
      return err(
        createDomainError({
          code: 'INVALID_STATE_TRANSITION',
          moduleName: 'UploadMultipartChunkUseCase',
          message: `La sesión de subida ya está en estado "${session.status}".`,
        }),
      );
    }

    if (params.partNumber < 1 || params.partNumber > session.totalParts) {
      return err(
        createDomainError({
          code: 'VALIDATION_ERROR',
          moduleName: 'UploadMultipartChunkUseCase',
          message: `Número de fragmento inválido (${params.partNumber}). Debe estar entre 1 y ${session.totalParts}.`,
        }),
      );
    }

    const writeRes = await params.storage.writeUploadChunk({
      uploadSessionId: session.id,
      partNumber: params.partNumber,
      chunkBuffer: params.chunkBuffer,
    });
    if (!writeRes.ok) {
      return writeRes;
    }

    const existingParts = JSON.parse(session.uploadedPartsJson) as number[];
    if (!existingParts.includes(params.partNumber)) {
      existingParts.push(params.partNumber);
      existingParts.sort((a, b) => a - b);
      await params.prisma.multipartUploadSession.update({
        where: { id: session.id },
        data: { uploadedPartsJson: JSON.stringify(existingParts) },
      });
    }

    return ok({
      partNumber: params.partNumber,
      receivedBytes: writeRes.value.byteLength,
    });
  });
}
