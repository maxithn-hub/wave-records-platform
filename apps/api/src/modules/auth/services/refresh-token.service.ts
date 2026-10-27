import { createHmac, randomBytes, randomUUID } from 'node:crypto';

export interface GeneratedRefreshToken {
  readonly rawOpaqueToken: string;
  readonly tokenHashHex: string;
  readonly familyId: string;
  readonly expiresAt: Date;
}

export function hashRefreshToken(rawOpaqueToken: string, pepper: string): string {
  return createHmac('sha256', pepper).update(rawOpaqueToken).digest('hex');
}

export function generateOpaqueRefreshToken(params: {
  pepper: string;
  ttlDays: number;
  existingFamilyId?: string;
}): GeneratedRefreshToken {
  const rawOpaqueToken = randomBytes(48).toString('base64url');
  const tokenHashHex = hashRefreshToken(rawOpaqueToken, params.pepper);
  const familyId = params.existingFamilyId ?? randomUUID();
  const expiresAt = new Date(Date.now() + params.ttlDays * 24 * 60 * 60 * 1000);

  return {
    rawOpaqueToken,
    tokenHashHex,
    familyId,
    expiresAt,
  };
}
