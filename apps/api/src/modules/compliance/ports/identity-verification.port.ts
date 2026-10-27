import type { KycDocumentType, KycStatus, Result } from '@wave/contracts';

export interface IdentityVerificationSubmissionResult {
  readonly nextStatus: KycStatus;
  readonly providerReference: string;
}

/**
 * Decoupled KYC Port:
 * Allows switching from Manual Admin Review (Phase 1) to Persona / Sumsub / Stripe Identity
 * without modifying any controller or use-case.
 */
export interface IdentityVerificationPort {
  registerDocumentSubmission(params: {
    tenantId: string;
    documentType: KycDocumentType;
    objectKey: string;
  }): Promise<Result<IdentityVerificationSubmissionResult>>;
}
