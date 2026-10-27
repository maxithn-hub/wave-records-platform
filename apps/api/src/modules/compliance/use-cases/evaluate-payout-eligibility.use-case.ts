import type { KycStatus, TaxDeclarationStatus, TenantStatus } from '@wave/contracts';

export interface PayoutEligibilityEvaluation {
  readonly eligible: boolean;
  readonly blockers: readonly string[];
}

/**
 * Pure compliance gatekeeper:
 * Blocks royalty withdrawals unless KYC is VERIFIED, Tax form is VALIDATED,
 * and Tenant status is ACTIVE.
 */
export function evaluatePayoutEligibility(params: {
  tenantStatus: TenantStatus;
  kycStatus: KycStatus;
  taxStatus: TaxDeclarationStatus;
}): PayoutEligibilityEvaluation {
  const blockers: string[] = [];

  if (params.tenantStatus === 'SUSPENDED_FRAUD') {
    blockers.push('La cuenta está suspendida por investigación de fraude.');
  }

  if (params.kycStatus !== 'VERIFIED') {
    blockers.push(
      `Verificación de identidad (KYC) pendiente o no aprobada (estado actual: ${params.kycStatus}).`,
    );
  }

  if (params.taxStatus !== 'VALIDATED') {
    blockers.push(
      `Formulario fiscal IRS (W-9 / W-8BEN) pendiente o no validado (estado actual: ${params.taxStatus}).`,
    );
  }

  return {
    eligible: blockers.length === 0 && params.tenantStatus === 'ACTIVE',
    blockers,
  };
}
