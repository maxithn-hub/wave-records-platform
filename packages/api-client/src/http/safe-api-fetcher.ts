import type { ZodType } from 'zod';
import { type Result, ok, err, createDomainError } from '@wave/contracts';

export interface SafeFetchRequestOptions<TSchema> {
  readonly endpoint: string;
  readonly method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly body?: unknown;
  readonly responseSchema: ZodType<TSchema>;
  readonly idempotencyKey?: string;
  readonly moduleName: string;
  readonly timeoutMs?: number;
  readonly headers?: Readonly<Record<string, string>>;
}

/**
 * Defensive Network Boundary:
 * Never throws unhandled Promises into UI components.
 * Validates every backend payload with Zod.safeParse so malformed data
 * from one endpoint is isolated to its caller module.
 */
export async function safeApiFetch<TSchema>(
  options: SafeFetchRequestOptions<TSchema>,
): Promise<Result<TSchema>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000);

  try {
    const requestHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.idempotencyKey !== undefined
        ? { 'Idempotency-Key': options.idempotencyKey }
        : {}),
      ...(options.headers ?? {}),
    };

    const response = await fetch(options.endpoint, {
      method: options.method ?? 'GET',
      headers: requestHeaders,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      signal: controller.signal,
    });

    const rawJson: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return err(
        createDomainError({
          code: response.status === 401 ? 'UNAUTHORIZED' : 'NETWORK_BOUNDARY_ERROR',
          moduleName: options.moduleName,
          message: `HTTP ${response.status} al invocar ${options.endpoint}`,
        }),
      );
    }

    const parsed = options.responseSchema.safeParse(rawJson);
    if (!parsed.success) {
      return err(
        createDomainError({
          code: 'VALIDATION_ERROR',
          moduleName: options.moduleName,
          message: `El contrato de respuesta de ${options.endpoint} no superó la validación defensiva Zod.`,
        }),
      );
    }

    return ok(parsed.data);
  } catch (caughtError: unknown) {
    const message =
      caughtError instanceof Error ? caughtError.message : 'Fallo de red desconocido';
    return err(
      createDomainError({
        code: 'NETWORK_BOUNDARY_ERROR',
        moduleName: options.moduleName,
        message: `Error de red aislado en módulo "${options.moduleName}": ${message}`,
      }),
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
