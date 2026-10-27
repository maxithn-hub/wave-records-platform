import { z } from 'zod';
import { ReleaseStatusSchema } from './release-state-machine.schema.js';

export const ReleaseTypeSchema = z.enum(['SINGLE', 'EP', 'ALBUM']);
export type ReleaseType = z.infer<typeof ReleaseTypeSchema>;

export const CreateReleaseDraftPayloadSchema = z.object({
  title: z.string().trim().min(1).max(200),
  versionTitle: z.string().trim().max(120).optional(),
  primaryArtist: z.string().trim().min(1).max(160),
  releaseType: ReleaseTypeSchema,
  primaryGenre: z.string().trim().min(2).max(80),
  releaseDateIso: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de lanzamiento debe tener formato YYYY-MM-DD')
    .optional(),
  pLineYear: z.number().int().min(1900).max(2100).default(2026),
  pLineOwner: z.string().trim().min(2).max(160),
  cLineYear: z.number().int().min(1900).max(2100).default(2026),
  cLineOwner: z.string().trim().min(2).max(160),
  upcCode: z.string().trim().optional(),
});
export type CreateReleaseDraftPayload = z.infer<typeof CreateReleaseDraftPayloadSchema>;

export const UpsertTrackMetadataPayloadSchema = z.object({
  trackNumber: z.number().int().min(1).max(99),
  title: z.string().trim().min(1).max(200),
  versionTitle: z.string().trim().max(120).optional(),
  primaryArtist: z.string().trim().min(1).max(160),
  isExplicit: z.boolean().default(false),
  isInstrumental: z.boolean().default(false),
  audioLanguage: z.string().trim().min(2).max(8).default('es'),
  isrcCode: z.string().trim().min(12).max(15),
});
export type UpsertTrackMetadataPayload = z.infer<typeof UpsertTrackMetadataPayloadSchema>;

export const CatalogTrackDtoSchema = z.object({
  id: z.string().uuid(),
  trackNumber: z.number().int(),
  title: z.string(),
  versionTitle: z.string().nullable(),
  primaryArtist: z.string(),
  isExplicit: z.boolean(),
  isInstrumental: z.boolean(),
  audioLanguage: z.string(),
  isrcCode: z.string().nullable(),
  wavQuarantineKey: z.string().nullable(),
  wavSha256Hash: z.string().nullable(),
  sampleRateHz: z.number().int().nullable(),
  bitDepth: z.number().int().nullable(),
  channels: z.number().int().nullable(),
  durationSeconds: z.number().int().nullable(),
});
export type CatalogTrackDto = z.infer<typeof CatalogTrackDtoSchema>;

export const CatalogReleaseDetailDtoSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  title: z.string(),
  versionTitle: z.string().nullable(),
  primaryArtist: z.string(),
  releaseType: ReleaseTypeSchema,
  primaryGenre: z.string(),
  releaseDateIso: z.string().nullable(),
  pLineYear: z.number().int(),
  pLineOwner: z.string(),
  cLineYear: z.number().int(),
  cLineOwner: z.string(),
  upcCode: z.string().nullable(),
  status: ReleaseStatusSchema,
  artworkQuarantineKey: z.string().nullable(),
  artworkSha256Hash: z.string().nullable(),
  artworkVerified: z.boolean(),
  isEditable: z.boolean(),
  tracks: z.array(CatalogTrackDtoSchema),
  createdAt: z.string().datetime(),
});
export type CatalogReleaseDetailDto = z.infer<typeof CatalogReleaseDetailDtoSchema>;
