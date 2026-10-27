import { z } from 'zod';
import { isStructurallyValidEin, isStructurallyValidSsn } from './tin-validation.js';

export const TaxFormTypeSchema = z.enum(['W9', 'W8BEN', 'W8BENE']);
export type TaxFormType = z.infer<typeof TaxFormTypeSchema>;

export const TaxDeclarationStatusSchema = z.enum([
  'MISSING',
  'SUBMITTED_UNDER_REVIEW',
  'VALIDATED',
  'EXPIRED',
  'REJECTED',
]);
export type TaxDeclarationStatus = z.infer<typeof TaxDeclarationStatusSchema>;

const CountryCode = z.string().trim().length(2).toUpperCase();

export const SubmitW9PayloadSchema = z
  .object({
    formType: z.literal('W9'),
    taxpayerLegalName: z.string().trim().min(2).max(160),
    businessName: z.string().trim().max(160).optional(),
    federalTaxClassification: z.enum([
      'INDIVIDUAL_SOLE_PROPRIETOR',
      'C_CORPORATION',
      'S_CORPORATION',
      'PARTNERSHIP',
      'LLC',
    ]),
    tinType: z.enum(['SSN', 'EIN']),
    /** Raw TIN is only transmitted over TLS and immediately encrypted with AES-256-GCM in API */
    rawTinNumber: z
      .string()
      .transform((v) => v.replace(/[-\s]/g, ''))
      .pipe(z.string().regex(/^\d{9}$/, 'El TIN debe tener exactamente 9 dígitos')),
    addressLine1: z.string().trim().min(4).max(200),
    city: z.string().trim().min(2).max(100),
    stateCode: z.string().trim().length(2).toUpperCase(),
    zipCode: z.string().trim().regex(/^\d{5}(-\d{4})?$/, 'ZIP inválido'),
    certifyUnderPenaltyOfPerjury: z.literal(true),
    electronicSignatureName: z.string().trim().min(2).max(160),
  })
  .superRefine((data, ctx) => {
    const valid =
      data.tinType === 'SSN'
        ? isStructurallyValidSsn(data.rawTinNumber)
        : isStructurallyValidEin(data.rawTinNumber);
    if (!valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rawTinNumber'],
        message: `El ${data.tinType} no tiene una estructura válida según el IRS`,
      });
    }
  });

export const SubmitW8BenPayloadSchema = z
  .object({
    formType: z.literal('W8BEN'),
    beneficialOwnerName: z.string().trim().min(2).max(160),
    countryOfCitizenship: CountryCode,
    permanentResidenceAddress: z.string().trim().min(4).max(200),
    cityOrTown: z.string().trim().min(2).max(100),
    countryOfResidence: CountryCode.refine((c) => c !== 'US', {
      message: 'El W-8BEN es solo para no residentes de EE. UU.; las personas de EE. UU. deben presentar el W-9',
    }),
    /** Foreign Tax Identifying Number (encrypted at rest via AES-256-GCM) */
    rawForeignTaxId: z.string().trim().min(4).max(40),
    dateOfBirthIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    claimTaxTreatyBenefits: z.boolean(),
    treatyCountryCode: CountryCode.optional(),
    certifyNonUsPersonAndPerjury: z.literal(true),
    electronicSignatureName: z.string().trim().min(2).max(160),
  })
  .superRefine((data, ctx) => {
    if (data.claimTaxTreatyBenefits && !data.treatyCountryCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['treatyCountryCode'],
        message: 'Indica el país del tratado si reclamas beneficios',
      });
    }
  });

/** W-8BEN-E (foreign entities): metadata only; the signed official PDF is uploaded as multipart. */
export const SubmitW8BenEMetadataSchema = z.object({
  formType: z.literal('W8BENE'),
  entityLegalName: z.string().trim().min(2).max(160),
  countryOfIncorporation: CountryCode.refine((c) => c !== 'US', {
    message: 'Las entidades de EE. UU. deben presentar el W-9',
  }),
  electronicSignatureName: z.string().trim().min(2).max(160),
});

export type SubmitW9Payload = z.infer<typeof SubmitW9PayloadSchema>;
export type SubmitW8BenPayload = z.infer<typeof SubmitW8BenPayloadSchema>;
export type SubmitW8BenEMetadata = z.infer<typeof SubmitW8BenEMetadataSchema>;

/**
 * Decides which IRS form a tenant must file.
 * US persons/entities -> W-9. Foreign individuals -> W-8BEN. Foreign labels/entities -> W-8BEN-E.
 */
export function resolveRequiredTaxForm(params: {
  countryCode: string;
  tier: 'INDIVIDUAL_LAUNCH' | 'LABEL_GROWTH';
}): TaxFormType {
  if (params.countryCode.toUpperCase() === 'US') return 'W9';
  return params.tier === 'LABEL_GROWTH' ? 'W8BENE' : 'W8BEN';
}
