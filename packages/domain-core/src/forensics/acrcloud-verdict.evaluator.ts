import type { AcrCloudVerdictTier, ReleaseStatus } from '@wave/contracts';

export interface AcrCloudEvaluationOutcome {
  readonly normalizedScore: number;
  readonly verdictTier: AcrCloudVerdictTier;
  readonly targetReleaseStatus: ReleaseStatus;
  readonly blockUgcMonetization: boolean;
  readonly requiresBeatLicensePdf: boolean;
  readonly explanation: string;
}

/**
 * Evaluates ACRCloud audio fingerprinting score according to Wave Records LLC's
 * 3-tier anti-fraud & copyright policy:
 * - Score >= 80%: HARD_REJECT_COPYRIGHT -> REJECTED
 * - Score 45% - 79%: GREY_AREA_MANUAL_UGC_BLOCK -> MANUAL_COPYRIGHT_REVIEW + blocks UGC (YouTube CID, TikTok, Meta) + requires PDF license
 * - Score < 45% (or code 1001): CLEAN_PASS -> MODERATION_QUEUE
 */
export function evaluateAcrCloudCopyrightVerdict(params: {
  scorePercent: number;
  matchedTitle?: string | null;
  matchedArtist?: string | null;
}): AcrCloudEvaluationOutcome {
  const score = Math.max(0, Math.min(100, Math.round(params.scorePercent)));
  const matchLabel = params.matchedTitle
    ? ` (Coincidencia detectada: "${params.matchedTitle}" de ${params.matchedArtist ?? 'Artista Desconocido'})`
    : '';

  if (score >= 80) {
    return {
      normalizedScore: score,
      verdictTier: 'HARD_REJECT_COPYRIGHT',
      targetReleaseStatus: 'REJECTED',
      blockUgcMonetization: true,
      requiresBeatLicensePdf: false,
      explanation: `Rechazo automático por infracción de copyright (ACRCloud Score: ${score}% >= 80%)${matchLabel}.`,
    };
  }

  if (score >= 45) {
    return {
      normalizedScore: score,
      verdictTier: 'GREY_AREA_MANUAL_UGC_BLOCK',
      targetReleaseStatus: 'MANUAL_COPYRIGHT_REVIEW',
      blockUgcMonetization: true,
      requiresBeatLicensePdf: true,
      explanation: `Alerta de Zona Gris por posible uso de Type Beat o Sample no exclusivo (ACRCloud Score: ${score}%)${matchLabel}. Se bloqueó automáticamente la monetización UGC (YouTube Content ID, TikTok, Meta Rights Manager) y se exige subir Licencia en PDF.`,
    };
  }

  return {
    normalizedScore: score,
    verdictTier: 'CLEAN_PASS',
    targetReleaseStatus: 'MODERATION_QUEUE',
    blockUgcMonetization: false,
    requiresBeatLicensePdf: false,
    explanation: `Escaneo acústico ACRCloud limpio (Score: ${score}% < 45%). Aprobado para pasar a la cola de moderación interna.`,
  };
}
