import type { PrismaClient } from '@prisma/client';
import { type Result, ok, err, createDomainError } from '@wave/contracts';
import { parseDecimal18_10, formatDecimal18_10 } from '@wave/domain-core';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';

export interface ClaimEscrowSplitsSummary {
  readonly activatedSplitsCount: number;
  readonly releasedEscrowHoldsCount: number;
  readonly totalReleasedUsd: string;
  readonly newRunningBalanceUsd: string;
}

/**
 * Allows an invited "Ghost Account" collaborator who has now registered in Wave Records LLC
 * to claim all pending SplitAgreements and release their accumulated EscrowRoyaltyHold funds
 * into their own RoyaltyLedgerEntry running balance with exact DECIMAL(18, 10) precision.
 */
export async function claimEscrowSplitsUseCase(params: {
  prisma: PrismaClient;
  actorUserId: string;
  sessionTenantId: string;
  ip?: string;
}): Promise<Result<ClaimEscrowSplitsSummary>> {
  return executeIsolatedUseCase<ClaimEscrowSplitsSummary>(
    'ClaimEscrowSplitsUseCase',
    async () => {
      const user = await params.prisma.user.findUnique({
        where: { id: params.actorUserId },
      });

      if (!user || user.tenantId !== params.sessionTenantId) {
        return err(
          createDomainError({
            code: 'FORBIDDEN_IDOR',
            moduleName: 'ClaimEscrowSplitsUseCase',
            message: 'Usuario inválido o no coincide con el Tenant en sesión.',
          }),
        );
      }

      const emailLower = user.email.toLowerCase();

      const summary = await params.prisma.$transaction(async (tx) => {
        const pendingSplits = await tx.splitAgreement.findMany({
          where: {
            collaboratorEmail: emailLower,
            status: 'PENDING_INVITATION_ESCROW',
          },
        });

        const now = new Date();
        for (const split of pendingSplits) {
          await tx.splitAgreement.update({
            where: { id: split.id },
            data: {
              collaboratorTenantId: params.sessionTenantId,
              status: 'ACCEPTED_ACTIVE',
              acceptedAt: now,
            },
          });
        }

        const pendingHolds = await tx.escrowRoyaltyHold.findMany({
          where: {
            collaboratorEmail: emailLower,
            status: 'HELD_IN_ESCROW',
          },
          orderBy: { createdAt: 'asc' },
        });

        const latestEntry = await tx.royaltyLedgerEntry.findFirst({
          where: { tenantId: params.sessionTenantId },
          orderBy: { createdAt: 'desc' },
        });
        const prevBalRes = latestEntry
          ? parseDecimal18_10(latestEntry.runningBalance.toFixed(10))
          : ok(0n);
        let runningScaled = prevBalRes.ok ? prevBalRes.value : 0n;
        let releasedSumScaled = 0n;

        for (const hold of pendingHolds) {
          const holdAmtRes = parseDecimal18_10(hold.heldAmountUsd.toFixed(10));
          const holdScaled = holdAmtRes.ok ? holdAmtRes.value : 0n;
          runningScaled += holdScaled;
          releasedSumScaled += holdScaled;

          await tx.escrowRoyaltyHold.update({
            where: { id: hold.id },
            data: {
              status: 'RELEASED_TO_TENANT',
              claimedByTenantId: params.sessionTenantId,
              releasedAt: now,
            },
          });

          await tx.royaltyLedgerEntry.create({
            data: {
              tenantId: params.sessionTenantId,
              entryType: 'ESCROW_SPLIT_RELEASE',
              amountUsd: formatDecimal18_10(holdScaled),
              runningBalance: formatDecimal18_10(runningScaled),
              idempotencyKey: `escrow-release:${hold.id}`,
              referenceId: hold.id,
              description: `Liberación de fondos en Escrow por Split reclamado (${emailLower})`,
            },
          });
        }

        if (pendingSplits.length > 0 || pendingHolds.length > 0) {
          await tx.complianceAuditLog.create({
            data: {
              actorUserId: params.actorUserId,
              targetTenantId: params.sessionTenantId,
              action: 'ESCROW_SPLITS_CLAIMED_AND_RELEASED',
              entityType: 'TENANT',
              entityId: params.sessionTenantId,
              details: `Email=${emailLower} Splits=${pendingSplits.length} ReleasedUSD=${formatDecimal18_10(releasedSumScaled)}`,
              ...(params.ip !== undefined ? { ip: params.ip } : {}),
            },
          });
        }

        return {
          activatedSplitsCount: pendingSplits.length,
          releasedEscrowHoldsCount: pendingHolds.length,
          totalReleasedUsd: formatDecimal18_10(releasedSumScaled),
          newRunningBalanceUsd: formatDecimal18_10(runningScaled),
        };
      });

      return ok(summary);
    },
  );
}
