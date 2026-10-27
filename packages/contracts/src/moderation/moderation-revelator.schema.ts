import { z } from 'zod';
import {
  ReleaseStatusSchema,
  AcrCloudVerdictTierSchema,
} from '../catalog/release-state-machine.schema.js';
import { TenantTierSchema } from '../tenants/tenant.schema.js';

export const ModerationDecisionActionSchema = z.enum([
  'APPROVE_AND_DISPATCH',
  'REJECT',
]);

export type ModerationDecisionAction = z.infer<typeof ModerationDecisionActionSchema>;

export const AdminReleaseDecisionInputSchema = z.object({
  decision: ModerationDecisionActionSchema,
  moderationNotes: z.string().trim().min(4).max(500),
});

export type AdminReleaseDecisionInput = z.infer<typeof AdminReleaseDecisionInputSchema>;

export const RevelatorDeliverySummarySchema = z.object({
  deliveryJobId: z.string().uuid(),
  releaseId: z.string().uuid(),
  releaseStatus: ReleaseStatusSchema,
  revelatorEnterpriseId: z.number().int(),
  revelatorUserId: z.string(),
  revelatorPlanType: z.string(),
  revelatorReleaseId: z.number().int().nullable(),
  unpromptedTokenCached: z.boolean(),
  ugcMonetizationBlocked: z.boolean(),
  ugcMonetizationPolicy: z.enum(['MONETIZE_ALL', 'BLOCKED_BEAT_LEASE_GREY_AREA']),
  dspTargets: z.array(z.string()),
  deliveryStatus: z.string(),
  attemptCount: z.number().int(),
  dispatchedAt: z.string().nullable(),
});

export type RevelatorDeliverySummary = z.infer<typeof RevelatorDeliverySummarySchema>;

export const ModerationQueueItemSchema = z.object({
  releaseId: z.string().uuid(),
  tenantId: z.string().uuid(),
  tenantDisplayName: z.string(),
  tenantLegalName: z.string(),
  tenantTier: TenantTierSchema,
  title: z.string(),
  primaryArtist: z.string(),
  releaseType: z.string(),
  primaryGenre: z.string(),
  upcCode: z.string().nullable(),
  status: ReleaseStatusSchema,
  blockUgcMonetization: z.boolean(),
  hasBeatLicensePdf: z.boolean(),
  moderationNotes: z.string().nullable(),
  revelatorReleaseId: z.number().int().nullable(),
  createdAt: z.string(),
  latestForensicReport: z
    .object({
      artworkPassed: z.boolean(),
      artworkWidthPx: z.number().int().nullable(),
      artworkHeightPx: z.number().int().nullable(),
      artworkColorSpace: z.string().nullable(),
      audioSignalPassed: z.boolean(),
      audioSilenceMaxRatio: z.number(),
      maxAcrCloudScore: z.number().int(),
      acrCloudVerdict: AcrCloudVerdictTierSchema,
      matchedTitle: z.string().nullable(),
      matchedArtist: z.string().nullable(),
      summaryReason: z.string(),
    })
    .nullable(),
  tracks: z.array(
    z.object({
      trackId: z.string().uuid(),
      trackNumber: z.number().int(),
      title: z.string(),
      isrcCode: z.string().nullable(),
      sampleRateHz: z.number().int().nullable(),
      bitDepth: z.number().int().nullable(),
      durationSeconds: z.number().int().nullable(),
      acrCloudScore: z.number().int().nullable(),
      acrCloudVerdict: z.string().nullable(),
    }),
  ),
  latestDeliveryJob: RevelatorDeliverySummarySchema.nullable(),
});

export type ModerationQueueItem = z.infer<typeof ModerationQueueItemSchema>;

export const BeatLicenseInspectionSummarySchema = z.object({
  releaseId: z.string().uuid(),
  documentKey: z.string(),
  decryptedByteLength: z.number().int(),
  sha256Hex: z.string().length(64),
  pdfMagicHeaderValid: z.boolean(),
  base64Preview: z.string(),
  inspectedAt: z.string(),
});

export type BeatLicenseInspectionSummary = z.infer<typeof BeatLicenseInspectionSummarySchema>;
