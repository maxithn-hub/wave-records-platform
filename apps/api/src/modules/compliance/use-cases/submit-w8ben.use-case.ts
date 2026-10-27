import type { PrismaClient } from '@prisma/client';
import {
  type SubmitW8BenPayload,
  type Result,
  ok,
} from '@wave/contracts';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';
import { encryptSensitiveTaxIdentifier } from '../../../common/crypto/aes-gcm.cipher.js';

export async function submitW8BenUseCase(params: {
  prisma: PrismaClient;
  actorUserId: string;
  sessionTenantId: string;
  payload: SubmitW8BenPayload;
  taxMasterKeyHex: string;
  ip?: string;
  userAgent?: string;
}): Promise<Result<{ taxDeclarationId: string; maskedTaxId: string }>> {
  return executeIsolatedUseCase('SubmitW8BenUseCase', async () => {
    const encryptedFtin = encryptSensitiveTaxIdentifier(
      params.payload.rawForeignTaxId,
      params.taxMasterKeyHex,
    );
    if (!encryptedFtin.ok) {
      return encryptedFtin;
    }

    const last4 = params.payload.rawForeignTaxId.slice(-4);
    const nonSensitiveMetadata = {
      countryOfCitizenship: params.payload.countryOfCitizenship,
      permanentResidenceAddress: params.payload.permanentResidenceAddress,
      cityOrTown: params.payload.cityOrTown,
      dateOfBirthIso: params.payload.dateOfBirthIso,
      treatyCountryCode: params.payload.treatyCountryCode ?? null,
    };

    // W-8BEN expires on Dec 31 of the 3rd succeeding calendar year per IRS rules
    const expiresYear = new Date().getUTCFullYear() + 3;
    const expiresAt = new Date(Date.UTC(expiresYear, 11, 31, 23, 59, 59));

    const declaration = await params.prisma.$transaction(async (tx) => {
      const created = await tx.taxDeclaration.create({
        data: {
          tenantId: params.sessionTenantId,
          formType: 'W8BEN',
          status: 'SUBMITTED_UNDER_REVIEW',
          taxpayerLegalName: params.payload.beneficialOwnerName,
          residenceCountryCode: params.payload.countryOfResidence,
          encryptedTaxIdHex: encryptedFtin.value.ciphertextHex,
          encryptionIvHex: encryptedFtin.value.ivHex,
          encryptionAuthTagHex: encryptedFtin.value.authTagHex,
          taxIdLast4: last4,
          formDataJson: JSON.stringify(nonSensitiveMetadata),
          treatyClaimed: params.payload.claimTaxTreatyBenefits,
          electronicSignature: params.payload.electronicSignatureName,
          expiresAt,
          ...(params.ip !== undefined ? { signerIp: params.ip } : {}),
          ...(params.userAgent !== undefined ? { signerUserAgent: params.userAgent } : {}),
        },
      });

      await tx.complianceAuditLog.create({
        data: {
          actorUserId: params.actorUserId,
          targetTenantId: params.sessionTenantId,
          action: 'TAX_W8BEN_SUBMITTED',
          entityType: 'TAX_DECLARATION',
          entityId: created.id,
          details: `Residence=${params.payload.countryOfResidence}; Treaty=${params.payload.claimTaxTreatyBenefits}`,
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
