import type { PrismaClient } from '@prisma/client';
import {
  type Result,
  type ConfigureTrackSplitsInput,
  type SplitAgreementDto,
  ok,
  err,
  createDomainError,
} from '@wave/contracts';
import {
  validateRoyaltySplitsTotal,
  formatDecimal18_10,
} from '@wave/domain-core';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';

/**
 * Configures royalty splits for a track.
 * - Requires the sum of shares to equal exactly 100.0000000000% in DECIMAL(18, 10).
 * - Automatically detects whether each collaborator email belongs to an existing Tenant
 *   (`ACCEPTED_ACTIVE`) or an unregistered "Ghost Account" (`PENDING_INVITATION_ESCROW`).
 */
export async function configureTrackSplitsUseCase(params: {
  prisma: PrismaClient;
  actorUserId: string;
  sessionTenantId: string;
  trackId: string;
  input: ConfigureTrackSplitsInput;
  ip?: string;
}): Promise<Result<SplitAgreementDto[]>> {
  return executeIsolatedUseCase<SplitAgreementDto[]>(
    'ConfigureTrackSplitsUseCase',
    async () => {
      const track = await params.prisma.track.findUnique({
        where: { id: params.trackId },
        include: { release: true },
      });

      if (!track || track.release.tenantId !== params.sessionTenantId) {
        return err(
          createDomainError({
            code: 'FORBIDDEN_IDOR',
            moduleName: 'ConfigureTrackSplitsUseCase',
            message: 'El track indicado no existe o pertenece a otro Tenant.',
          }),
        );
      }

      const validationRes = validateRoyaltySplitsTotal(
        params.input.splits.map((s) => ({
          participantIdentifier: s.collaboratorEmail.toLowerCase(),
          percentageStr: s.sharePercentage,
        })),
      );

      if (!validationRes.ok) {
        return validationRes;
      }

      const normalizedEmails = params.input.splits.map((s) =>
        s.collaboratorEmail.trim().toLowerCase(),
      );
      const uniqueEmails = new Set(normalizedEmails);
      if (uniqueEmails.size !== normalizedEmails.length) {
        return err(
          createDomainError({
            code: 'VALIDATION_ERROR',
            moduleName: 'ConfigureTrackSplitsUseCase',
            message: 'No se permiten correos duplicados en la misma división de regalías.',
          }),
        );
      }

      const existingUsers = await params.prisma.user.findMany({
        where: { email: { in: normalizedEmails } },
      });
      const userByEmail = new Map(
        existingUsers.map((u) => [u.email.toLowerCase(), u]),
      );

      const createdSplits = await params.prisma.$transaction(async (tx) => {
        await tx.splitAgreement.deleteMany({
          where: { trackId: track.id },
        });

        const results: SplitAgreementDto[] = [];
        for (const share of validationRes.value) {
          const matchedUser = userByEmail.get(share.participantIdentifier);
          const formattedPct = formatDecimal18_10(share.scaledPercentage);
          const isRegistered = Boolean(matchedUser);
          const now = new Date();

          const created = await tx.splitAgreement.create({
            data: {
              trackId: track.id,
              collaboratorEmail: share.participantIdentifier,
              collaboratorTenantId: matchedUser ? matchedUser.tenantId : null,
              sharePercentage: formattedPct,
              status: isRegistered ? 'ACCEPTED_ACTIVE' : 'PENDING_INVITATION_ESCROW',
              acceptedAt: isRegistered ? now : null,
            },
          });

          results.push({
            id: created.id,
            trackId: created.trackId,
            collaboratorEmail: created.collaboratorEmail,
            collaboratorTenantId: created.collaboratorTenantId,
            sharePercentage: created.sharePercentage.toFixed(10),
            status: created.status,
            acceptedAt: created.acceptedAt ? created.acceptedAt.toISOString() : null,
          });
        }

        await tx.complianceAuditLog.create({
          data: {
            actorUserId: params.actorUserId,
            targetTenantId: params.sessionTenantId,
            action: 'TRACK_SPLITS_CONFIGURED',
            entityType: 'TRACK',
            entityId: track.id,
            details: `Participants=${results.length} EscrowGhostAccounts=${
              results.filter((r) => r.status === 'PENDING_INVITATION_ESCROW').length
            }`,
            ...(params.ip !== undefined ? { ip: params.ip } : {}),
          },
        });

        return results;
      });

      return ok(createdSplits);
    },
  );
}
