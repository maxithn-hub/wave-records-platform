import type { Result } from '@wave/contracts';

export interface AssembledQuarantineAsset {
  readonly quarantineObjectKey: string;
  readonly actualSha256Hex: string;
  readonly totalBytes: number;
  readonly headerSampleBuffer: Buffer;
}

/**
 * Port for Chunked / Multipart Quarantine Ingest Storage.
 * Supports local disk chunk assembly in development and S3/R2 Multipart Upload in cloud deployment.
 */
export interface QuarantineMultipartStoragePort {
  writeUploadChunk(params: {
    uploadSessionId: string;
    partNumber: number;
    chunkBuffer: Buffer;
  }): Promise<Result<{ partNumber: number; byteLength: number }>>;

  assembleAndVerifyMultipartUpload(params: {
    uploadSessionId: string;
    tenantId: string;
    releaseId: string;
    totalParts: number;
    expectedSha256Hex: string;
    extension: 'wav' | 'img';
  }): Promise<Result<AssembledQuarantineAsset>>;
}
