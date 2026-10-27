import type { PrismaClient } from '@prisma/client';
import {
  type KycDocumentType,
  type Result,
  ok,
} from '@wave/contracts';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';
import type { DocumentStoragePort } from '../ports/document-storage.port.js';
import type { IdentityVerificationPort } from '../ports/identity-verification.port.js';

export async function submitKycDocumentUseCase(params: {
  prisma: PrismaClient;
  storage: DocumentStoragePort;
  kycPort: IdentityVerificationPort;
  actorUserId: string;
  sessionTenantId: string;
  documentType: KycDocumentType;
  rawFileBuffer: Buffer;
  ip?: string;
}): Promise<Result<{ kycVerificationId: string; status: string }>> {
  return executeIsolatedUseCase('SubmitKycDocumentUseCase', async () => {
    const storedRes = await params.storage.saveEncryptedDocument({
      tenantId: params.sessionTenantId,
      category: 'kyc',
      rawBuffer: params.rawFileBuffer,
    });
    if (!storedRes.ok) {
      return storedRes;
    }

    const kycPortRes = await params.kycPort.registerDocumentSubmission({
      tenantId: params.sessionTenantId,
      documentType: params.documentType,
      objectKey: storedRes.value.objectKey,
    });
    if (!kycPortRes.ok) {
      return kycPortRes;
    }

    const verification = await params.prisma.$transaction(async (tx) => {
      const record = await tx.kycVerification.create({
        data: {
          tenantId: params.sessionTenantId,
          status: kycPortRes.value.nextStatus,
          documentType: params.documentType,
          s3ObjectKey: storedRes.value.objectKey,
          mimeType: storedRes.value.mimeType,
          encryptionIvHex: storedRes.value.ivHex,
          encryptionAuthTagHex: storedRes.value.authTagHex,
        },
      });

      await tx.complianceAuditLog.create({
        data: {
          actorUserId: params.actorUserId,
          targetTenantId: params.sessionTenantId,
          action: 'KYC_DOCUMENT_SUBMITTED',
          entityType: 'KYC_VERIFICATION',
          entityId: record.id,
          details: `DocumentType=${params.documentType}; MimeType=${storedRes.value.mimeType}`,
          ...(params.ip !== undefined ? { ip: params.ip } : {}),
        },
      });

      return record;
    });

    return ok({
      kycVerificationId: verification.id,
      status: verification.status,
    });
  });
}
