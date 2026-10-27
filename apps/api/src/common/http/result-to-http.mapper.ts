import type { DomainErrorCode } from '@wave/contracts';

export function mapDomainErrorToHttpStatus(code: DomainErrorCode): number {
  switch (code) {
    case 'VALIDATION_ERROR':
      return 422;
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN_IDOR':
    case 'TENANT_SUSPENDED':
    case 'TAX_COMPLIANCE_REQUIRED':
      return 403;
    case 'INVALID_STATE_TRANSITION':
    case 'FORENSIC_REJECTED':
      return 409;
    case 'EXTERNAL_PROVIDER_ERROR':
      return 503;
    case 'INTEGRITY_CHECK_FAILED':
    case 'NETWORK_BOUNDARY_ERROR':
    case 'INTERNAL_MODULE_FAULT':
    default:
      return 500;
  }
}
