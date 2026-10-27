import type { FastifyRequest } from 'fastify';
import { type Result, ok, err, createDomainError } from '@wave/contracts';
import { verifyJwtAccessToken } from '../modules/auth/services/access-token.service.js';
import {
  enforceTenantIsolation,
  type AuthenticatedSessionContext,
} from '../common/guards/tenant-isolation.guard.js';

export function authenticateAndEnforceTenantScope(params: {
  request: FastifyRequest;
  jwtSecret: string;
  targetResourceTenantId?: string;
}): Result<AuthenticatedSessionContext> {
  const authHeader = params.request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return err(
      createDomainError({
        code: 'UNAUTHORIZED',
        moduleName: 'RequestSessionExtractor',
        message: 'Token de autorización Bearer ausente.',
      }),
    );
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const claimsRes = verifyJwtAccessToken(token, params.jwtSecret);
  if (!claimsRes.ok) {
    return claimsRes;
  }

  const session: AuthenticatedSessionContext = {
    userId: claimsRes.value.sub,
    sessionTenantId: claimsRes.value.tid,
    role: claimsRes.value.role,
  };

  const combinedClientBag: Record<string, unknown> = {
    ...(params.request.headers as Record<string, unknown>),
    ...((params.request.query as Record<string, unknown>) ?? {}),
    ...(typeof params.request.body === 'object' && params.request.body !== null
      ? (params.request.body as Record<string, unknown>)
      : {}),
  };

  const isolationCheck = enforceTenantIsolation({
    session,
    targetResourceTenantId: params.targetResourceTenantId ?? session.sessionTenantId,
    clientSuppliedHeadersOrQuery: combinedClientBag,
  });

  if (!isolationCheck.ok) {
    return isolationCheck;
  }

  return ok(session);
}
