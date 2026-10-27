import { randomUUID } from 'node:crypto';
import { type Result, err, createDomainError } from '@wave/contracts';

/**
 * Wraps any backend use-case execution in a fault-isolated boundary.
 * Ensures an unexpected runtime exception inside a single use-case never crashes
 * the Node.js event loop and never leaks internal stack traces to the client.
 */
export async function executeIsolatedUseCase<T>(
  moduleName: string,
  operation: () => Promise<Result<T>>,
): Promise<Result<T>> {
  const traceId = randomUUID();
  try {
    return await operation();
  } catch (unhandledError: unknown) {
    const safeMessage =
      unhandledError instanceof Error
        ? unhandledError.message
        : 'Error interno aislado en módulo del servidor';

    return err(
      createDomainError({
        code: 'INTERNAL_MODULE_FAULT',
        moduleName,
        traceId,
        message: `[Aislamiento Backend - ${moduleName}] Operación contenida de forma segura: ${safeMessage}`,
      }),
    );
  }
}
