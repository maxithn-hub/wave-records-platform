import type { PrismaClient } from '@prisma/client';
import {
  type Result,
  type RequestPayoutInput,
  type PayoutRequestDto,
  ok,
  err,
  createDomainError,
} from '@wave/contracts';
import { parseDecimal18_10, formatDecimal18_10 } from '@wave/domain-core';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';
import { evaluatePayoutEligibility } from '../../compliance/use-cases/evaluate-payout-eligibility.use-case.js';

/**
 * Processes a Tenant's Royalty Payout Withdrawal Request:
 * 1. Enforces strict idempotency via `idempotencyKey` (prevents double-withdrawal on retry).
 * 2. Enforces Compliance Gate (`evaluatePayoutEligibility`): blocks withdrawal (`403 TAX_COMPLIANCE_REQUIRED`)
 *    unless KYC is `VERIFIED`, IRS Tax Form (`W-9` / `W-8BEN` / `W-8BEN-E`) is `VALIDATED`, and Tenant is `ACTIVE`.
 * 3. Verifies sufficient balance in `DECIMAL(18, 10)` fixed-point math and appends an immutable
 *    `PAYOUT_WITHDRAWAL_DEBIT` ledger entry.
 */
export async function requestRoyaltyPayoutUseCase(params: {
  prisma: PrismaClient;
  actorUserId: string;
  sessionTenantId: string;
  input: RequestPayoutInput;
  ip?: string;
}): Promise<Result<PayoutRequestDto>> {
  return executeIsolatedUseCase<PayoutRequestDto>(
    'RequestRoyaltyPayoutUseCase',
    async () => {
      // 1. Check Idempotency-Key first
      const existingPayout = await params.prisma.payoutRequest.findUnique({
        where: { idempotencyKey: params.input.idempotencyKey },
      });

      if (existingPayout) {
        if (existingPayout.tenantId !== params.sessionTenantId) {
          return err(
            createDomainError({
              code: 'FORBIDDEN_IDOR',
              moduleName: 'RequestRoyaltyPayoutUseCase',
              message: 'La llave de idempotencia pertenece a otro Tenant.',
            }),
          );
        }

        const latestLedger = await params.prisma.royaltyLedgerEntry.findFirst({
          where: { tenantId: params.sessionTenantId },
          orderBy: { createdAt: 'desc' },
        });

        return ok({
          id: existingPayout.id,
          tenantId: existingPayout.tenantId,
          requestedAmount: existingPayout.requestedAmount.toFixed(10),
          idempotencyKey: existingPayout.idempotencyKey,
          status: existingPayout.status,
          idempotentReplay: true,
          remainingBalanceUsd: latestLedger
            ? latestLedger.runningBalance.toFixed(10)
            : '0.0000000000',
          createdAt: existingPayout.createdAt.toISOString(),
        });
      }

      // 2. Evaluate KYC + IRS Tax Compliance Gate
      const tenant = await params.prisma.tenant.findUnique({
        where: { id: params.sessionTenantId },
        include: {
          kycVerifications: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          taxDeclarations: {
            orderBy: { signedAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!tenant) {
        return err(
          createDomainError({
            code: 'UNAUTHORIZED',
            moduleName: 'RequestRoyaltyPayoutUseCase',
            message: 'Tenant no encontrado.',
          }),
        );
      }

      const kycStatus = tenant.kycVerifications[0]?.status ?? 'NOT_STARTED';
      const taxStatus = tenant.taxDeclarations[0]?.status ?? 'MISSING';
      const eligibility = evaluatePayoutEligibility({
        tenantStatus: tenant.status,
        kycStatus,
        taxStatus,
      });

      if (!eligibility.eligible) {
        return err(
          createDomainError({
            code: 'TAX_COMPLIANCE_REQUIRED',
            moduleName: 'RequestRoyaltyPayoutUseCase',
            message: `Retiro de regalías bloqueado por cumplimiento legal/fiscal: ${eligibility.blockers.join(' | ')}`,
          }),
        );
      }

      // 3. Parse requested amount in DECIMAL(18, 10)
      const reqAmountRes = parseDecimal18_10(params.input.requestedAmountUsd);
      if (!reqAmountRes.ok) {
        return reqAmountRes;
      }
      if (reqAmountRes.value <= 0n) {
        return err(
          createDomainError({
            code: 'VALIDATION_ERROR',
            moduleName: 'RequestRoyaltyPayoutUseCase',
            message: 'El monto de retiro debe ser estrictamente mayor a 0.0000000000 USD.',
          }),
        );
      }

      // 4. Execute atomic balance check + ledger debit + payout creation
      const latestEntry = await params.prisma.royaltyLedgerEntry.findFirst({
        where: { tenantId: params.sessionTenantId },
        orderBy: { createdAt: 'desc' },
      });

      const currentBalRes = latestEntry
        ? parseDecimal18_10(latestEntry.runningBalance.toFixed(10))
        : ok(0n);
      const currentBalScaled = currentBalRes.ok ? currentBalRes.value : 0n;

      if (reqAmountRes.value > currentBalScaled) {
        return err(
          createDomainError({
            code: 'VALIDATION_ERROR',
            moduleName: 'RequestRoyaltyPayoutUseCase',
            message: `Fondos insuficientes en el Libro Mayor: saldo disponible ${formatDecimal18_10(currentBalScaled)} USD, solicitado ${formatDecimal18_10(reqAmountRes.value)} USD.`,
          }),
        );
      }

      const nextBalScaled = currentBalScaled - reqAmountRes.value;
      const formattedRequested = formatDecimal18_10(reqAmountRes.value);
      const formattedRemaining = formatDecimal18_10(nextBalScaled);

      const createdPayout = await params.prisma.$transaction(async (tx) => {
        const payout = await tx.payoutRequest.create({
          data: {
            tenantId: params.sessionTenantId,
            requestedAmount: formattedRequested,
            idempotencyKey: params.input.idempotencyKey,
            status: 'APPROVED_QUEUED_FOR_WIRE',
          },
        });

        await tx.royaltyLedgerEntry.create({
          data: {
            tenantId: params.sessionTenantId,
            entryType: 'PAYOUT_WITHDRAWAL_DEBIT',
            amountUsd: `-${formattedRequested}`,
            runningBalance: formattedRemaining,
            idempotencyKey: `payout-debit:${params.input.idempotencyKey}`,
            referenceId: payout.id,
            description: `Retiro de regalías aprobado (${formattedRequested} USD)`,
          },
        });

        await tx.complianceAuditLog.create({
          data: {
            actorUserId: params.actorUserId,
            targetTenantId: params.sessionTenantId,
            action: 'ROYALTY_PAYOUT_REQUESTED',
            entityType: 'PAYOUT',
            entityId: payout.id,
            details: `Requested=${formattedRequested} Remaining=${formattedRemaining} IdempotencyKey=${params.input.idempotencyKey}`,
            ...(params.ip !== undefined ? { ip: params.ip } : {}),
          },
        });

        return payout;
      });

      return ok({
        id: createdPayout.id,
        tenantId: createdPayout.tenantId,
        requestedAmount: createdPayout.requestedAmount.toFixed(10),
        idempotencyKey: createdPayout.idempotencyKey,
        status: createdPayout.status,
        idempotentReplay: false,
        remainingBalanceUsd: formattedRemaining,
        createdAt: createdPayout.createdAt.toISOString(),
      });
    },
  );
}
