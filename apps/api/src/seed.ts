import { loadApiEnv } from './config/env.schema.js';
import { getPrismaClient } from './infrastructure/prisma/prisma.service.js';
import { hashUserPassword } from './modules/auth/services/password-hasher.service.js';

export async function seedInitialComplianceAdmin(): Promise<void> {
  const env = loadApiEnv();
  if (!env.ADMIN_BOOTSTRAP_EMAIL || !env.ADMIN_BOOTSTRAP_PASSWORD) {
    console.log('[SEED] No se definieron ADMIN_BOOTSTRAP_EMAIL / PASSWORD. Omitiendo seed.');
    return;
  }

  const prisma = getPrismaClient(env.DATABASE_URL);
  try {
    const existing = await prisma.user.findUnique({
      where: { email: env.ADMIN_BOOTSTRAP_EMAIL.toLowerCase() },
    });

    if (existing) {
      console.log(`[SEED] El administrador ${env.ADMIN_BOOTSTRAP_EMAIL} ya existe.`);
      return;
    }

    const passwordHash = await hashUserPassword(env.ADMIN_BOOTSTRAP_PASSWORD);

    await prisma.$transaction(async (tx) => {
      const hqTenant = await tx.tenant.create({
        data: {
          legalName: 'Wave Records LLC (Internal Operations HQ)',
          displayName: 'Wave Records Admin HQ',
          tier: 'LABEL_GROWTH',
          status: 'ACTIVE',
          countryCode: 'US',
          commissionRatePercent: 0,
        },
      });

      await tx.user.create({
        data: {
          tenantId: hqTenant.id,
          email: env.ADMIN_BOOTSTRAP_EMAIL!.toLowerCase(),
          passwordHash,
          role: 'WAVE_COMPLIANCE_ADMIN',
        },
      });
    });

    console.log(`[SEED] Administrador ${env.ADMIN_BOOTSTRAP_EMAIL} creado exitosamente.`);
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  seedInitialComplianceAdmin().catch((err: unknown) => {
    console.error('[SEED ERROR]:', err);
    process.exit(1);
  });
}
