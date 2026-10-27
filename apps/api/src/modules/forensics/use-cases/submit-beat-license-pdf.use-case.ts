import type { PrismaClient } from '@prisma/client';
import { type Result, ok, err, createDomainError } from '@wave/contracts';
import { validateReleaseStateTransition } from '@wave/domain-core';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';
import type { DocumentStoragePort } from '../../compliance/ports/document-storage.port.js';

/**
 * Handles the Grey-Area Copyright workflow (ACRCloud Score 45% - 79%):
 * Requires the artist/producer to upload their PDF License for Type Beats / non-exclusive samples.
 * Keeps blockUgcMonetization = true (blocking YouTube Content ID, TikTok, Meta Rights Manager)
 * and promotes the release from MANUAL_COPYRIGHT_REVIEW -> MODERATION_QUEUE.
 */
export async function submitBeatLicensePdfUseCase(params: {
  prisma: PrismaClient;
  storage: DocumentStoragePort;
  actorUserId: string;
  sessionTenantId: string;
  releaseId: string;
  rawPdfBuffer: Buffer;
  ip?: string;
}): Promise<
  Result<{
    releaseId: string;
    nextStatus: string;
    blockUgcMonetization: boolean;
  }>
> {
  return executeIsolatedUseCase('SubmitBeatLicensePdfUseCase', async () => {
    const release = await params.prisma.release.findUnique({
      where: { id: params.releaseId },
    });

    if (!release || release.tenantId !== params.sessionTenantId) {
      return err(
        createDomainError({
          code: 'FORBIDDEN_IDOR',
          moduleName: 'SubmitBeatLicensePdfUseCase',
          message: 'El lanzamiento no existe o pertenece a otro Tenant.',
        }),
      );
    }

    const fsmCheck = validateReleaseStateTransition(
      release.status,
      'MODERATION_QUEUE',
    );
    if (!fsmCheck.ok) {
      return fsmCheck;
    }

    const storedPdf = await params.storage.saveEncryptedDocument({
      tenantId: params.sessionTenantId,
      category: 'kyc',
      rawBuffer: params.rawPdfBuffer,
    });
    if (!storedPdf.ok) {
      return storedPdf;
    }

    if (storedPdf.value.mimeType !== 'application/pdf') {
      return err(
        createDomainError({
          code: 'VALIDATION_ERROR',
          moduleName: 'SubmitBeatLicensePdfUseCase',
          message: 'La licencia de uso (Type Beat / Sample) debe ser un archivo PDF auténtico.',
        }),
      );
    }

    await params.prisma.$transaction(async (tx) => {
      await tx.release.update({
        where: { id: release.id },
        data: {
          status: 'MODERATION_QUEUE',
          blockUgcMonetization: true, // Strictly enforced for Grey-Area Type Beats
          licenseDocumentKey: storedPdf.value.objectKey,
          licensePdfIvHex: storedPdf.value.ivHex,
          licensePdfAuthTagHex: storedPdf.value.authTagHex,
        },
      });

      await tx.complianceAuditLog.create({
        data: {
          actorUserId: params.actorUserId,
          targetTenantId: params.sessionTenantId,
          action: 'BEAT_LICENSE_PDF_SUBMITTED',
          entityType: 'RELEASE',
          entityId: release.id,
          details: 'Promoted MANUAL_COPYRIGHT_REVIEW -> MODERATION_QUEUE (UGC Blocked)',
          ...(params.ip !== undefined ? { ip: params.ip } : {}),
        },
      });
    });

    return ok({
      releaseId: release.id,
      nextStatus: 'MODERATION_QUEUE',
      blockUgcMonetization: true,
    });
  });
}
