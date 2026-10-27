import { type Result, ok, err, createDomainError } from '@wave/contracts';

export interface AuthenticatedSessionContext {
  readonly userId: string;
  readonly sessionTenantId: string;
  readonly role: 'TENANT_OWNER' | 'TENANT_MEMBER' | 'WAVE_COMPLIANCE_ADMIN';
}

/**
 * Anti-IDOR Guard Logic:
 * Strictly prevents a user authenticated under Tenant A from querying or mutating
 * resources belonging to Tenant B, and blocks any client attempt to pass a raw
 * Revelator Enterprise ID.
 */
export function enforceTenantIsolation(params: {
  session: AuthenticatedSessionContext;
  targetResourceTenantId: string;
  clientSuppliedHeadersOrQuery?: Readonly<Record<string, unknown>>;
}): Result<{ authorizedTenantId: string }> {
  // 1. Reject any request attempting to inject Revelator credentials or child IDs from client
  if (params.clientSuppliedHeadersOrQuery) {
    const forbiddenKeys = [
      'revelatorenterpriseid',
      'revelatoruserid',
      'revelatorapikey',
      'x-revelator-token',
    ];
    for (const key of Object.keys(params.clientSuppliedHeadersOrQuery)) {
      if (forbiddenKeys.includes(key.toLowerCase())) {
        return err(
          createDomainError({
            code: 'FORBIDDEN_IDOR',
            moduleName: 'TenantIsolationGuard',
            message: `Intento bloqueado de inyectar parámetro reservado de proveedor (${key}).`,
          }),
        );
      }
    }
  }

  // 2. Wave Compliance Admins can inspect cross-tenant resources for moderation
  if (params.session.role === 'WAVE_COMPLIANCE_ADMIN') {
    return ok({ authorizedTenantId: params.targetResourceTenantId });
  }

  // 3. Strict tenant match for standard B2B/B2C tenants
  if (params.session.sessionTenantId !== params.targetResourceTenantId) {
    return err(
      createDomainError({
        code: 'FORBIDDEN_IDOR',
        moduleName: 'TenantIsolationGuard',
        message: 'Acceso denegado (Protección Anti-IDOR): El recurso pertenece a otro Tenant.',
      }),
    );
  }

  return ok({ authorizedTenantId: params.session.sessionTenantId });
}
