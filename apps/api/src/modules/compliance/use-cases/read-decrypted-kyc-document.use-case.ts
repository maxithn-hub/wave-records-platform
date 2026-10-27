import type { PrismaClient } from '@prisma/client';
import { type Result, ok, err, createDomainError } from '@wave/contracts';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';
import type { DocumentStoragePort } from '../ports/document-storage.port.js';

export async function readDecryptedKycDocumentUseCase(params: {
  prisma: PrismaClient;
  storage: DocumentStoragePort;
  adminUserId: string;
  kycVerificationId: string;
  ip?: string;
}): Promise<Result<{ decryptedBuffer: Buffer; mimeType: string }>> {
  return executeIsolatedUseCase('ReadDecryptedKycDocumentUseCase', async () => {
    const kyc = await params.prisma.kycVerification.findUnique({
      where: { id: params.kycVerificationId },
    });

    if (
      !kyc ||
      !kyc.s3ObjectKey ||
      !kyc.encryptionIvHex ||
      !kyc.encryptionAuthTagHex ||
      !kyc.mimeType
    ) {
      return err(
        createDomainError({
          code: 'VALIDATION_ERROR',
          moduleName: 'ReadDecryptedKycDocumentUseCase',
          message: 'El registro KYC no tiene un documento cifrado asociado.',
        }),
      );
    }

    const decrypted = await params.storage.readDecryptedDocument({
      objectKey: kyc.s3ObjectKey,
      ivHex: kyc.encryptionIvHex,
      authTagHex: kyc.encryptionAuthTagHex,
    });

    if (!decrypted.ok) {
      return decrypted;
    }

    await params.prisma.complianceAuditLog.create({
      data: {
        actorUserId: params.adminUserId,
        targetTenantId: kyc.tenantId,
        action: 'KYC_DOCUMENT_INSPECTED_BY_ADMIN',
        entityType: 'KYC_VERIFICATION',
        entityId: kyc.id,
        ...(params.ip !== undefined ? { ip: params.ip } : {}),
      },
    });

    return ok({
      decryptedBuffer: decrypted.value,
      mimeType: kyc.mimeType,
    });
  });
}
