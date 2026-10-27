import { ok, type KycDocumentType, type Result } from '@wave/contracts';
import type {
  IdentityVerificationPort,
  IdentityVerificationSubmissionResult,
} from '../ports/identity-verification.port.js';

export class ManualReviewKycAdapter implements IdentityVerificationPort {
  public async registerDocumentSubmission(params: {
    tenantId: string;
    documentType: KycDocumentType;
    objectKey: string;
  }): Promise<Result<IdentityVerificationSubmissionResult>> {
    return ok({
      nextStatus: 'PENDING_REVIEW',
      providerReference: `manual:${params.tenantId}:${params.documentType}`,
    });
  }
}
