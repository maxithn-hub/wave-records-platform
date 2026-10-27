import type { PrismaClient } from '@prisma/client';
import {
  type SubmitW8BenEMetadata,
  type Result,
  ok,
  err,
  createDomainError,
} from '@wave/contracts';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';
import type { DocumentStoragePort } from '../ports/document-storage.port.js';

export async function submitW8BenEPdfUseCase(params: {
  prisma: PrismaClient;
  storage: DocumentStoragePort;
  actorUserId: string;
  sessionTenantId: string;
  metadata: SubmitW8BenEMetadata;
  rawPdfBuffer: Buffer;
  ip?: string;
  userAgent?: string;
}): Promise<Result<{ taxDeclarationId: string }>> {
  return executeIsolatedUseCase('SubmitW8BenEPdfUseCase', async () => {
    const storedPdf = await params.storage.saveEncryptedDocument({
      tenantId: params.sessionTenantId,
      category: 'tax-w8bene',
      rawBuffer: params.rawPdfBuffer,
    });
    if (!storedPdf.ok) {
      return storedPdf;
    }

    if (storedPdf.value.mimeType !== 'application/pdf') {
      return err(
        createDomainError({
          code: 'VALIDATION_ERROR',
          moduleName: 'SubmitW8BenEPdfUseCase',
          message: 'El formulario W-8BEN-E firmado debe subirse exclusivamente en formato PDF.',
        }),
      );
    }

    const declaration = await params.prisma.$transaction(async (tx) => {
      const created = await tx.taxDeclaration.create({
        data: {
          tenantId: params.sessionTenantId,
          formType: 'W8BENE',
          status: 'SUBMITTED_UNDER_REVIEW',
          taxpayerLegalName: params.metadata.entityLegalName,
          residenceCountryCode: params.metadata.countryOfIncorporation,
          pdfDocumentKey: storedPdf.value.objectKey,
          pdfIvHex: storedPdf.value.ivHex,
          pdfAuthTagHex: storedPdf.value.authTagHex,
          electronicSignature: params.metadata.electronicSignatureName,
          ...(params.ip !== undefined ? { signerIp: params.ip } : {}),
          ...(params.userAgent !== undefined ? { signerUserAgent: params.userAgent } : {}),
        },
      });

      await tx.complianceAuditLog.create({
        data: {
          actorUserId: params.actorUserId,
          targetTenantId: params.sessionTenantId,
          action: 'TAX_W8BENE_PDF_SUBMITTED',
          entityType: 'TAX_DECLARATION',
          entityId: created.id,
          details: `Country=${params.metadata.countryOfIncorporation}`,
          ...(params.ip !== undefined ? { ip: params.ip } : {}),
        },
      });

      return created;
    });

    return ok({ taxDeclarationId: declaration.id });
  });
}
