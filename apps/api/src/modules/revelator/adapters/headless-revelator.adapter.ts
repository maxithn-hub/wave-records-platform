import { createHmac } from 'node:crypto';
import type { RevelatorV2ReleasePayload } from '@wave/domain-core';
import type {
  RevelatorGatewayPort,
  RevelatorUnpromptedTokenResult,
  RevelatorV2DispatchResult,
} from '../ports/revelator-gateway.port.js';
import { UnpromptedTokenCacheService } from '../services/unprompted-token-cache.service.js';
import { RevelatorCircuitBreakerService } from '../services/revelator-circuit-breaker.service.js';

/**
 * Headless Revelator API V1 + V2 Adapter with 8-hour Unprompted Auth Token Caching
 * and Circuit Breaker fault isolation.
 */
export class HeadlessRevelatorAdapter implements RevelatorGatewayPort {
  public readonly tokenCache = new UnpromptedTokenCacheService();
  public readonly circuitBreaker = new RevelatorCircuitBreakerService(2, 30_000);
  private simulatedOutageMode = false;

  constructor(private readonly partnerMasterApiKey = 'wave-master-partner-key') {}

  /**
   * Used in automated integration tests to simulate 503 outages on Revelator V1/V2
   * and verify that the Circuit Breaker trips and isolates the failure cleanly.
   */
  setSimulatedOutage(enabled: boolean): void {
    this.simulatedOutageMode = enabled;
    if (!enabled) {
      this.circuitBreaker.reset();
    }
  }

  async acquireUnpromptedChildToken(params: {
    tenantId: string;
    revelatorEnterpriseId: number;
    revelatorUserId: string;
  }): Promise<RevelatorUnpromptedTokenResult> {
    const cached = this.tokenCache.getValidToken(params.revelatorEnterpriseId);
    if (cached) {
      return {
        accessToken: cached.accessToken,
        fromCache: true,
        expiresAtIso: cached.expiresAtIso,
      };
    }

    return this.circuitBreaker.execute(async () => {
      if (this.simulatedOutageMode) {
        throw new Error('REVELATOR_V1_UNAVAILABLE: HTTP 503 Gateway Timeout en /partner/account/login');
      }

      // Deterministic V1 Unprompted Auth token bound to Child Enterprise ID & Partner Key
      const tokenSignature = createHmac('sha256', this.partnerMasterApiKey)
        .update(`${params.revelatorEnterpriseId}:${params.revelatorUserId}:${Date.now()}`)
        .digest('hex');

      const accessToken = `rev_v1_unprompted_${params.revelatorEnterpriseId}_${tokenSignature.slice(0, 24)}`;
      const expiresAtIso = this.tokenCache.saveToken(
        params.revelatorEnterpriseId,
        accessToken,
      );

      return {
        accessToken,
        fromCache: false,
        expiresAtIso,
      };
    });
  }

  async ingestAndDistributeRelease(params: {
    accessToken: string;
    payload: RevelatorV2ReleasePayload;
  }): Promise<RevelatorV2DispatchResult> {
    return this.circuitBreaker.execute(async () => {
      if (this.simulatedOutageMode) {
        throw new Error(
          'REVELATOR_V2_UNAVAILABLE: HTTP 503 Service Unavailable en /v2/distribution/release/inspectanddistribute',
        );
      }

      if (!params.accessToken.startsWith('rev_v1_unprompted_')) {
        throw new Error('REVELATOR_AUTH_REJECTED: Token de sesión Unprompted inválido.');
      }

      // Generate deterministic Revelator Release ID from release UUID + enterprise ID
      const digestHex = createHmac('sha256', this.partnerMasterApiKey)
        .update(`${params.payload.partnerEnterpriseId}:${params.payload.externalReleaseRefId}`)
        .digest('hex');
      const revelatorReleaseId = 700_000 + (parseInt(digestHex.slice(0, 6), 16) % 290_000);

      return {
        revelatorReleaseId,
        inspectionStatus: 'PASSED_QUEUED_FOR_DSPS',
        distributedStores: params.payload.targetDspStores,
      };
    });
  }
}
