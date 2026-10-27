import type { RevelatorV2ReleasePayload } from '@wave/domain-core';

export interface RevelatorUnpromptedTokenResult {
  readonly accessToken: string;
  readonly fromCache: boolean;
  readonly expiresAtIso: string;
}

export interface RevelatorV2DispatchResult {
  readonly revelatorReleaseId: number;
  readonly inspectionStatus: 'PASSED_QUEUED_FOR_DSPS';
  readonly distributedStores: readonly string[];
}

export interface RevelatorGatewayPort {
  /**
   * Acquires an 8-hour Unprompted Auth session token for a Revelator Child Account
   * via V1 `POST /partner/account/login` (or returns the cached token if still valid).
   */
  acquireUnpromptedChildToken(params: {
    tenantId: string;
    revelatorEnterpriseId: number;
    revelatorUserId: string;
  }): Promise<RevelatorUnpromptedTokenResult>;

  /**
   * Dispatches a release to Revelator V2 (`POST /v2/distribution/releases` +
   * `POST /v2/distribution/release/inspectanddistribute`), guarded by Circuit Breaker.
   */
  ingestAndDistributeRelease(params: {
    accessToken: string;
    payload: RevelatorV2ReleasePayload;
  }): Promise<RevelatorV2DispatchResult>;
}
