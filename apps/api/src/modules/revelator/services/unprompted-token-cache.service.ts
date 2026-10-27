interface CachedUnpromptedTokenEntry {
  readonly accessToken: string;
  readonly expiresAtMs: number;
}

/**
 * Caches Revelator V1 Unprompted Auth tokens (`POST /partner/account/login`).
 * Revelator V1 tokens have an 8-hour lifetime; we cache for 7h 50m (470 minutes)
 * to guarantee tokens never expire mid-flight during a V2 release dispatch.
 */
export class UnpromptedTokenCacheService {
  private readonly store = new Map<string, CachedUnpromptedTokenEntry>();
  private static readonly SAFE_TTL_MS = (7 * 60 + 50) * 60 * 1000; // 7h 50m

  getValidToken(
    revelatorEnterpriseId: number,
    nowMs = Date.now(),
  ): { accessToken: string; expiresAtIso: string } | null {
    const key = `rev:unprompted:${revelatorEnterpriseId}`;
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAtMs <= nowMs) {
      this.store.delete(key);
      return null;
    }
    return {
      accessToken: entry.accessToken,
      expiresAtIso: new Date(entry.expiresAtMs).toISOString(),
    };
  }

  saveToken(
    revelatorEnterpriseId: number,
    accessToken: string,
    nowMs = Date.now(),
  ): string {
    const key = `rev:unprompted:${revelatorEnterpriseId}`;
    const expiresAtMs = nowMs + UnpromptedTokenCacheService.SAFE_TTL_MS;
    this.store.set(key, { accessToken, expiresAtMs });
    return new Date(expiresAtMs).toISOString();
  }

  invalidateToken(revelatorEnterpriseId: number): void {
    this.store.delete(`rev:unprompted:${revelatorEnterpriseId}`);
  }
}
