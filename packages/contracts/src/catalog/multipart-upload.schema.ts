import { z } from 'zod';

export const QuarantineAssetKindSchema = z.enum(['TRACK_WAV', 'RELEASE_ARTWORK']);
export type QuarantineAssetKind = z.infer<typeof QuarantineAssetKindSchema>;

export const InitMultipartUploadPayloadSchema = z.object({
  releaseId: z.string().uuid(),
  trackId: z.string().uuid().optional(),
  assetKind: QuarantineAssetKindSchema,
  fileName: z.string().trim().min(3).max(255),
  expectedByteSize: z.number().int().positive().max(1_500_000_000), // Up to 1.5 GB WAV
  expectedSha256Hex: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[0-9a-f]{64}$/, 'Se requiere hash SHA-256 hexadecimal de 64 caracteres'),
  totalParts: z.number().int().min(1).max(500),
});
export type InitMultipartUploadPayload = z.infer<typeof InitMultipartUploadPayloadSchema>;

export const InitMultipartUploadResponseSchema = z.object({
  uploadSessionId: z.string().uuid(),
  recommendedChunkBytes: z.number().int().positive(),
  totalParts: z.number().int().positive(),
});
export type InitMultipartUploadResponse = z.infer<typeof InitMultipartUploadResponseSchema>;
