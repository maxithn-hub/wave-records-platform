import type { PrismaClient } from '@prisma/client';
import { type MeDto, type Result, ok, err, createDomainError } from '@wave/contracts';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';

export async function getCurrentUserUseCase(params: {
  prisma: PrismaClient;
  userId: string;
  sessionTenantId: string;
}): Promise<Result<MeDto>> {
  return executeIsolatedUseCase('GetCurrentUserUseCase', async () => {
    const user = await params.prisma.user.findUnique({
      where: { id: params.userId },
      include: { tenant: true },
    });

    if (!user || user.tenantId !== params.sessionTenantId) {
      return err(
        createDomainError({
          code: 'UNAUTHORIZED',
          moduleName: 'GetCurrentUserUseCase',
          message: 'Usuario no encontrado para la sesión activa.',
        }),
      );
    }

    return ok({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenant: {
        id: user.tenant.id,
        displayName: user.tenant.displayName,
        legalName: user.tenant.legalName,
        tier: user.tenant.tier,
        status: user.tenant.status,
        countryCode: user.tenant.countryCode,
      },
    });
  });
}
