import {
  type ReleaseType,
  type Result,
  ok,
  err,
  createDomainError,
} from '@wave/contracts';

export interface DdexReleaseCandidate {
  readonly releaseType: ReleaseType;
  readonly title: string;
  readonly primaryArtist: string;
  readonly artworkQuarantineKey: string | null;
  readonly tracks: readonly {
    readonly trackNumber: number;
    readonly title: string;
    readonly isrcCode: string | null;
    readonly wavQuarantineKey: string | null;
    readonly wavSha256Hash: string | null;
  }[];
}

/**
 * Validates that a Release and all its Tracks satisfy DDEX completeness
 * before allowing transition to FORENSIC_PROCESSING.
 */
export function validateDdexReleaseCompleteness(
  candidate: DdexReleaseCandidate,
): Result<{ verifiedTrackCount: number }> {
  if (!candidate.artworkQuarantineKey) {
    return err(
      createDomainError({
        code: 'VALIDATION_ERROR',
        moduleName: 'DdexReleaseValidator',
        message: 'El lanzamiento debe tener una portada subida en el bucket de cuarentena.',
      }),
    );
  }

  const trackCount = candidate.tracks.length;
  if (trackCount === 0) {
    return err(
      createDomainError({
        code: 'VALIDATION_ERROR',
        moduleName: 'DdexReleaseValidator',
        message: 'El lanzamiento debe incluir al menos un track de audio.',
      }),
    );
  }

  if (candidate.releaseType === 'SINGLE' && trackCount !== 1) {
    return err(
      createDomainError({
        code: 'VALIDATION_ERROR',
        moduleName: 'DdexReleaseValidator',
        message: `Un lanzamiento de tipo SINGLE debe tener exactamente 1 track (actual: ${trackCount}).`,
      }),
    );
  }

  if (candidate.releaseType === 'EP' && (trackCount < 2 || trackCount > 6)) {
    return err(
      createDomainError({
        code: 'VALIDATION_ERROR',
        moduleName: 'DdexReleaseValidator',
        message: `Un lanzamiento de tipo EP debe contener entre 2 y 6 tracks (actual: ${trackCount}).`,
      }),
    );
  }

  for (const track of candidate.tracks) {
    if (!track.isrcCode) {
      return err(
        createDomainError({
          code: 'VALIDATION_ERROR',
          moduleName: 'DdexReleaseValidator',
          message: `El track #${track.trackNumber} ("${track.title}") no tiene un código ISRC asignado.`,
        }),
      );
    }

    if (!track.wavQuarantineKey || !track.wavSha256Hash) {
      return err(
        createDomainError({
          code: 'VALIDATION_ERROR',
          moduleName: 'DdexReleaseValidator',
          message: `El track #${track.trackNumber} ("${track.title}") no tiene su archivo maestro .WAV verificado por SHA-256.`,
        }),
      );
    }
  }

  return ok({ verifiedTrackCount: trackCount });
}
