import { z } from 'zod';

export const SplitShareStatusSchema = z.enum([
  'PENDING_INVITATION_ESCROW',
  'ACCEPTED_ACTIVE',
  'REVOKED',
]);

export type SplitShareStatus = z.infer<typeof SplitShareStatusSchema>;

export const ConfigureTrackSplitsInputSchema = z.object({
  splits: z
    .array(
      z.object({
        collaboratorEmail: z.string().trim().email().max(255),
        sharePercentage: z
          .string()
          .trim()
          .regex(/^\d+(\.\d{1,10})?$/, 'Debe ser un porcentaje DECIMAL(18, 10) válido'),
      }),
    )
    .min(1)
    .max(25),
});

export type ConfigureTrackSplitsInput = z.infer<typeof ConfigureTrackSplitsInputSchema>;

export const SplitAgreementDtoSchema = z.object({
  id: z.string().uuid(),
  trackId: z.string().uuid(),
  collaboratorEmail: z.string().email(),
  collaboratorTenantId: z.string().uuid().nullable(),
  sharePercentage: z.string(),
  status: SplitShareStatusSchema,
  acceptedAt: z.string().nullable(),
});

export type SplitAgreementDto = z.infer<typeof SplitAgreementDtoSchema>;

export const IngestRoyaltyStatementInputSchema = z.object({
  idempotencyKey: z.string().trim().min(6).max(128),
  trackId: z.string().uuid(),
  dspStore: z.string().trim().min(2).max(40),
  countryCode: z.string().trim().length(2),
  streamsCount: z.number().int().min(1),
  grossRevenueUsd: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,10})?$/, 'Monto bruto debe cumplir formato DECIMAL(18, 10)'),
});

export type IngestRoyaltyStatementInput = z.infer<typeof IngestRoyaltyStatementInputSchema>;

export const RoyaltyStatementAllocationResultSchema = z.object({
  statementId: z.string().uuid(),
  idempotencyKey: z.string(),
  idempotentReplay: z.boolean(),
  grossRevenueUsd: z.string(),
  waveCommissionUsd: z.string(),
  netDistributableUsd: z.string(),
  creditedActiveSharesCount: z.number().int(),
  heldInEscrowSharesCount: z.number().int(),
  totalHeldInEscrowUsd: z.string(),
});

export type RoyaltyStatementAllocationResult = z.infer<
  typeof RoyaltyStatementAllocationResultSchema
>;

export const RequestPayoutInputSchema = z.object({
  idempotencyKey: z.string().trim().min(6).max(128),
  requestedAmountUsd: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,10})?$/, 'El monto solicitado debe cumplir formato DECIMAL(18, 10)'),
});

export type RequestPayoutInput = z.infer<typeof RequestPayoutInputSchema>;

export const PayoutRequestDtoSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  requestedAmount: z.string(),
  idempotencyKey: z.string(),
  status: z.string(),
  idempotentReplay: z.boolean(),
  remainingBalanceUsd: z.string(),
  createdAt: z.string(),
});

export type PayoutRequestDto = z.infer<typeof PayoutRequestDtoSchema>;

export const RoyaltyDashboardSummarySchema = z.object({
  availableBalanceUsd: z.string(),
  totalEscrowHeldByMyTracksUsd: z.string(),
  claimableEscrowByMyEmailUsd: z.string(),
  payoutEligible: z.boolean(),
  payoutBlockers: z.array(z.string()),
  dspBreakdown: z.array(
    z.object({
      dspStore: z.string(),
      streamsCount: z.number().int(),
      grossRevenueUsd: z.string(),
      netDistributableUsd: z.string(),
    }),
  ),
  recentLedgerEntries: z.array(
    z.object({
      id: z.string().uuid(),
      entryType: z.string(),
      amountUsd: z.string(),
      runningBalance: z.string(),
      idempotencyKey: z.string(),
      description: z.string(),
      createdAt: z.string(),
    }),
  ),
  payoutRequests: z.array(
    z.object({
      id: z.string().uuid(),
      requestedAmount: z.string(),
      idempotencyKey: z.string(),
      status: z.string(),
      createdAt: z.string(),
    }),
  ),
});

export type RoyaltyDashboardSummary = z.infer<typeof RoyaltyDashboardSummarySchema>;
