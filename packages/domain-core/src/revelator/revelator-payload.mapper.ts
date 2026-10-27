export const STANDARD_STREAMING_DSP_TARGETS = [
  'SPOTIFY',
  'APPLE_MUSIC',
  'AMAZON_MUSIC',
  'DEEZER',
  'TIDAL',
  'YOUTUBE_MUSIC',
  'TIKTOK_MUSIC',
  'META_AUDIO_LIBRARY',
] as const;

export const UGC_CONTENT_ID_MONETIZATION_TARGETS = [
  'YOUTUBE_CONTENT_ID',
  'TIKTOK_SOUND_MONETIZATION',
  'META_RIGHTS_MANAGER',
] as const;

export interface RevelatorV2TrackPayload {
  readonly trackNumber: number;
  readonly title: string;
  readonly versionTitle: string | null;
  readonly primaryArtist: string;
  readonly isrcCode: string;
  readonly isExplicit: boolean;
  readonly isInstrumental: boolean;
  readonly audioLanguage: string;
  readonly wavSha256Hash: string;
  readonly sampleRateHz: number;
  readonly bitDepth: number;
  readonly durationSeconds: number;
}

export interface RevelatorV2ReleasePayload {
  readonly partnerEnterpriseId: number;
  readonly partnerUserId: string;
  readonly partnerPlanType: string;
  readonly externalReleaseRefId: string;
  readonly title: string;
  readonly versionTitle: string | null;
  readonly primaryArtist: string;
  readonly releaseType: string;
  readonly primaryGenre: string;
  readonly upcCode: string | null;
  readonly pLine: { readonly year: number; readonly owner: string };
  readonly cLine: { readonly year: number; readonly owner: string };
  readonly artworkSha256Hash: string;
  readonly rightsManagement: {
    readonly blockUgcMonetization: boolean;
    readonly ugcMonetizationPolicy: 'MONETIZE_ALL' | 'BLOCKED_BEAT_LEASE_GREY_AREA';
  };
  readonly targetDspStores: readonly string[];
  readonly tracks: readonly RevelatorV2TrackPayload[];
}

/**
 * Pure domain mapper for Revelator API V2 (/v2/distribution/releases & /v2/distribution/release/inspectanddistribute).
 * Automatically enforces UGC Content-ID Monetization exclusion when ACRCloud detected a 45%-79% Grey Area match.
 */
export function buildRevelatorV2ReleasePayload(params: {
  revelatorEnterpriseId: number;
  revelatorUserId: string;
  revelatorPlanType: string;
  releaseId: string;
  title: string;
  versionTitle: string | null;
  primaryArtist: string;
  releaseType: string;
  primaryGenre: string;
  upcCode: string | null;
  pLineYear: number;
  pLineOwner: string;
  cLineYear: number;
  cLineOwner: string;
  artworkSha256Hash: string;
  blockUgcMonetization: boolean;
  tracks: readonly RevelatorV2TrackPayload[];
}): RevelatorV2ReleasePayload {
  const targetDspStores = params.blockUgcMonetization
    ? [...STANDARD_STREAMING_DSP_TARGETS]
    : [...STANDARD_STREAMING_DSP_TARGETS, ...UGC_CONTENT_ID_MONETIZATION_TARGETS];

  return {
    partnerEnterpriseId: params.revelatorEnterpriseId,
    partnerUserId: params.revelatorUserId,
    partnerPlanType: params.revelatorPlanType,
    externalReleaseRefId: params.releaseId,
    title: params.title,
    versionTitle: params.versionTitle,
    primaryArtist: params.primaryArtist,
    releaseType: params.releaseType,
    primaryGenre: params.primaryGenre,
    upcCode: params.upcCode,
    pLine: {
      year: params.pLineYear,
      owner: params.pLineOwner,
    },
    cLine: {
      year: params.cLineYear,
      owner: params.cLineOwner,
    },
    artworkSha256Hash: params.artworkSha256Hash,
    rightsManagement: {
      blockUgcMonetization: params.blockUgcMonetization,
      ugcMonetizationPolicy: params.blockUgcMonetization
        ? 'BLOCKED_BEAT_LEASE_GREY_AREA'
        : 'MONETIZE_ALL',
    },
    targetDspStores,
    tracks: params.tracks,
  };
}
