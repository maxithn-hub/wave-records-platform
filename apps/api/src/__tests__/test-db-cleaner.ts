import type { PrismaClient } from '@prisma/client';

/**
 * Cleans all test database tables in strict reverse foreign-key dependency order.
 * Shared across integration test suites so adding new domain tables never breaks earlier suites.
 */
export async function cleanWaveTestDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.payoutRequest.deleteMany();
  await prisma.royaltyLedgerEntry.deleteMany();
  await prisma.escrowRoyaltyHold.deleteMany();
  await prisma.royaltyStatementIngest.deleteMany();
  await prisma.revelatorDeliveryJob.deleteMany();
  await prisma.forensicScanReport.deleteMany();
  await prisma.multipartUploadSession.deleteMany();
  await prisma.splitAgreement.deleteMany();
  await prisma.track.deleteMany();
  await prisma.release.deleteMany();
  await prisma.complianceAuditLog.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.kycVerification.deleteMany();
  await prisma.taxDeclaration.deleteMany();
  await prisma.revelatorTenantMapping.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
}
