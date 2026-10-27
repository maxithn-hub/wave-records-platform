export type DomainErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN_IDOR'
  | 'TENANT_SUSPENDED'
  | 'TAX_COMPLIANCE_REQUIRED'
  | 'INVALID_STATE_TRANSITION'
  | 'FORENSIC_REJECTED'
  | 'INTEGRITY_CHECK_FAILED'
  | 'EXTERNAL_PROVIDER_ERROR'
  | 'NETWORK_BOUNDARY_ERROR'
  | 'INTERNAL_MODULE_FAULT';

export interface DomainError {
  readonly code: DomainErrorCode;
  readonly message: string;
  readonly moduleName?: string;
  readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
  readonly traceId?: string;
  readonly timestamp: string;
}

export type Result<T, E = DomainError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E = DomainError>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function createDomainError(params: {
  code: DomainErrorCode;
  message: string;
  moduleName?: string;
  fieldErrors?: Readonly<Record<string, readonly string[]>>;
  traceId?: string;
}): DomainError {
  return {
    code: params.code,
    message: params.message,
    ...(params.moduleName !== undefined ? { moduleName: params.moduleName } : {}),
    ...(params.fieldErrors !== undefined ? { fieldErrors: params.fieldErrors } : {}),
    ...(params.traceId !== undefined ? { traceId: params.traceId } : {}),
    timestamp: new Date().toISOString(),
  };
}
