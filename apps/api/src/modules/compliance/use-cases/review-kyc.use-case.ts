import type { PrismaClient } from '@prisma/client';
import {
  type ReviewDecisionPayload,
  type Result,
  ok,
  err,
  createDomainError,
} from '@wave/contracts';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';

export async function reviewKycUseCase(params: {
  prisma: PrismaClient;
  adminUserId: string;
  kycVerificationId: string;
  payload: ReviewDecisionPayload;
  ip?: string;
}): Promise<Result<{ kycStatus: string; tenantActivated: boolean }>> {
  return executeIsolatedUseCase('ReviewKycUseCase', async () => {
    const kyc = await params.prisma.kycVerification.findUnique({
      where: { id: params.kycVerificationId },
    });

    if (!kyc) {
      return err(
        createDomainError({
          code: 'VALIDATION_ERROR',
          moduleName: 'ReviewKycUseCase',
          message: 'Registro de verificación KYC no encontrado.',
        }),
      );
    }

    const nextStatus = params.payload.decision === 'APPROVE' ? 'VERIFIED' : 'REJECTED';

    const outcome = await params.prisma.$transaction(async (tx) => {
      await tx.kycVerification.update({
        where: { id: kyc.id },
        data: {
          status: nextStatus,
          verifiedAt: nextStatus === 'VERIFIED' ? new Date() : null,
          rejectionReason:
            nextStatus === 'REJECTED' ? (params.payload.reason ?? null) : null,
          reviewedByUserId: params.adminUserId,
          reviewedAt: new Date(),
        },
      });

      const latestValidatedTax = await tx.taxDeclaration.findFirst({
        where: { tenantId: kyc.tenantId, status: 'VALIDATED' },
      });

      const shouldActivateTenant =
        nextStatus === 'VERIFIED' && latestValidatedTax !== null;

      if (shouldActivateTenant) {
        await tx.tenant.update({
          where: { id: kyc.tenantId },
          data: { status: 'ACTIVE' },
        });
      }

      await tx.complianceAuditLog.create({
        data: {
          actorUserId: params.adminUserId,
          targetTenantId: kyc.tenantId,
          action: nextStatus === 'VERIFIED' ? 'KYC_APPROVED' : 'KYC_REJECTED',
          entityType: 'KYC_VERIFICATION',
          entityId: kyc.id,
          details: params.payload.reason ?? `TenantActivated=${shouldActivateTenant}`,
          ...(params.ip !== undefined ? { ip: params.ip } : {}),
        },
      });

      return { kycStatus: nextStatus, tenantActivated: shouldActivateTenant };
    });

    return ok(outcome);
  });
}
