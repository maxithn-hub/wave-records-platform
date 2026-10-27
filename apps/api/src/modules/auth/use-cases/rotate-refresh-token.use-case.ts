import type { PrismaClient } from '@prisma/client';
import { type Result, ok, err, createDomainError } from '@wave/contracts';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';
import { signJwtAccessToken } from '../services/access-token.service.js';
import {
  generateOpaqueRefreshToken,
  hashRefreshToken,
} from '../services/refresh-token.service.js';

export interface RotateRefreshTokenSuccess {
  readonly accessToken: string;
  readonly expiresInSeconds: number;
  readonly rawRefreshToken: string;
  readonly refreshExpiresAt: Date;
}

/**
 * Rotates an opaque refresh token.
 * If a token that was already revoked/rotated is presented again,
 * the entire token family is immediately revoked (Token Theft Detection).
 */
export async function rotateRefreshTokenUseCase(params: {
  prisma: PrismaClient;
  rawRefreshToken: string;
  jwtSecret: string;
  jwtTtlSeconds: number;
  refreshPepper: string;
  refreshTtlDays: number;
  ip?: string;
  userAgent?: string;
}): Promise<Result<RotateRefreshTokenSuccess>> {
  return executeIsolatedUseCase('RotateRefreshTokenUseCase', async () => {
    const incomingHash = hashRefreshToken(params.rawRefreshToken, params.refreshPepper);

    const existingToken = await params.prisma.refreshToken.findUnique({
      where: { tokenHash: incomingHash },
      include: { user: { include: { tenant: true } } },
    });

    if (!existingToken) {
      return err(
        createDomainError({
          code: 'UNAUTHORIZED',
          moduleName: 'RotateRefreshTokenUseCase',
          message: 'Sesión inválida o expirada.',
        }),
      );
    }

    // Reuse detection: if this token was already rotated or revoked, revoke the whole family!
    if (existingToken.revokedAt !== null || existingToken.replacedById !== null) {
      await params.prisma.refreshToken.updateMany({
        where: { familyId: existingToken.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      return err(
        createDomainError({
          code: 'UNAUTHORIZED',
          moduleName: 'RotateRefreshTokenUseCase',
          message:
            'Alerta de seguridad: se detectó reuso de un token ya rotado. Se revocó toda la familia de sesiones.',
        }),
      );
    }

    if (existingToken.expiresAt.getTime() <= Date.now()) {
      await params.prisma.refreshToken.update({
        where: { id: existingToken.id },
        data: { revokedAt: new Date() },
      });
      return err(
        createDomainError({
          code: 'UNAUTHORIZED',
          moduleName: 'RotateRefreshTokenUseCase',
          message: 'El token de sesión ha expirado.',
        }),
      );
    }

    const nextRefresh = generateOpaqueRefreshToken({
      pepper: params.refreshPepper,
      ttlDays: params.refreshTtlDays,
      existingFamilyId: existingToken.familyId,
    });

    await params.prisma.$transaction(async (tx) => {
      const replacementRecord = await tx.refreshToken.create({
        data: {
          userId: existingToken.userId,
          familyId: existingToken.familyId,
          tokenHash: nextRefresh.tokenHashHex,
          expiresAt: nextRefresh.expiresAt,
          ...(params.ip !== undefined ? { ip: params.ip } : {}),
          ...(params.userAgent !== undefined ? { userAgent: params.userAgent } : {}),
        },
      });

      await tx.refreshToken.update({
        where: { id: existingToken.id },
        data: {
          revokedAt: new Date(),
          replacedById: replacementRecord.id,
        },
      });
    });

    const accessToken = signJwtAccessToken({
      userId: existingToken.user.id,
      tenantId: existingToken.user.tenantId,
      role: existingToken.user.role,
      secret: params.jwtSecret,
      ttlSeconds: params.jwtTtlSeconds,
    });

    return ok({
      accessToken,
      expiresInSeconds: params.jwtTtlSeconds,
      rawRefreshToken: nextRefresh.rawOpaqueToken,
      refreshExpiresAt: nextRefresh.expiresAt,
    });
  });
}
