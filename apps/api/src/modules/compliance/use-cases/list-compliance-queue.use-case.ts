import type { PrismaClient } from '@prisma/client';
import {
  type ComplianceQueueDto,
  type ComplianceQueueItem,
  type KycDocumentType,
  type Result,
  ok,
} from '@wave/contracts';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';

export async function listComplianceQueueUseCase(params: {
  prisma: PrismaClient;
}): Promise<Result<ComplianceQueueDto>> {
  return executeIsolatedUseCase('ListComplianceQueueUseCase', async () => {
    const [pendingKycs, pendingTaxes] = await Promise.all([
      params.prisma.kycVerification.findMany({
        where: { status: 'PENDING_REVIEW' },
        include: { tenant: true },
        orderBy: { createdAt: 'asc' },
      }),
      params.prisma.taxDeclaration.findMany({
        where: { status: 'SUBMITTED_UNDER_REVIEW' },
        include: { tenant: true },
        orderBy: { signedAt: 'asc' },
      }),
    ]);

    const kycItems: ComplianceQueueItem[] = pendingKycs.map((k) => ({
      kind: 'KYC',
      id: k.id,
      tenantId: k.tenantId,
      tenantDisplayName: k.tenant.displayName,
      tenantCountryCode: k.tenant.countryCode,
      tenantTier: k.tenant.tier,
      submittedAt: k.createdAt.toISOString(),
      documentType: (k.documentType as KycDocumentType | null) ?? null,
      formType: null,
      maskedTaxId: null,
      signerName: null,
      formData: null,
      hasDocument: Boolean(k.s3ObjectKey),
    }));

    const taxItems: ComplianceQueueItem[] = pendingTaxes.map((t) => ({
      kind: 'TAX',
      id: t.id,
      tenantId: t.tenantId,
      tenantDisplayName: t.tenant.displayName,
      tenantCountryCode: t.tenant.countryCode,
      tenantTier: t.tenant.tier,
      submittedAt: t.signedAt.toISOString(),
      documentType: null,
      formType: t.formType,
      maskedTaxId: t.taxIdLast4 ? `***-**-${t.taxIdLast4}` : null,
      signerName: t.electronicSignature,
      formData: t.formDataJson ? (JSON.parse(t.formDataJson) as Record<string, unknown>) : null,
      hasDocument: Boolean(t.pdfDocumentKey),
    }));

    return ok({
      items: [...kycItems, ...taxItems],
    });
  });
}
