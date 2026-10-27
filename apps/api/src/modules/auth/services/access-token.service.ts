import { createHmac, timingSafeEqual } from 'node:crypto';
import { type Result, ok, err, createDomainError, type UserRole } from '@wave/contracts';

export interface AccessTokenClaims {
  readonly sub: string; // userId
  readonly tid: string; // sessionTenantId
  readonly role: UserRole;
  readonly iat: number;
  readonly exp: number;
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64url');
}

export function signJwtAccessToken(params: {
  userId: string;
  tenantId: string;
  role: UserRole;
  secret: string;
  ttlSeconds: number;
}): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: params.userId,
      tid: params.tenantId,
      role: params.role,
      iat: nowSec,
      exp: nowSec + params.ttlSeconds,
    } satisfies AccessTokenClaims),
  );
  const signingInput = `${header}.${payload}`;
  const signature = createHmac('sha256', params.secret)
    .update(signingInput)
    .digest('base64url');

  return `${signingInput}.${signature}`;
}

export function verifyJwtAccessToken(
  token: string,
  secret: string,
): Result<AccessTokenClaims> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return err(
        createDomainError({
          code: 'UNAUTHORIZED',
          moduleName: 'AccessTokenService',
          message: 'Formato de token de acceso inválido.',
        }),
      );
    }

    const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];
    const signingInput = `${headerB64}.${payloadB64}`;
    const expectedSig = createHmac('sha256', secret).update(signingInput).digest();
    const actualSig = Buffer.from(signatureB64, 'base64url');

    if (
      expectedSig.byteLength !== actualSig.byteLength ||
      !timingSafeEqual(expectedSig, actualSig)
    ) {
      return err(
        createDomainError({
          code: 'UNAUTHORIZED',
          moduleName: 'AccessTokenService',
          message: 'Firma de token de acceso inválida.',
        }),
      );
    }

    const claims = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8'),
    ) as AccessTokenClaims;

    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof claims.exp !== 'number' || claims.exp <= nowSec) {
      return err(
        createDomainError({
          code: 'UNAUTHORIZED',
          moduleName: 'AccessTokenService',
          message: 'El token de acceso ha expirado.',
        }),
      );
    }

    return ok(claims);
  } catch {
    return err(
      createDomainError({
        code: 'UNAUTHORIZED',
        moduleName: 'AccessTokenService',
        message: 'No se pudo verificar el token de acceso.',
      }),
    );
  }
}
