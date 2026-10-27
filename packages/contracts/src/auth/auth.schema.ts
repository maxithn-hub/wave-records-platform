import { z } from 'zod';
import { TenantTierSchema } from '../tenants/tenant.schema.js';

/** OWASP ASVS L2: min 12 chars, max 128, no composition rules beyond length. */
export const PasswordSchema = z
  .string()
  .min(12, 'La contraseña debe tener al menos 12 caracteres')
  .max(128, 'La contraseña no puede superar 128 caracteres');

export const EmailSchema = z.string().trim().toLowerCase().email('Email inválido').max(255);

export const RegisterTenantPayloadSchema = z.object({
  tier: TenantTierSchema,
  legalName: z.string().trim().min(2).max(160),
  displayName: z.string().trim().min(2).max(100),
  countryCode: z.string().trim().length(2).toUpperCase(),
  email: EmailSchema,
  password: PasswordSchema,
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'Debes aceptar los términos de servicio' }),
  }),
});
export type RegisterTenantPayload = z.infer<typeof RegisterTenantPayloadSchema>;

export const LoginPayloadSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(128),
});
export type LoginPayload = z.infer<typeof LoginPayloadSchema>;

export const UserRoleSchema = z.enum(['TENANT_OWNER', 'TENANT_MEMBER', 'WAVE_COMPLIANCE_ADMIN']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const SessionDtoSchema = z.object({
  accessToken: z.string().min(1),
  expiresInSeconds: z.number().int().positive(),
});
export type SessionDto = z.infer<typeof SessionDtoSchema>;

export const MeDtoSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  role: UserRoleSchema,
  tenant: z.object({
    id: z.string().uuid(),
    displayName: z.string(),
    legalName: z.string(),
    tier: TenantTierSchema,
    status: z.enum(['ONBOARDING', 'ACTIVE', 'RESTRICTED_COMPLIANCE', 'SUSPENDED_FRAUD']),
    countryCode: z.string().length(2),
  }),
});
export type MeDto = z.infer<typeof MeDtoSchema>;
