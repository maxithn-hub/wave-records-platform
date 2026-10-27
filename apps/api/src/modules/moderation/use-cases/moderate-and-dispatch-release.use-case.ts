import type { PrismaClient } from '@prisma/client';
import {
  type Result,
  type AdminReleaseDecisionInput,
  type RevelatorDeliverySummary,
  ok,
  err,
  createDomainError,
} from '@wave/contracts';
import {
  validateReleaseStateTransition,
  buildRevelatorV2ReleasePayload,
} from '@wave/domain-core';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';
import type { RevelatorGatewayPort } from '../../revelator/ports/revelator-gateway.port.js';
import { resolveOrProvisionRevelatorChildAccount } from '../../revelator/services/revelator-tenant-provisioner.service.js';

/**
 * Executes the Admin Moderation decision on a release:
 * - REJECT: Transitions release -> REJECTED and logs the reason.
 * - APPROVE_AND_DISPATCH:
 *   1. Enforces Beat License PDF requirement if release is in Grey Area (`blockUgcMonetization = true`).
 *   2. Resolves/provisions `RevelatorTenantMapping` strictly server-side (Anti-IDOR).
 *   3. Acquires 8-hour Unprompted Auth token via Revelator V1 (`/partner/account/login`).
 *   4. Builds sanitized Revelator V2 payload (excluding UGC Content-ID stores if `blockUgcMonetization = true`).
 *   5. Dispatches to Revelator V2 (`/v2/distribution/release/inspectanddistribute`) via Circuit Breaker.
 */
