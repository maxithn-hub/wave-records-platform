import type { PrismaClient } from '@prisma/client';
import {
  type Result,
  type IngestRoyaltyStatementInput,
  type RoyaltyStatementAllocationResult,
  ok,
  err,
  createDomainError,
} from '@wave/contracts';
import {
  parseDecimal18_10,
  formatDecimal18_10,
  computeRoyaltyNetDistribution,
  computeTrackSplitAllocations,
} from '@wave/domain-core';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';

/**
 * Ingests a DSP Royalty Statement line item in DECIMAL(18, 10) fixed-point precision:
 * - Enforces strict idempotency via `idempotencyKey`.
 * - Deducts Wave Records LLC commission (`commissionRatePercent`).
 * - Credits active Tenant participants directly in `RoyaltyLedgerEntry`.
 * - Holds unregistered "Ghost Account" collaborator shares in `EscrowRoyaltyHold`.
 */
export async function ingestRoyaltyStatementUseCase(params: {
  prisma: PrismaClient;
  input: IngestRoyaltyStatementInput;
}): Promise<Result<RoyaltyStatementAllocationResult>> {
  return executeIsolatedUseCase<RoyaltyStatementAllocationResult>(
    'IngestRoyaltyStatementUseCase',
    async () => {
      // 1. Check Idempotency-Key first
      const existingStatement =
        await params.prisma.royaltyStatementIngest.findUnique({
          where: { idempotencyKey: params.input.idempotencyKey },
        });

      if (existingStatement) {
        const existingEscrows = await params.prisma.escrowRoyaltyHold.findMany({
          where: {
            statementIdempotencyKey: {
              startsWith: `${params.input.idempotencyKey}:escrow:`,
            },
          },
        });

        let escrowSumScaled = 0n;
        for (const hold of existingEscrows) {
          const parsed = parseDecimal18_10(hold.heldAmountUsd.toFixed(10));
          if (parsed.ok) escrowSumScaled += parsed.value;
        }

        return ok({
          statementId: existingStatement.id,
          idempotencyKey: existingStatement.idempotencyKey,
          idempotentReplay: true,
          grossRevenueUsd: existingStatement.grossRevenueUsd.toFixed(10),
          waveCommissionUsd: existingStatement.waveCommissionUsd.toFixed(10),
          netDistributableUsd: existingStatement.netDistributableUsd.toFixed(10),
          creditedActiveSharesCount: 1,
          heldInEscrowSharesCount: existingEscrows.length,
          totalHeldInEscrowUsd: formatDecimal18_10(escrowSumScaled),
        });
      }

      const track = await params.prisma.track.findUnique({
        where: { id: params.input.trackId },
        include: {
          release: {
            include: { tenant: true },
          },
          splits: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!track) {
        return err(
          createDomainError({
            code: 'VALIDATION_ERROR',
            moduleName: 'IngestRoyaltyStatementUseCase',
            message: 'El track indicado para la liquidación de regalías no existe.',
          }),
        );
      }

      const ownerTenant = track.release.tenant;
      const distRes = computeRoyaltyNetDistribution({
        grossRevenueStr: params.input.grossRevenueUsd,
        waveCommissionPercentStr: ownerTenant.commissionRatePercent.toFixed(10),
      });
      if (!distRes.ok) {
        return distRes;
      }

      const effectiveSplits =
        track.splits.length > 0
          ? track.splits.map((s) => ({
              splitId: s.id,
              collaboratorEmail: s.collaboratorEmail,
              collaboratorTenantId: s.collaboratorTenantId,
              sharePercentageStr: s.sharePercentage.toFixed(10),
              isActiveTenantShare:
                s.status === 'ACCEPTED_ACTIVE' && s.collaboratorTenantId !== null,
            }))
          : [
              {
                splitId: 'owner-default-100',
                collaboratorEmail: 'owner@tenant.local',
                collaboratorTenantId: ownerTenant.id,
                sharePercentageStr: '100.0000000000',
                isActiveTenantShare: true,
              },
            ];

      const allocRes = computeTrackSplitAllocations({
        netDistributableScaled: distRes.value.netDistributableScaled,
        splits: effectiveSplits,
      });
      if (!allocRes.ok) {
        return allocRes;
      }

      const result = await params.prisma.$transaction(async (tx) => {
        const statement = await tx.royaltyStatementIngest.create({
          data: {
            idempotencyKey: params.input.idempotencyKey,
            trackId: track.id,
            releaseId: track.releaseId,
            ownerTenantId: ownerTenant.id,
            dspStore: params.input.dspStore.toUpperCase(),
            countryCode: params.input.countryCode.toUpperCase(),
            streamsCount: params.input.streamsCount,
            grossRevenueUsd: distRes.value.grossFormatted,
            waveCommissionUsd: distRes.value.commissionFormatted,
            netDistributableUsd: distRes.value.netDistributableFormatted,
          },
        });

        let creditedActiveSharesCount = 0;
        let heldInEscrowSharesCount = 0;
        let totalHeldInEscrowScaled = 0n;

        for (let idx = 0; idx < allocRes.value.length; idx++) {
          const share = allocRes.value[idx]!;
          if (share.isActiveTenantShare && share.collaboratorTenantId) {
            const latestEntry = await tx.royaltyLedgerEntry.findFirst({
              where: { tenantId: share.collaboratorTenantId },
              orderBy: { createdAt: 'desc' },
            });
            const prevBalRes = latestEntry
              ? parseDecimal18_10(latestEntry.runningBalance.toFixed(10))
              : ok(0n);
            const prevBalScaled = prevBalRes.ok ? prevBalRes.value : 0n;
            const nextBalScaled = prevBalScaled + share.allocatedScaled;

            await tx.royaltyLedgerEntry.create({
              data: {
                tenantId: share.collaboratorTenantId,
                entryType: 'DSP_ROYALTY_CREDIT',
                amountUsd: share.allocatedFormatted,
                runningBalance: formatDecimal18_10(nextBalScaled),
                idempotencyKey: `${params.input.idempotencyKey}:credit:${idx}`,
                referenceId: statement.id,
                description: `Regalías ${params.input.dspStore.toUpperCase()} (${params.input.streamsCount} streams) - Track: ${track.title}`,
              },
            });
            creditedActiveSharesCount += 1;
          } else {
            // Ghost Account / Unregistered Collaborator -> Hold in Escrow!
            await tx.escrowRoyaltyHold.create({
              data: {
                splitAgreementId: share.splitId,
                trackId: track.id,
                sourceTenantId: ownerTenant.id,
                collaboratorEmail: share.collaboratorEmail,
                heldAmountUsd: share.allocatedFormatted,
                statementIdempotencyKey: `${params.input.idempotencyKey}:escrow:${idx}`,
                status: 'HELD_IN_ESCROW',
              },
            });

            heldInEscrowSharesCount += 1;
            totalHeldInEscrowScaled += share.allocatedScaled;
          }
        }

        return {
          statementId: statement.id,
          idempotencyKey: statement.idempotencyKey,
          idempotentReplay: false,
          grossRevenueUsd: distRes.value.grossFormatted,
          waveCommissionUsd: distRes.value.commissionFormatted,
          netDistributableUsd: distRes.value.netDistributableFormatted,
          creditedActiveSharesCount,
          heldInEscrowSharesCount,
          totalHeldInEscrowUsd: formatDecimal18_10(totalHeldInEscrowScaled),
        };
      });

      return ok(result);
    },
  );
}
