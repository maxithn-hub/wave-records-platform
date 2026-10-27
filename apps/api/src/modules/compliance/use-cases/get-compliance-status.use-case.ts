import type { PrismaClient } from '@prisma/client';
import {
  type ComplianceStatusDto,
  type KycDocumentType,
  type Result,
  resolveRequiredTaxForm,
  ok,
  err,
  createDomainError,
} from '@wave/contracts';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';
import { evaluatePayoutEligibility } from './evaluate-payout-eligibility.use-case.js';

export async function getComplianceStatusUseCase(params: {
  prisma: PrismaClient;
  sessionTenantId: string;
}): Promise<Result<ComplianceStatusDto>> {
  return executeIsolatedUseCase('GetComplianceStatusUseCase', async () => {
    const tenant = await params.prisma.tenant.findUnique({
      where: { id: params.sessionTenantId },
      include: {
        kycVerifications: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        taxDeclarations: {
          orderBy: { signedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!tenant) {
      return err(
        createDomainError({
          code: 'UNAUTHORIZED',
          moduleName: 'GetComplianceStatusUseCase',
          message: 'Tenant no encontrado.',
        }),
      );
    }

    const latestKyc = tenant.kycVerifications[0] ?? null;
    const latestTax = tenant.taxDeclarations[0] ?? null;

    const kycStatus = latestKyc?.status ?? 'NOT_STARTED';
    const taxStatus = latestTax?.status ?? 'MISSING';

    const eligibility = evaluatePayoutEligibility({
      tenantStatus: tenant.status,
      kycStatus,
      taxStatus,
    });

    return ok({
      tenantStatus: tenant.status,
      requiredTaxForm: resolveRequiredTaxForm({
        countryCode: tenant.countryCode,
        tier: tenant.tier,
      }),
      kyc: {
        status: kycStatus,
        documentType: (latestKyc?.documentType as KycDocumentType | null) ?? null,
        submittedAt: latestKyc?.s3ObjectKey ? latestKyc.createdAt.toISOString() : null,
        rejectionReason: latestKyc?.rejectionReason ?? null,
      },
      tax: {
        status: taxStatus,
        formType: latestTax?.formType ?? null,
        maskedTaxId: latestTax?.taxIdLast4 ? `***-**-${latestTax.taxIdLast4}` : null,
        submittedAt: latestTax ? latestTax.signedAt.toISOString() : null,
        rejectionReason: latestTax?.rejectionReason ?? null,
      },
      payoutEligible: eligibility.eligible,
      payoutBlockers: [...eligibility.blockers],
    });
  });
}
