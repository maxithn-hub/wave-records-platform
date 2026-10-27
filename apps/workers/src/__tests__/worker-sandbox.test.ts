import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVE_BULLMQ_QUEUES,
  runSandboxedWorkerJob,
  buildAcrCloudHmacSha1Signature,
  type DeadLetterRecord,
} from '../main.js';

describe('@wave/workers - Phase 0 & 3 Process Isolation, Dead Letter Sandbox & ACRCloud HMAC-SHA1', () => {
  it('generates deterministic HMAC-SHA1 signature for ACRCloud /v1/identify', () => {
    const signed = buildAcrCloudHmacSha1Signature({
      accessKey: 'test_acr_key',
      accessSecret: 'test_acr_secret',
      timestampSeconds: 1700000000,
    });
    assert.equal(signed.httpUri, '/v1/identify');
    assert.equal(signed.signatureVersion, '1');
    assert.ok(signed.signatureBase64.length > 10);
  });
  it('captures corrupted media worker crashes and routes job to Dead Letter Queue without crashing host', async () => {
    const dlqRecords: DeadLetterRecord<{ fileKey: string }>[] = [];

    const result = await runSandboxedWorkerJob(
      {
        jobId: 'job-wav-001',
        queueName: WAVE_BULLMQ_QUEUES.AUDIO_FORENSICS_FFMPEG,
        tenantId: 'tenant-123',
        payload: { fileKey: 'quarantine/corrupted-header.wav' },
        attemptNumber: 1,
      },
      async () => {
        throw new Error('FFmpeg exit code 139: Segmentation fault on malformed RIFF header');
      },
      async (record) => {
        dlqRecords.push(record);
      },
    );

    assert.equal(result.ok, false);
    assert.equal(dlqRecords.length, 1);
    assert.equal(dlqRecords[0]?.originalJob.jobId, 'job-wav-001');
  });
});
