import { createHmac } from 'node:crypto';

export interface AcrCloudSignedHeaders {
  readonly httpMethod: 'POST';
  readonly httpUri: '/v1/identify';
  readonly dataType: 'audio';
  readonly signatureVersion: '1';
  readonly timestampSeconds: string;
  readonly signatureBase64: string;
}

/**
 * Generates the official HMAC-SHA1 signature required by ACRCloud REST API v1 (/v1/identify).
 */
export function buildAcrCloudHmacSha1Signature(params: {
  accessKey: string;
  accessSecret: string;
  timestampSeconds?: number;
}): AcrCloudSignedHeaders {
  const ts = String(params.timestampSeconds ?? Math.floor(Date.now() / 1000));
  const stringToSign = [
    'POST',
    '/v1/identify',
    params.accessKey,
    'audio',
    '1',
    ts,
  ].join('\n');

  const signatureBase64 = createHmac('sha1', params.accessSecret)
    .update(Buffer.from(stringToSign, 'utf8'))
    .digest('base64');

  return {
    httpMethod: 'POST',
    httpUri: '/v1/identify',
    dataType: 'audio',
    signatureVersion: '1',
    timestampSeconds: ts,
    signatureBase64,
  };
}

/**
 * Extracts a 15-second PCM audio slice from the middle of a WAV buffer for ACRCloud fingerprinting.
 */
export function extractFifteenSecondAudioSnippet(params: {
  wavBuffer: Buffer;
  sampleRateHz: number;
  channels: number;
  bitDepth: number;
}): Buffer {
  const bytesPerSecond =
    params.sampleRateHz * params.channels * (params.bitDepth / 8);
  const fifteenSecondsBytes = bytesPerSecond * 15;

  if (params.wavBuffer.byteLength <= 44 + fifteenSecondsBytes) {
    return params.wavBuffer;
  }

  const header = params.wavBuffer.subarray(0, 44);
  const payload = params.wavBuffer.subarray(44);
  const midStart = Math.floor((payload.byteLength - fifteenSecondsBytes) / 2);
  const alignedStart = midStart - (midStart % (params.channels * (params.bitDepth / 8)));
  const slice = payload.subarray(alignedStart, alignedStart + fifteenSecondsBytes);

  const newHeader = Buffer.from(header);
  newHeader.writeUInt32LE(36 + slice.byteLength, 4);
  newHeader.writeUInt32LE(slice.byteLength, 40);

  return Buffer.concat([newHeader, slice]);
}
