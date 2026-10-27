import type { PrismaClient } from '@prisma/client';
import { type Result, ok, err, createDomainError } from '@wave/contracts';
import {
  validateDdexReleaseCompleteness,
  validateReleaseStateTransition,
} from '@wave/domain-core';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';

export async function submitReleaseToForensicsUseCase(params: {
  prisma: PrismaClient;
  actorUserId: string;
  sessionTenantId: string;
  releaseId: string;
  ip?: string;
}): Promise<Result<{ releaseId: string; nextStatus: string; verifiedTracks: number }>> {
  return executeIsolatedUseCase('SubmitReleaseToForensicsUseCase', async () => {
    const release = await params.prisma.release.findUnique({
      where: { id: params.releaseId },
      include: {
        tracks: {
          orderBy: { trackNumber: 'asc' },
        },
      },
    });

    if (!release || release.tenantId !== params.sessionTenantId) {
      return err(
        createDomainError({
          code: 'FORBIDDEN_IDOR',
          moduleName: 'SubmitReleaseToForensicsUseCase',
          message: 'El lanzamiento no existe o pertenece a otro Tenant.',
        }),
      );
    }

    // If still in DRAFT, first transition conceptually through UPLOADING_ASSETS -> FORENSIC_PROCESSING
    const intermediateStatus =
      release.status === 'DRAFT' ? 'UPLOADING_ASSETS' : release.status;

    const fsmCheck = validateReleaseStateTransition(
      intermediateStatus,
      'FORENSIC_PROCESSING',
    );
    if (!fsmCheck.ok) {
      return fsmCheck;
    }

    const ddexCheck = validateDdexReleaseCompleteness({
      releaseType: release.releaseType,
      title: release.title,
      primaryArtist: release.primaryArtist,
      artworkQuarantineKey: release.artworkQuarantineKey,
      tracks: release.tracks,
    });

    if (!ddexCheck.ok) {
      return ddexCheck;
    }

    await params.prisma.$transaction(async (tx) => {
      await tx.release.update({
        where: { id: release.id },
        data: { status: 'FORENSIC_PROCESSING' },
      });

      await tx.complianceAuditLog.create({
        data: {
          actorUserId: params.actorUserId,
          targetTenantId: params.sessionTenantId,
          action: 'RELEASE_SUBMITTED_TO_FORENSICS',
          entityType: 'RELEASE',
          entityId: release.id,
          details: `VerifiedTracks=${ddexCheck.value.verifiedTrackCount}`,
          ...(params.ip !== undefined ? { ip: params.ip } : {}),
        },
      });
    });

    return ok({
      releaseId: release.id,
      nextStatus: 'FORENSIC_PROCESSING',
      verifiedTracks: ddexCheck.value.verifiedTrackCount,
    });
  });
}
