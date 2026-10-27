import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import {
  type Result,
  type BeatLicenseInspectionSummary,
  ok,
  err,
  createDomainError,
} from '@wave/contracts';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';
import type { DocumentStoragePort } from '../../compliance/ports/document-storage.port.js';

/**
 * Allows a WAVE_COMPLIANCE_ADMIN to decrypt on-the-fly (AES-256-GCM) and verify
 * the Beat License PDF submitted for a Grey-Area (45% - 79%) release.
 */
export async function inspectBeatLicensePdfUseCase(params: {
  prisma: PrismaClient;
  storage: DocumentStoragePort;
  actorUserId: string;
  actorRole: string;
  releaseId: string;
  ip?: string;
}): Promise<Result<BeatLicenseInspectionSummary>> {
  return executeIsolatedUseCase('InspectBeatLicensePdfUseCase', async () => {
    if (params.actorRole !== 'WAVE_COMPLIANCE_ADMIN') {
      return err(
        createDomainError({
          code: 'FORBIDDEN_IDOR',
          moduleName: 'InspectBeatLicensePdfUseCase',
          message: 'Solo los administradores pueden descifrar e inspeccionar licencias de Beat.',
        }),
      );
    }

    const release = await params.prisma.release.findUnique({
      where: { id: params.releaseId },
    });

    if (!release) {
      return err(
        createDomainError({
          code: 'VALIDATION_ERROR',
          moduleName: 'InspectBeatLicensePdfUseCase',
          message: 'El lanzamiento solicitado no existe.',
        }),
      );
    }

    if (
      !release.licenseDocumentKey ||
      !release.licensePdfIvHex ||
      !release.licensePdfAuthTagHex
    ) {
      return err(
        createDomainError({
          code: 'VALIDATION_ERROR',
          moduleName: 'InspectBeatLicensePdfUseCase',
          message: 'Este lanzamiento no tiene un documento PDF de licencia de Beat adjunto.',
        }),
      );
    }

    const decryptedRes = await params.storage.readDecryptedDocument({
      objectKey: release.licenseDocumentKey,
      ivHex: release.licensePdfIvHex,
      authTagHex: release.licensePdfAuthTagHex,
    });
    if (!decryptedRes.ok) {
      return decryptedRes;
    }

    const rawPdf = decryptedRes.value;
    const sha256Hex = createHash('sha256').update(rawPdf).digest('hex');
    const pdfMagicHeaderValid =
      rawPdf.byteLength >= 5 &&
      rawPdf[0] === 0x25 &&
      rawPdf[1] === 0x50 &&
      rawPdf[2] === 0x44 &&
      rawPdf[3] === 0x46 &&
      rawPdf[4] === 0x2d;

    await params.prisma.complianceAuditLog.create({
      data: {
        actorUserId: params.actorUserId,
        targetTenantId: release.tenantId,
        action: 'ADMIN_BEAT_LICENSE_PDF_DECRYPTED',
        entityType: 'RELEASE',
        entityId: release.id,
        details: `SHA256=${sha256Hex.slice(0, 16)}... bytes=${rawPdf.byteLength}`,
        ...(params.ip !== undefined ? { ip: params.ip } : {}),
      },
    });

    return ok({
      releaseId: release.id,
      documentKey: release.licenseDocumentKey,
      decryptedByteLength: rawPdf.byteLength,
      sha256Hex,
      pdfMagicHeaderValid,
      base64Preview: rawPdf.toString('base64'),
      inspectedAt: new Date().toISOString(),
    });
  });
}
