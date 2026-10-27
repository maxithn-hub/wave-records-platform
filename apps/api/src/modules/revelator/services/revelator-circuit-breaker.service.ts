export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Fault-isolating Circuit Breaker for external Revelator API V1/V2 calls.
 * Opens after `failureThreshold` consecutive failures and prevents cascading timeouts.
 */
export class RevelatorCircuitBreakerService {
  private state: CircuitBreakerState = 'CLOSED';
  private consecutiveFailures = 0;
  private openedAtMs = 0;

  constructor(
    private readonly failureThreshold = 2,
    private readonly cooldownMs = 30_000,
  ) {}

  getState(nowMs = Date.now()): CircuitBreakerState {
    if (this.state === 'OPEN' && nowMs - this.openedAtMs >= this.cooldownMs) {
      this.state = 'HALF_OPEN';
    }
    return this.state;
  }

  async execute<T>(operation: () => Promise<T>, nowMs = Date.now()): Promise<T> {
    const currentState = this.getState(nowMs);
    if (currentState === 'OPEN') {
      throw new Error('REVELATOR_CIRCUIT_OPEN: El Circuit Breaker de Revelator API está ABIERTO temporalmente por fallos consecutivos.');
    }

    try {
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(nowMs);
      throw error;
    }
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = 'CLOSED';
  }

  recordFailure(nowMs = Date.now()): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.openedAtMs = nowMs;
    }
  }

  reset(): void {
    this.consecutiveFailures = 0;
    this.state = 'CLOSED';
    this.openedAtMs = 0;
  }
}
