import type { PrismaClient } from '@prisma/client';
import {
  type RegisterTenantPayload,
  type Result,
  ok,
  err,
  createDomainError,
} from '@wave/contracts';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';
import { hashUserPassword } from '../services/password-hasher.service.js';
import { signJwtAccessToken } from '../services/access-token.service.js';
import { generateOpaqueRefreshToken } from '../services/refresh-token.service.js';

export interface RegisterTenantSuccess {
  readonly accessToken: string;
  readonly expiresInSeconds: number;
  readonly rawRefreshToken: string;
  readonly refreshExpiresAt: Date;
  readonly tenantId: string;
  readonly userId: string;
}

export async function registerTenantUseCase(params: {
  prisma: PrismaClient;
  payload: RegisterTenantPayload;
  jwtSecret: string;
  jwtTtlSeconds: number;
  refreshPepper: string;
  refreshTtlDays: number;
  ip?: string;
  userAgent?: string;
}): Promise<Result<RegisterTenantSuccess>> {
  return executeIsolatedUseCase('RegisterTenantUseCase', async () => {
    const existingUser = await params.prisma.user.findUnique({
      where: { email: params.payload.email },
      select: { id: true },
    });

    if (existingUser) {
      return err(
        createDomainError({
          code: 'VALIDATION_ERROR',
          moduleName: 'RegisterTenantUseCase',
          message: 'El correo electrónico ya está registrado en Wave Records.',
        }),
      );
    }

    const passwordHash = await hashUserPassword(params.payload.password);
    const refreshGen = generateOpaqueRefreshToken({
      pepper: params.refreshPepper,
      ttlDays: params.refreshTtlDays,
    });

    const created = await params.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          legalName: params.payload.legalName,
          displayName: params.payload.displayName,
          tier: params.payload.tier,
          countryCode: params.payload.countryCode,
          status: 'ONBOARDING',
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: params.payload.email,
          passwordHash,
          role: 'TENANT_OWNER',
        },
      });

      await tx.kycVerification.create({
        data: {
          tenantId: tenant.id,
          status: 'NOT_STARTED',
        },
      });

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          familyId: refreshGen.familyId,
          tokenHash: refreshGen.tokenHashHex,
          expiresAt: refreshGen.expiresAt,
          ...(params.ip !== undefined ? { ip: params.ip } : {}),
          ...(params.userAgent !== undefined ? { userAgent: params.userAgent } : {}),
        },
      });

      await tx.complianceAuditLog.create({
        data: {
          actorUserId: user.id,
          targetTenantId: tenant.id,
          action: 'TENANT_REGISTERED',
          entityType: 'TENANT',
          entityId: tenant.id,
          details: `Tier=${tenant.tier}; Country=${tenant.countryCode}`,
          ...(params.ip !== undefined ? { ip: params.ip } : {}),
        },
      });

      return { tenant, user };
    });

    const accessToken = signJwtAccessToken({
      userId: created.user.id,
      tenantId: created.tenant.id,
      role: created.user.role,
      secret: params.jwtSecret,
      ttlSeconds: params.jwtTtlSeconds,
    });

    return ok({
      accessToken,
      expiresInSeconds: params.jwtTtlSeconds,
      rawRefreshToken: refreshGen.rawOpaqueToken,
      refreshExpiresAt: refreshGen.expiresAt,
      tenantId: created.tenant.id,
      userId: created.user.id,
    });
  });
}
