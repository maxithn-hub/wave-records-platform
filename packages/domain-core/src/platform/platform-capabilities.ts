export type RuntimeTarget = 'WEB_DESKTOP' | 'WEB_MOBILE' | 'CAPACITOR_ANDROID';

export interface PlatformCapabilities {
  readonly runtimeTarget: RuntimeTarget;
  /** True only on Web Desktop; disabled on Capacitor Android to prevent heavy .wav cellular/memory crashes */
  readonly canUploadLosslessWav: boolean;
  readonly canUploadHighResArtwork: boolean;
  readonly canManageCatalogDrafts: boolean;
  readonly canApproveSplits: boolean;
  readonly canRequestRoyaltyPayout: boolean;
  readonly canViewAnalyticsAndTrends: boolean;
  readonly canAccessAdminBackoffice: boolean;
  readonly supportsNativePushNotifications: boolean;
}

/**
 * Resolves platform capabilities cleanly so the exact same Web codebase
 * can later be wrapped into an Android app via Capacitor without structural rewrites.
 */
export function resolvePlatformCapabilities(target: RuntimeTarget): PlatformCapabilities {
  switch (target) {
    case 'CAPACITOR_ANDROID':
      return {
        runtimeTarget: 'CAPACITOR_ANDROID',
        canUploadLosslessWav: false,
        canUploadHighResArtwork: false,
        canManageCatalogDrafts: false,
        canApproveSplits: true,
        canRequestRoyaltyPayout: true,
        canViewAnalyticsAndTrends: true,
        canAccessAdminBackoffice: false,
        supportsNativePushNotifications: true,
      };
    case 'WEB_MOBILE':
      return {
        runtimeTarget: 'WEB_MOBILE',
        canUploadLosslessWav: false,
        canUploadHighResArtwork: true,
        canManageCatalogDrafts: true,
        canApproveSplits: true,
        canRequestRoyaltyPayout: true,
        canViewAnalyticsAndTrends: true,
        canAccessAdminBackoffice: false,
        supportsNativePushNotifications: false,
      };
    case 'WEB_DESKTOP':
    default:
      return {
        runtimeTarget: 'WEB_DESKTOP',
        canUploadLosslessWav: true,
        canUploadHighResArtwork: true,
        canManageCatalogDrafts: true,
        canApproveSplits: true,
        canRequestRoyaltyPayout: true,
        canViewAnalyticsAndTrends: true,
        canAccessAdminBackoffice: true,
        supportsNativePushNotifications: false,
      };
  }
}
