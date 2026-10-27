import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import {
  type ForensicScanReportDto,
  type RunForensicPipelinePayload,
  type Result,
  ok,
  err,
  createDomainError,
} from '@wave/contracts';
import {
  analyzePcmAudioSignalForensics,
  evaluateAcrCloudCopyrightVerdict,
  inspectAndValidateArtworkBuffer,
  validateReleaseStateTransition,
} from '@wave/domain-core';
import { executeIsolatedUseCase } from '../../../common/filters/isolated-exception.handler.js';
import type { AcrCloudScannerPort } from '../ports/acrcloud-scanner.port.js';

export async function runReleaseForensicScanUseCase(params: {
  prisma: PrismaClient;
  acrScanner: AcrCloudScannerPort;
  quarantineStorageDir: string;
  actorUserId: string;
  sessionTenantId: string;
  releaseId: string;
  payload: RunForensicPipelinePayload;
  ip?: string;
}): Promise<Result<ForensicScanReportDto>> {
  return executeIsolatedUseCase('RunReleaseForensicScanUseCase', async () => {
    const release = await params.prisma.release.findUnique({
      where: { id: params.releaseId },
      include: {
        tracks: { orderBy: { trackNumber: 'asc' } },
      },
    });

    if (!release || release.tenantId !== params.sessionTenantId) {
      return err(
        createDomainError({
          code: 'FORBIDDEN_IDOR',
          moduleName: 'RunReleaseForensicScanUseCase',
          message: 'El lanzamiento no existe o pertenece a otro Tenant.',
        }),
      );
    }

    if (release.status !== 'FORENSIC_PROCESSING') {
      return err(
        createDomainError({
          code: 'INVALID_STATE_TRANSITION',
          moduleName: 'RunReleaseForensicScanUseCase',
          message: `El lanzamiento debe estar en estado FORENSIC_PROCESSING para ejecutar el escaneo forense (estado actual: ${release.status}).`,
        }),
      );
    }

    const baseQuarantine = resolve(params.quarantineStorageDir);

    // 1. Inspect Artwork (3000x3000 px, 1:1 square, RGB color space)
    if (!release.artworkQuarantineKey) {
      return err(
        createDomainError({
          code: 'FORENSIC_REJECTED',
          moduleName: 'RunReleaseForensicScanUseCase',
          message: 'Portada ausente en el bucket de cuarentena.',
        }),
      );
    }

    const artworkBuffer = await readFile(
      join(baseQuarantine, release.artworkQuarantineKey),
    ).catch(() => null);
    if (!artworkBuffer) {
      return err(
        createDomainError({
          code: 'FORENSIC_REJECTED',
          moduleName: 'RunReleaseForensicScanUseCase',
          message: 'No se pudo leer el archivo de portada en cuarentena.',
        }),
      );
    }

    const artworkCheck = inspectAndValidateArtworkBuffer(artworkBuffer);
    if (!artworkCheck.ok) {
      await params.prisma.release.update({
        where: { id: release.id },
        data: { status: 'REJECTED', artworkVerified: false },
      });
      return artworkCheck;
    }

    // 2. Inspect each Track's PCM Signal (silencedetect & static fraud) + ACRCloud Fingerprint
    let maxSilenceRatio = 0;
    let maxAcrScore = 0;
    let matchedTitle: string | null = null;
    let matchedArtist: string | null = null;

    for (const track of release.tracks) {
      if (!track.wavQuarantineKey) {
        return err(
          createDomainError({
            code: 'FORENSIC_REJECTED',
            moduleName: 'RunReleaseForensicScanUseCase',
            message: `El track #${track.trackNumber} no tiene archivo WAV en cuarentena.`,
          }),
        );
      }

      const wavBuffer = await readFile(
        join(baseQuarantine, track.wavQuarantineKey),
      ).catch(() => null);

      if (!wavBuffer) {
        return err(
          createDomainError({
            code: 'FORENSIC_REJECTED',
            moduleName: 'RunReleaseForensicScanUseCase',
            message: `No se pudo leer el archivo WAV del track #${track.trackNumber}.`,
          }),
        );
      }

      const signalCheck = analyzePcmAudioSignalForensics({
        wavBuffer,
        bitDepth: track.bitDepth ?? 16,
      });

      if (!signalCheck.ok) {
        await params.prisma.release.update({
          where: { id: release.id },
          data: { status: 'REJECTED' },
        });
        return signalCheck;
      }

      if (signalCheck.value.silenceRatio > maxSilenceRatio) {
        maxSilenceRatio = signalCheck.value.silenceRatio;
      }

      const acrRes = await params.acrScanner.identifyAudioSnippet({
        wavBuffer,
        ...(params.payload.simulatedAcrCloudScore !== undefined
          ? { simulatedScore: params.payload.simulatedAcrCloudScore }
          : {}),
        ...(params.payload.simulatedMatchedTitle !== undefined
          ? { simulatedMatchedTitle: params.payload.simulatedMatchedTitle }
          : {}),
        ...(params.payload.simulatedMatchedArtist !== undefined
          ? { simulatedMatchedArtist: params.payload.simulatedMatchedArtist }
          : {}),
      });
      if (!acrRes.ok) {
        return acrRes;
      }

      const trackVerdict = evaluateAcrCloudCopyrightVerdict({
        scorePercent: acrRes.value.scorePercent,
        matchedTitle: acrRes.value.matchedTitle,
        matchedArtist: acrRes.value.matchedArtist,
      });

      await params.prisma.track.update({
        where: { id: track.id },
        data: {
          acrCloudScore: trackVerdict.normalizedScore,
          acrCloudVerdict: trackVerdict.verdictTier,
        },
      });

      if (trackVerdict.normalizedScore >= maxAcrScore) {
        maxAcrScore = trackVerdict.normalizedScore;
        matchedTitle = acrRes.value.matchedTitle;
        matchedArtist = acrRes.value.matchedArtist;
      }
    }

    const overallOutcome = evaluateAcrCloudCopyrightVerdict({
      scorePercent: maxAcrScore,
      matchedTitle,
      matchedArtist,
    });

    const fsmCheck = validateReleaseStateTransition(
      'FORENSIC_PROCESSING',
      overallOutcome.targetReleaseStatus,
    );
    if (!fsmCheck.ok) {
      return fsmCheck;
    }

    const savedReport = await params.prisma.$transaction(async (tx) => {
      await tx.release.update({
        where: { id: release.id },
        data: {
          status: overallOutcome.targetReleaseStatus,
          artworkVerified: true,
          blockUgcMonetization: overallOutcome.blockUgcMonetization,
        },
      });

      const report = await tx.forensicScanReport.create({
        data: {
          releaseId: release.id,
          tenantId: release.tenantId,
          artworkWidthPx: artworkCheck.value.widthPx,
          artworkHeightPx: artworkCheck.value.heightPx,
          artworkColorSpace: artworkCheck.value.colorSpace,
          artworkPassed: true,
          audioSilenceMaxRatio: maxSilenceRatio,
          audioSignalPassed: true,
          maxAcrCloudScore: overallOutcome.normalizedScore,
          acrCloudVerdict: overallOutcome.verdictTier,
          matchedTitle,
          matchedArtist,
          summaryReason: overallOutcome.explanation,
        },
      });

      await tx.complianceAuditLog.create({
        data: {
          actorUserId: params.actorUserId,
          targetTenantId: release.tenantId,
          action: `FORENSIC_VERDICT_${overallOutcome.verdictTier}`,
          entityType: 'RELEASE',
          entityId: release.id,
          details: `Score=${overallOutcome.normalizedScore}%; NextStatus=${overallOutcome.targetReleaseStatus}; BlockUGC=${overallOutcome.blockUgcMonetization}`,
          ...(params.ip !== undefined ? { ip: params.ip } : {}),
        },
      });

      return report;
    });

    return ok({
      id: savedReport.id,
      releaseId: release.id,
      artworkWidthPx: savedReport.artworkWidthPx,
      artworkHeightPx: savedReport.artworkHeightPx,
      artworkColorSpace: savedReport.artworkColorSpace,
      artworkPassed: savedReport.artworkPassed,
      audioSilenceMaxRatio: savedReport.audioSilenceMaxRatio,
      audioSignalPassed: savedReport.audioSignalPassed,
      maxAcrCloudScore: savedReport.maxAcrCloudScore,
      acrCloudVerdict: overallOutcome.verdictTier,
      matchedTitle: savedReport.matchedTitle,
      matchedArtist: savedReport.matchedArtist,
      summaryReason: savedReport.summaryReason,
      resultingReleaseStatus: overallOutcome.targetReleaseStatus,
      blockUgcMonetization: overallOutcome.blockUgcMonetization,
      hasUploadedLicensePdf: Boolean(release.licenseDocumentKey),
      createdAt: savedReport.createdAt.toISOString(),
    });
  });
}
