import { type Result, ok, err, createDomainError } from '@wave/contracts';
import type { WaveQueueName } from '../queues/queue-names.constant.js';

export interface IsolatedJobEnvelope<TPayload> {
  readonly jobId: string;
  readonly queueName: WaveQueueName;
  readonly tenantId: string;
  readonly payload: TPayload;
  readonly attemptNumber: number;
}

export interface DeadLetterRecord<TPayload> {
  readonly originalJob: IsolatedJobEnvelope<TPayload>;
  readonly failureReason: string;
  readonly isolatedAtIso: string;
}

/**
 * Executes an asynchronous media/forensic job inside a bulkhead wrapper.
 * If FFmpeg, Sharp, or ACRCloud throws or times out, the error is captured
 * and converted into a Dead-Letter record without crashing the worker host process.
 */
export async function runSandboxedWorkerJob<TPayload, TOutput>(
  job: IsolatedJobEnvelope<TPayload>,
  processor: (payload: TPayload) => Promise<Result<TOutput>>,
  onDeadLetter?: (record: DeadLetterRecord<TPayload>) => Promise<void>,
): Promise<Result<TOutput>> {
  try {
    const result = await processor(job.payload);
    if (!result.ok && onDeadLetter) {
      await onDeadLetter({
        originalJob: job,
        failureReason: result.error.message,
        isolatedAtIso: new Date().toISOString(),
      });
    }
    return result;
  } catch (fatalWorkerError: unknown) {
    const reason =
      fatalWorkerError instanceof Error
        ? fatalWorkerError.message
        : 'Pánico inesperado en procesador de Worker';

    if (onDeadLetter) {
      await onDeadLetter({
        originalJob: job,
        failureReason: reason,
        isolatedAtIso: new Date().toISOString(),
      });
    }

    return err(
      createDomainError({
        code: 'INTERNAL_MODULE_FAULT',
        moduleName: `WorkerSandbox:${job.queueName}`,
        message: `Fallo aislado en Job ${job.jobId}: ${reason}`,
      }),
    );
  }
}
