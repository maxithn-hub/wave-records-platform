import { z } from 'zod';

export const ReleaseStatusValues = [
  'DRAFT',
  'UPLOADING_ASSETS',
  'FORENSIC_PROCESSING',
  'MANUAL_COPYRIGHT_REVIEW',
  'MODERATION_QUEUE',
  'APPROVED_FOR_DELIVERY',
  'DISPATCHING_TO_REVELATOR',
  'LIVE_ON_DSPS',
  'REJECTED',
  'TAKEDOWN_REQUESTED',
] as const;

export const ReleaseStatusSchema = z.enum(ReleaseStatusValues);
export type ReleaseStatus = z.infer<typeof ReleaseStatusSchema>;

export const AcrCloudVerdictTierSchema = z.enum([
  'CLEAN_PASS',           // Score < 45% or code 1001
  'GREY_AREA_MANUAL_UGC_BLOCK', // Score 45% - 79% (Requires PDF license + blocks YouTube CID/TikTok/Meta)
  'HARD_REJECT_COPYRIGHT',      // Score >= 80%
]);
export type AcrCloudVerdictTier = z.infer<typeof AcrCloudVerdictTierSchema>;
