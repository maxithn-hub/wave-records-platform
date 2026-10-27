import type { PrismaClient } from '@prisma/client';
import {
  type ReviewDecisionPayload,
  type Result,
  ok,
  err,
  createDomainError,
} from '@wave/contracts';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';

export async function reviewTaxDeclarationUseCase(params: {
  prisma: PrismaClient;
  adminUserId: string;
  taxDeclarationId: string;
  payload: ReviewDecisionPayload;
  ip?: string;
}): Promise<Result<{ taxStatus: string; tenantActivated: boolean }>> {
  return executeIsolatedUseCase('ReviewTaxDeclarationUseCase', async () => {
    const declaration = await params.prisma.taxDeclaration.findUnique({
      where: { id: params.taxDeclarationId },
    });

    if (!declaration) {
      return err(
        createDomainError({
          code: 'VALIDATION_ERROR',
          moduleName: 'ReviewTaxDeclarationUseCase',
          message: 'Declaración fiscal no encontrada.',
        }),
      );
    }

    const nextStatus = params.payload.decision === 'APPROVE' ? 'VALIDATED' : 'REJECTED';

    const outcome = await params.prisma.$transaction(async (tx) => {
      await tx.taxDeclaration.update({
        where: { id: declaration.id },
        data: {
          status: nextStatus,
          rejectionReason:
            nextStatus === 'REJECTED' ? (params.payload.reason ?? null) : null,
          reviewedByUserId: params.adminUserId,
          reviewedAt: new Date(),
        },
      });

      const latestVerifiedKyc = await tx.kycVerification.findFirst({
        where: { tenantId: declaration.tenantId, status: 'VERIFIED' },
      });

      const shouldActivateTenant =
        nextStatus === 'VALIDATED' && latestVerifiedKyc !== null;

      if (shouldActivateTenant) {
        await tx.tenant.update({
          where: { id: declaration.tenantId },
          data: { status: 'ACTIVE' },
        });
      }

      await tx.complianceAuditLog.create({
        data: {
          actorUserId: params.adminUserId,
          targetTenantId: declaration.tenantId,
          action: nextStatus === 'VALIDATED' ? 'TAX_VALIDATED' : 'TAX_REJECTED',
          entityType: 'TAX_DECLARATION',
          entityId: declaration.id,
          details: params.payload.reason ?? `TenantActivated=${shouldActivateTenant}`,
          ...(params.ip !== undefined ? { ip: params.ip } : {}),
        },
      });

      return { taxStatus: nextStatus, tenantActivated: shouldActivateTenant };
    });

    return ok(outcome);
  });
}
