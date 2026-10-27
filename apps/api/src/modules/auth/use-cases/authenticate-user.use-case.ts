import type { PrismaClient } from '@prisma/client';
import {
  type LoginPayload,
  type Result,
  ok,
  err,
  createDomainError,
} from '@wave/contracts';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';
import {
  verifyUserPassword,
  verifyDummyPasswordForTimingProtection,
} from '../services/password-hasher.service.js';
import { signJwtAccessToken } from '../services/access-token.service.js';
import { generateOpaqueRefreshToken } from '../services/refresh-token.service.js';

export interface AuthenticateUserSuccess {
  readonly accessToken: string;
  readonly expiresInSeconds: number;
  readonly rawRefreshToken: string;
  readonly refreshExpiresAt: Date;
}

const GENERIC_AUTH_FAILURE_MESSAGE = 'Credenciales inválidas.';

export async function authenticateUserUseCase(params: {
  prisma: PrismaClient;
  payload: LoginPayload;
  jwtSecret: string;
  jwtTtlSeconds: number;
  refreshPepper: string;
  refreshTtlDays: number;
  ip?: string;
  userAgent?: string;
}): Promise<Result<AuthenticateUserSuccess>> {
  return executeIsolatedUseCase('AuthenticateUserUseCase', async () => {
    const user = await params.prisma.user.findUnique({
      where: { email: params.payload.email },
      include: { tenant: true },
    });

    if (!user || !user.isActive) {
      await verifyDummyPasswordForTimingProtection(params.payload.password);
      return err(
        createDomainError({
          code: 'UNAUTHORIZED',
          moduleName: 'AuthenticateUserUseCase',
          message: GENERIC_AUTH_FAILURE_MESSAGE,
        }),
      );
    }

    const passwordValid = await verifyUserPassword(user.passwordHash, params.payload.password);
    if (!passwordValid) {
      return err(
        createDomainError({
          code: 'UNAUTHORIZED',
          moduleName: 'AuthenticateUserUseCase',
          message: GENERIC_AUTH_FAILURE_MESSAGE,
        }),
      );
    }

    if (user.tenant.status === 'SUSPENDED_FRAUD') {
      return err(
        createDomainError({
          code: 'TENANT_SUSPENDED',
          moduleName: 'AuthenticateUserUseCase',
          message: 'La cuenta se encuentra suspendida por el equipo de cumplimiento.',
        }),
      );
    }

    const refreshGen = generateOpaqueRefreshToken({
      pepper: params.refreshPepper,
      ttlDays: params.refreshTtlDays,
    });

    await params.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId: refreshGen.familyId,
        tokenHash: refreshGen.tokenHashHex,
        expiresAt: refreshGen.expiresAt,
        ...(params.ip !== undefined ? { ip: params.ip } : {}),
        ...(params.userAgent !== undefined ? { userAgent: params.userAgent } : {}),
      },
    });

    const accessToken = signJwtAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      secret: params.jwtSecret,
      ttlSeconds: params.jwtTtlSeconds,
    });

    return ok({
      accessToken,
      expiresInSeconds: params.jwtTtlSeconds,
      rawRefreshToken: refreshGen.rawOpaqueToken,
      refreshExpiresAt: refreshGen.expiresAt,
    });
  });
}
