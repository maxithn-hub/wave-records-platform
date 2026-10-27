import type { PrismaClient } from '@prisma/client';
import {
  type CreateReleaseDraftPayload,
  type Result,
  ok,
  err,
  createDomainError,
} from '@wave/contracts';
import { validateUpcOrEan } from '@wave/domain-core';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';

export async function createReleaseDraftUseCase(params: {
  prisma: PrismaClient;
  actorUserId: string;
  sessionTenantId: string;
  payload: CreateReleaseDraftPayload;
  ip?: string;
}): Promise<Result<{ releaseId: string; status: string }>> {
  return executeIsolatedUseCase('CreateReleaseDraftUseCase', async () => {
    let normalizedUpc: string | null = null;
    if (params.payload.upcCode && params.payload.upcCode.trim().length > 0) {
      const upcRes = validateUpcOrEan(params.payload.upcCode);
      if (!upcRes.ok) {
        return upcRes;
      }
      normalizedUpc = upcRes.value;

      const existingUpc = await params.prisma.release.findUnique({
        where: { upcCode: normalizedUpc },
        select: { id: true },
      });
      if (existingUpc) {
        return err(
          createDomainError({
            code: 'VALIDATION_ERROR',
            moduleName: 'CreateReleaseDraftUseCase',
            message: `El código UPC "${normalizedUpc}" ya está asignado a otro lanzamiento.`,
          }),
        );
      }
    }

    const release = await params.prisma.$transaction(async (tx) => {
      const created = await tx.release.create({
        data: {
          tenantId: params.sessionTenantId,
          title: params.payload.title,
          versionTitle: params.payload.versionTitle ?? null,
          primaryArtist: params.payload.primaryArtist,
          releaseType: params.payload.releaseType,
          primaryGenre: params.payload.primaryGenre,
          releaseDate: params.payload.releaseDateIso
            ? new Date(`${params.payload.releaseDateIso}T00:00:00.000Z`)
            : null,
          pLineYear: params.payload.pLineYear,
          pLineOwner: params.payload.pLineOwner,
          cLineYear: params.payload.cLineYear,
          cLineOwner: params.payload.cLineOwner,
          upcCode: normalizedUpc,
          status: 'DRAFT',
        },
      });

      await tx.complianceAuditLog.create({
        data: {
          actorUserId: params.actorUserId,
          targetTenantId: params.sessionTenantId,
          action: 'RELEASE_DRAFT_CREATED',
          entityType: 'RELEASE',
          entityId: created.id,
          details: `Type=${created.releaseType}; Title=${created.title}`,
          ...(params.ip !== undefined ? { ip: params.ip } : {}),
        },
      });

      return created;
    });

    return ok({
      releaseId: release.id,
      status: release.status,
    });
  });
}
