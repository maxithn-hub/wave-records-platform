import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

export interface ServerResolvedRevelatorTenant {
  readonly tenantId: string;
  readonly revelatorEnterpriseId: number;
  readonly revelatorUserId: string;
  readonly revelatorPlanType: 'Launch' | 'Growth';
}

/**
 * Resolves (or deterministically provisions on first release approval) the server-only
 * Revelator Child Account mapping for a Tenant.
 * Enforces Anti-IDOR by never accepting `revelatorEnterpriseId` from any HTTP request.
 */
export async function resolveOrProvisionRevelatorChildAccount(
  prisma: PrismaClient,
  tenant: { id: string; tier: 'INDIVIDUAL_LAUNCH' | 'LABEL_GROWTH' },
): Promise<ServerResolvedRevelatorTenant> {
  const existing = await prisma.revelatorTenantMapping.findUnique({
    where: { tenantId: tenant.id },
  });

  if (existing) {
    return {
      tenantId: existing.tenantId,
      revelatorEnterpriseId: existing.revelatorEnterpriseId,
      revelatorUserId: existing.revelatorUserId,
      revelatorPlanType: existing.revelatorPlanType === 'Growth' ? 'Growth' : 'Launch',
    };
  }

  // Deterministically derive a unique Revelator Enterprise ID (100000 - 999999) from tenant UUID
  const hashHex = createHash('sha256').update(`wave-rev-child:${tenant.id}`).digest('hex');
  const revelatorEnterpriseId = 100_000 + (parseInt(hashHex.slice(0, 8), 16) % 899_999);
  const revelatorPlanType: 'Launch' | 'Growth' =
    tenant.tier === 'LABEL_GROWTH' ? 'Growth' : 'Launch';
  const revelatorUserId = `rev_usr_${hashHex.slice(8, 24)}`;

  const created = await prisma.revelatorTenantMapping.create({
    data: {
      tenantId: tenant.id,
      revelatorEnterpriseId,
      revelatorUserId,
      revelatorPlanType,
    },
  });

  return {
    tenantId: created.tenantId,
    revelatorEnterpriseId: created.revelatorEnterpriseId,
    revelatorUserId: created.revelatorUserId,
    revelatorPlanType,
  };
}