export async function moderateAndDispatchReleaseUseCase(params: {
  prisma: PrismaClient;
  revelatorGateway: RevelatorGatewayPort;
  actorUserId: string;
  actorRole: string;
  releaseId: string;
  input: AdminReleaseDecisionInput;
  ip?: string;
}): Promise<Result<RevelatorDeliverySummary>> {
  return executeIsolatedUseCase<RevelatorDeliverySummary>(
    'ModerateAndDispatchReleaseUseCase',
    async () => {
    if (params.actorRole !== 'WAVE_COMPLIANCE_ADMIN') {
      return err(
        createDomainError({
          code: 'FORBIDDEN_IDOR',
          moduleName: 'ModerateAndDispatchReleaseUseCase',
          message: 'Solo los administradores pueden aprobar o rechazar lanzamientos en moderación.',
        }),
      );
    }

    const release = await params.prisma.release.findUnique({
      where: { id: params.releaseId },
      include: {
        tenant: true,
        tracks: {
          orderBy: { trackNumber: 'asc' },
        },
      },
    });

    if (!release) {
      return err(
        createDomainError({
          code: 'VALIDATION_ERROR',
          moduleName: 'ModerateAndDispatchReleaseUseCase',
          message: 'El lanzamiento solicitado no existe.',
        }),
      );
    }

    // 1. Handle REJECT decision
    if (params.input.decision === 'REJECT') {
      const fsmCheck = validateReleaseStateTransition(release.status, 'REJECTED');
      if (!fsmCheck.ok) {
        return fsmCheck;
      }

      const childAccount = await resolveOrProvisionRevelatorChildAccount(
        params.prisma,
        release.tenant,
      );

      const rejectedJob = await params.prisma.$transaction(async (tx) => {
        await tx.release.update({
          where: { id: release.id },
          data: {
            status: 'REJECTED',
            moderationNotes: params.input.moderationNotes,
            moderatedByUserId: params.actorUserId,
            moderatedAt: new Date(),
          },
        });

        const job = await tx.revelatorDeliveryJob.create({
          data: {
            releaseId: release.id,
            tenantId: release.tenantId,
            revelatorEnterpriseId: childAccount.revelatorEnterpriseId,
            revelatorUserId: childAccount.revelatorUserId,
            revelatorPlanType: childAccount.revelatorPlanType,
            unpromptedTokenCached: false,
            ugcMonetizationBlocked: release.blockUgcMonetization,
            ugcMonetizationPolicy: release.blockUgcMonetization
              ? 'BLOCKED_BEAT_LEASE_GREY_AREA'
              : 'MONETIZE_ALL',
            dspTargetsJson: JSON.stringify([]),
            payloadSnapshotJson: JSON.stringify({ rejectedByModerator: true }),
            deliveryStatus: 'REJECTED_BY_MODERATOR',
            attemptCount: 1,
            moderatedByUserId: params.actorUserId,
          },
        });

        await tx.complianceAuditLog.create({
          data: {
            actorUserId: params.actorUserId,
            targetTenantId: release.tenantId,
            action: 'RELEASE_MODERATION_REJECTED',
            entityType: 'RELEASE',
            entityId: release.id,
            details: params.input.moderationNotes,
            ...(params.ip !== undefined ? { ip: params.ip } : {}),
          },
        });

        return job;
      });

      return ok({
        deliveryJobId: rejectedJob.id,
        releaseId: release.id,
        releaseStatus: 'REJECTED',
        revelatorEnterpriseId: rejectedJob.revelatorEnterpriseId,
        revelatorUserId: rejectedJob.revelatorUserId,
        revelatorPlanType: rejectedJob.revelatorPlanType,
        revelatorReleaseId: null,
        unpromptedTokenCached: false,
        ugcMonetizationBlocked: release.blockUgcMonetization,
        ugcMonetizationPolicy: release.blockUgcMonetization
          ? 'BLOCKED_BEAT_LEASE_GREY_AREA'
          : 'MONETIZE_ALL',
        dspTargets: [],
        deliveryStatus: rejectedJob.deliveryStatus,
        attemptCount: rejectedJob.attemptCount,
        dispatchedAt: null,
      });
    }

    // 2. Handle APPROVE_AND_DISPATCH decision
    const fsmApproveCheck = validateReleaseStateTransition(
      release.status,
      'APPROVED_FOR_DELIVERY',
    );
    if (!fsmApproveCheck.ok) {
      return fsmApproveCheck;
    }

    // Guardrail: Grey-Area (45%-79%) releases with blockUgcMonetization = true MUST have a Beat License PDF
    if (release.blockUgcMonetization && !release.licenseDocumentKey) {
      return err(
        createDomainError({
          code: 'FORENSIC_REJECTED',
          moduleName: 'ModerateAndDispatchReleaseUseCase',
          message:
            'No se puede aprobar ni despachar un lanzamiento en Zona Gris (45%-79% ACRCloud) sin que el productor haya subido la licencia del Beat en PDF.',
        }),
      );
    }

    // 3. Server-Side Anti-IDOR Resolution of Revelator Child Account
    const childAccount = await resolveOrProvisionRevelatorChildAccount(
      params.prisma,
      release.tenant,
    );

    // 4. Build sanitized Revelator V2 payload
    const v2Payload = buildRevelatorV2ReleasePayload({
      revelatorEnterpriseId: childAccount.revelatorEnterpriseId,
      revelatorUserId: childAccount.revelatorUserId,
      revelatorPlanType: childAccount.revelatorPlanType,
      releaseId: release.id,
      title: release.title,
      versionTitle: release.versionTitle,
      primaryArtist: release.primaryArtist,
      releaseType: release.releaseType,
      primaryGenre: release.primaryGenre,
      upcCode: release.upcCode,
      pLineYear: release.pLineYear,
      pLineOwner: release.pLineOwner,
      cLineYear: release.cLineYear,
      cLineOwner: release.cLineOwner,
      artworkSha256Hash: release.artworkSha256Hash ?? '',
      blockUgcMonetization: release.blockUgcMonetization,
      tracks: release.tracks.map((t) => ({
        trackNumber: t.trackNumber,
        title: t.title,
        versionTitle: t.versionTitle,
        primaryArtist: t.primaryArtist,
        isrcCode: t.isrcCode ?? '',
        isExplicit: t.isExplicit,
        isInstrumental: t.isInstrumental,
        audioLanguage: t.audioLanguage,
        wavSha256Hash: t.wavSha256Hash ?? '',
        sampleRateHz: t.sampleRateHz ?? 44100,
        bitDepth: t.bitDepth ?? 16,
        durationSeconds: t.durationSeconds ?? 180,
      })),
    });

    const previousAttempts = await params.prisma.revelatorDeliveryJob.count({
      where: { releaseId: release.id },
    });

    // 5. Execute Revelator V1 Unprompted Auth + V2 Ingest & Distribute inside Circuit Breaker
    try {
      const tokenRes = await params.revelatorGateway.acquireUnpromptedChildToken({
        tenantId: release.tenantId,
        revelatorEnterpriseId: childAccount.revelatorEnterpriseId,
        revelatorUserId: childAccount.revelatorUserId,
      });

      const dispatchRes = await params.revelatorGateway.ingestAndDistributeRelease({
        accessToken: tokenRes.accessToken,
        payload: v2Payload,
      });

      const dispatchedAt = new Date();
      const completedJob = await params.prisma.$transaction(async (tx) => {
        await tx.release.update({
          where: { id: release.id },
          data: {
            status: 'LIVE_ON_DSPS',
            revelatorReleaseId: dispatchRes.revelatorReleaseId,
            moderationNotes: params.input.moderationNotes,
            moderatedByUserId: params.actorUserId,
            moderatedAt: dispatchedAt,
          },
        });

        const job = await tx.revelatorDeliveryJob.create({
          data: {
            releaseId: release.id,
            tenantId: release.tenantId,
            revelatorEnterpriseId: childAccount.revelatorEnterpriseId,
            revelatorUserId: childAccount.revelatorUserId,
            revelatorPlanType: childAccount.revelatorPlanType,
            revelatorReleaseId: dispatchRes.revelatorReleaseId,
            unpromptedTokenCached: tokenRes.fromCache,
            ugcMonetizationBlocked: release.blockUgcMonetization,
            ugcMonetizationPolicy: v2Payload.rightsManagement.ugcMonetizationPolicy,
            dspTargetsJson: JSON.stringify(dispatchRes.distributedStores),
            payloadSnapshotJson: JSON.stringify(v2Payload),
            deliveryStatus: dispatchRes.inspectionStatus,
            attemptCount: previousAttempts + 1,
            moderatedByUserId: params.actorUserId,
            dispatchedAt,
          },
        });

        await tx.complianceAuditLog.create({
          data: {
            actorUserId: params.actorUserId,
            targetTenantId: release.tenantId,
            action: 'RELEASE_DISPATCHED_TO_REVELATOR_V2',
            entityType: 'RELEASE',
            entityId: release.id,
            details: `RevelatorReleaseId=${dispatchRes.revelatorReleaseId} EnterpriseId=${childAccount.revelatorEnterpriseId} CachedToken=${tokenRes.fromCache} UGCBlocked=${release.blockUgcMonetization}`,
            ...(params.ip !== undefined ? { ip: params.ip } : {}),
          },
        });

        return job;
      });

      return ok({
        deliveryJobId: completedJob.id,
        releaseId: release.id,
        releaseStatus: 'LIVE_ON_DSPS',
        revelatorEnterpriseId: childAccount.revelatorEnterpriseId,
        revelatorUserId: childAccount.revelatorUserId,
        revelatorPlanType: childAccount.revelatorPlanType,
        revelatorReleaseId: dispatchRes.revelatorReleaseId,
        unpromptedTokenCached: tokenRes.fromCache,
        ugcMonetizationBlocked: release.blockUgcMonetization,
        ugcMonetizationPolicy: v2Payload.rightsManagement.ugcMonetizationPolicy,
        dspTargets: [...dispatchRes.distributedStores],
        deliveryStatus: completedJob.deliveryStatus,
        attemptCount: completedJob.attemptCount,
        dispatchedAt: dispatchedAt.toISOString(),
      });
    } catch (gatewayErr: unknown) {
      const errMsg =
        gatewayErr instanceof Error
          ? gatewayErr.message
          : 'Fallo de comunicación con Revelator API V1/V2.';

      await params.prisma.revelatorDeliveryJob.create({
        data: {
          releaseId: release.id,
          tenantId: release.tenantId,
          revelatorEnterpriseId: childAccount.revelatorEnterpriseId,
          revelatorUserId: childAccount.revelatorUserId,
          revelatorPlanType: childAccount.revelatorPlanType,
          unpromptedTokenCached: false,
          ugcMonetizationBlocked: release.blockUgcMonetization,
          ugcMonetizationPolicy: v2Payload.rightsManagement.ugcMonetizationPolicy,
          dspTargetsJson: JSON.stringify(v2Payload.targetDspStores),
          payloadSnapshotJson: JSON.stringify(v2Payload),
          deliveryStatus: 'FAILED_CIRCUIT_BREAKER_ISOLATED',
          attemptCount: previousAttempts + 1,
          lastError: errMsg.slice(0, 500),
          moderatedByUserId: params.actorUserId,
        },
      });

      return err(
        createDomainError({
          code: 'EXTERNAL_PROVIDER_ERROR',
          moduleName: 'ModerateAndDispatchReleaseUseCase',
          message: `Despacho a Revelator contenido de forma segura (el lanzamiento permanece en cola sin corrupción de estado): ${errMsg}`,
        }),
      );
    }
  });
}
