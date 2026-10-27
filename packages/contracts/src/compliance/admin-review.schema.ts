import { z } from 'zod';
import { TaxFormTypeSchema } from './tax-form.schema.js';
import { KycDocumentTypeSchema } from './kyc.schema.js';

export const ReviewDecisionPayloadSchema = z
  .object({
    decision: z.enum(['APPROVE', 'REJECT']),
    reason: z.string().trim().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.decision === 'REJECT' && (!data.reason || data.reason.length < 5)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: 'El motivo de rechazo es obligatorio (mínimo 5 caracteres)',
      });
    }
  });
export type ReviewDecisionPayload = z.infer<typeof ReviewDecisionPayloadSchema>;

export const ComplianceQueueItemSchema = z.object({
  kind: z.enum(['KYC', 'TAX']),
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  tenantDisplayName: z.string(),
  tenantCountryCode: z.string().length(2),
  tenantTier: z.enum(['INDIVIDUAL_LAUNCH', 'LABEL_GROWTH']),
  submittedAt: z.string().datetime(),
  documentType: KycDocumentTypeSchema.nullable(),
  formType: TaxFormTypeSchema.nullable(),
  maskedTaxId: z.string().nullable(),
  signerName: z.string().nullable(),
  formData: z.record(z.unknown()).nullable(),
  hasDocument: z.boolean(),
});
export type ComplianceQueueItem = z.infer<typeof ComplianceQueueItemSchema>;

export const ComplianceQueueDtoSchema = z.object({
  items: z.array(ComplianceQueueItemSchema),
});
export type ComplianceQueueDto = z.infer<typeof ComplianceQueueDtoSchema>;
