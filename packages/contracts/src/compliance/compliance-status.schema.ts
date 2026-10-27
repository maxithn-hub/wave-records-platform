import { z } from 'zod';
import { KycStatusSchema, KycDocumentTypeSchema } from './kyc.schema.js';
import { TaxDeclarationStatusSchema, TaxFormTypeSchema } from './tax-form.schema.js';

export const ComplianceStatusDtoSchema = z.object({
  tenantStatus: z.enum(['ONBOARDING', 'ACTIVE', 'RESTRICTED_COMPLIANCE', 'SUSPENDED_FRAUD']),
  requiredTaxForm: TaxFormTypeSchema,
  kyc: z.object({
    status: KycStatusSchema,
    documentType: KycDocumentTypeSchema.nullable(),
    submittedAt: z.string().datetime().nullable(),
    rejectionReason: z.string().nullable(),
  }),
  tax: z.object({
    status: TaxDeclarationStatusSchema,
    formType: TaxFormTypeSchema.nullable(),
    maskedTaxId: z.string().nullable(),
    submittedAt: z.string().datetime().nullable(),
    rejectionReason: z.string().nullable(),
  }),
  payoutEligible: z.boolean(),
  payoutBlockers: z.array(z.string()),
});
export type ComplianceStatusDto = z.infer<typeof ComplianceStatusDtoSchema>;
