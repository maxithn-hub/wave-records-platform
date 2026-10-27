import type { PrismaClient } from '@prisma/client';
import {
  type Result,
  type RoyaltyDashboardSummary,
  ok,
  err,
  createDomainError,
} from '@wave/contracts';
import { parseDecimal18_10, formatDecimal18_10 } from '@wave/domain-core';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';
import { evaluatePayoutEligibility } from '../../compliance/use-cases/evaluate-payout-eligibility.use-case.js';

export async function getRoyaltyDashboardUseCase(params: {
  prisma: PrismaClient;
  actorUserId: string;
  sessionTenantId: string;
}): Promise<Result<RoyaltyDashboardSummary>> {
  return executeIsolatedUseCase<RoyaltyDashboardSummary>(
    'GetRoyaltyDashboardUseCase',
    async () => {
      const tenant = await params.prisma.tenant.findUnique({
        where: { id: params.sessionTenantId },
        include: {
          kycVerifications: { orderBy: { createdAt: 'desc' }, take: 1 },
          taxDeclarations: { orderBy: { signedAt: 'desc' }, take: 1 },
        },
      });

      if (!tenant) {
        return err(
          createDomainError({
            code: 'UNAUTHORIZED',
            moduleName: 'GetRoyaltyDashboardUseCase',
            message: 'Tenant no encontrado.',
          }),
        );
      }

      const user = await params.prisma.user.findUnique({
        where: { id: params.actorUserId },
      });

      const eligibility = evaluatePayoutEligibility({
        tenantStatus: tenant.status,
        kycStatus: tenant.kycVerifications[0]?.status ?? 'NOT_STARTED',
        taxStatus: tenant.taxDeclarations[0]?.status ?? 'MISSING',
      });

      const ledgerEntries = await params.prisma.royaltyLedgerEntry.findMany({
        where: { tenantId: params.sessionTenantId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });

      const availableBalanceUsd = ledgerEntries[0]
        ? ledgerEntries[0].runningBalance.toFixed(10)
        : '0.0000000000';

      // Escrow held by tracks owned by this Tenant
      const heldByMyTracks = await params.prisma.escrowRoyaltyHold.findMany({
        where: {
          sourceTenantId: params.sessionTenantId,
          status: 'HELD_IN_ESCROW',
        },
      });
      let heldByMyTracksScaled = 0n;
      for (const h of heldByMyTracks) {
        const p = parseDecimal18_10(h.heldAmountUsd.toFixed(10));
        if (p.ok) heldByMyTracksScaled += p.value;
      }

      // Escrow claimable by this user's email
      const claimableByEmail = user
        ? await params.prisma.escrowRoyaltyHold.findMany({
            where: {
              collaboratorEmail: user.email.toLowerCase(),
              status: 'HELD_IN_ESCROW',
            },
          })
        : [];
      let claimableByEmailScaled = 0n;
      for (const c of claimableByEmail) {
        const p = parseDecimal18_10(c.heldAmountUsd.toFixed(10));
        if (p.ok) claimableByEmailScaled += p.value;
      }

      // DSP Breakdown
      const statements = await params.prisma.royaltyStatementIngest.findMany({
        where: { ownerTenantId: params.sessionTenantId },
      });
      const dspMap = new Map<
        string,
        { streamsCount: number; grossScaled: bigint; netScaled: bigint }
      >();

      for (const st of statements) {
        const current = dspMap.get(st.dspStore) ?? {
          streamsCount: 0,
          grossScaled: 0n,
          netScaled: 0n,
        };
        const g = parseDecimal18_10(st.grossRevenueUsd.toFixed(10));
        const n = parseDecimal18_10(st.netDistributableUsd.toFixed(10));
        current.streamsCount += st.streamsCount;
        if (g.ok) current.grossScaled += g.value;
        if (n.ok) current.netScaled += n.value;
        dspMap.set(st.dspStore, current);
      }

      const dspBreakdown = Array.from(dspMap.entries()).map(([dspStore, val]) => ({
        dspStore,
        streamsCount: val.streamsCount,
        grossRevenueUsd: formatDecimal18_10(val.grossScaled),
        netDistributableUsd: formatDecimal18_10(val.netScaled),
      }));

      const payoutRequests = await params.prisma.payoutRequest.findMany({
        where: { tenantId: params.sessionTenantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      return ok({
        availableBalanceUsd,
        totalEscrowHeldByMyTracksUsd: formatDecimal18_10(heldByMyTracksScaled),
        claimableEscrowByMyEmailUsd: formatDecimal18_10(claimableByEmailScaled),
        payoutEligible: eligibility.eligible,
        payoutBlockers: [...eligibility.blockers],
        dspBreakdown,
        recentLedgerEntries: ledgerEntries.map((e) => ({
          id: e.id,
          entryType: e.entryType,
          amountUsd: e.amountUsd.toFixed(10),
          runningBalance: e.runningBalance.toFixed(10),
          idempotencyKey: e.idempotencyKey,
          description: e.description,
          createdAt: e.createdAt.toISOString(),
        })),
        payoutRequests: payoutRequests.map((p) => ({
          id: p.id,
          requestedAmount: p.requestedAmount.toFixed(10),
          idempotencyKey: p.idempotencyKey,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
        })),
      });
    },
  );
}
