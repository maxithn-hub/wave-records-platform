import { z } from 'zod';

/**
 * Multi-Tenant Hierarchy mapped to Revelator Child Account tiers:
 * - INDIVIDUAL_LAUNCH -> Revelator "Launch" tier (Independent Artists / Producers)
 * - LABEL_GROWTH -> Revelator "Growth" tier (Record Labels / Sub-Distributors / Publishers)
 */
export const TenantTierSchema = z.enum(['INDIVIDUAL_LAUNCH', 'LABEL_GROWTH']);
export type TenantTier = z.infer<typeof TenantTierSchema>;

export const TenantStatusSchema = z.enum([
  'ONBOARDING',
  'ACTIVE',
  'RESTRICTED_COMPLIANCE',
  'SUSPENDED_FRAUD',
]);
export type TenantStatus = z.infer<typeof TenantStatusSchema>;

export const TenantSummarySchema = z.object({
  id: z.string().uuid(),
  legalName: z.string().min(2).max(160),
  displayName: z.string().min(2).max(100),
  tier: TenantTierSchema,
  status: TenantStatusSchema,
  countryCode: z.string().length(2).toUpperCase(),
  commissionRatePercent: z.string().regex(/^\d+(\.\d{1,10})?$/),
  createdAt: z.string().datetime(),
});

export type TenantSummaryDto = z.infer<typeof TenantSummarySchema>;
