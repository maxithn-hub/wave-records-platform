import type { PrismaClient } from '@prisma/client';
import {
  type SubmitW9Payload,
  type Result,
  ok,
} from '@wave/contracts';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';
import { encryptSensitiveTaxIdentifier } from '../../../common/crypto/aes-gcm.cipher.js';

export async function submitW9UseCase(params: {
  prisma: PrismaClient;
  actorUserId: string;
  sessionTenantId: string;
  payload: SubmitW9Payload;
  taxMasterKeyHex: string;
  ip?: string;
  userAgent?: string;
}): Promise<Result<{ taxDeclarationId: string; maskedTaxId: string }>> {
  return executeIsolatedUseCase('SubmitW9UseCase', async () => {
    const encryptedTin = encryptSensitiveTaxIdentifier(
      params.payload.rawTinNumber,
      params.taxMasterKeyHex,
    );
    if (!encryptedTin.ok) {
      return encryptedTin;
    }

    const last4 = params.payload.rawTinNumber.slice(-4);
    const nonSensitiveMetadata = {
      businessName: params.payload.businessName ?? null,
      federalTaxClassification: params.payload.federalTaxClassification,
      tinType: params.payload.tinType,
      addressLine1: params.payload.addressLine1,
      city: params.payload.city,
      stateCode: params.payload.stateCode,
      zipCode: params.payload.zipCode,
    };

    const declaration = await params.prisma.$transaction(async (tx) => {
      const created = await tx.taxDeclaration.create({
        data: {
          tenantId: params.sessionTenantId,
          formType: 'W9',
          status: 'SUBMITTED_UNDER_REVIEW',
          taxpayerLegalName: params.payload.taxpayerLegalName,
          residenceCountryCode: 'US',
          encryptedTaxIdHex: encryptedTin.value.ciphertextHex,
          encryptionIvHex: encryptedTin.value.ivHex,
          encryptionAuthTagHex: encryptedTin.value.authTagHex,
          taxIdLast4: last4,
          formDataJson: JSON.stringify(nonSensitiveMetadata),
          treatyClaimed: false,
          electronicSignature: params.payload.electronicSignatureName,
          ...(params.ip !== undefined ? { signerIp: params.ip } : {}),
          ...(params.userAgent !== undefined ? { signerUserAgent: params.userAgent } : {}),
        },
      });

      await tx.complianceAuditLog.create({
        data: {
          actorUserId: params.actorUserId,
          targetTenantId: params.sessionTenantId,
          action: 'TAX_W9_SUBMITTED',
          entityType: 'TAX_DECLARATION',
          entityId: created.id,
          details: `TinType=${params.payload.tinType}; Last4=***${last4}`,
          ...(params.ip !== undefined ? { ip: params.ip } : {}),
        },
      });

      return created;
    });

    return ok({
      taxDeclarationId: declaration.id,
      maskedTaxId: `***-**-${last4}`,
    });
  });
}
