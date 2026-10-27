import { z } from 'zod';

export const KycStatusSchema = z.enum([
  'NOT_STARTED',
  'PENDING_REVIEW',
  'VERIFIED',
  'REJECTED',
]);
export type KycStatus = z.infer<typeof KycStatusSchema>;

export const KycDocumentTypeSchema = z.enum([
  'PASSPORT',
  'NATIONAL_ID',
  'DRIVERS_LICENSE',
  'ARTICLES_OF_INCORPORATION',
]);
export type KycDocumentType = z.infer<typeof KycDocumentTypeSchema>;

export const KycStatusSummarySchema = z.object({
  tenantId: z.string().uuid(),
  status: KycStatusSchema,
  documentType: KycDocumentTypeSchema.optional(),
  verifiedAt: z.string().datetime().nullable(),
  rejectionReason: z.string().max(500).nullable(),
});

export type KycStatusSummaryDto = z.infer<typeof KycStatusSummarySchema>;
