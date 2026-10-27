import { z } from 'zod';
import {
  AcrCloudVerdictTierSchema,
  ReleaseStatusSchema,
} from '../catalog/release-state-machine.schema.js';

export const ForensicScanReportDtoSchema = z.object({
  id: z.string().uuid(),
  releaseId: z.string().uuid(),
  artworkWidthPx: z.number().int().nullable(),
  artworkHeightPx: z.number().int().nullable(),
  artworkColorSpace: z.string().nullable(),
  artworkPassed: z.boolean(),
  audioSilenceMaxRatio: z.number(),
  audioSignalPassed: z.boolean(),
  maxAcrCloudScore: z.number().int().min(0).max(100),
  acrCloudVerdict: AcrCloudVerdictTierSchema,
  matchedTitle: z.string().nullable(),
  matchedArtist: z.string().nullable(),
  summaryReason: z.string(),
  resultingReleaseStatus: ReleaseStatusSchema,
  blockUgcMonetization: z.boolean(),
  hasUploadedLicensePdf: z.boolean(),
  createdAt: z.string().datetime(),
});
export type ForensicScanReportDto = z.infer<typeof ForensicScanReportDtoSchema>;

export const RunForensicPipelinePayloadSchema = z.object({
  /**
   * Optional simulated ACRCloud score (0-100) for sandbox/integration testing
   * when external ACRCloud credentials are not active.
   */
  simulatedAcrCloudScore: z.number().int().min(0).max(100).optional(),
  simulatedMatchedTitle: z.string().max(200).optional(),
  simulatedMatchedArtist: z.string().max(160).optional(),
});
export type RunForensicPipelinePayload = z.infer<typeof RunForensicPipelinePayloadSchema>;
