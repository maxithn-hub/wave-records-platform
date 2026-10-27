import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { rm } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { loadApiEnv } from '../config/env.schema.js';
import { getPrismaClient } from '../infrastructure/prisma/prisma.service.js';
import { createWaveApiApp } from '../http/create-app.js';
import { cleanWaveTestDatabase } from './test-db-cleaner.js';

/**
 * Generates a synthetic PNG buffer with an authentic IHDR chunk specifying width, height, and colorType.
 * colorType = 2 -> RGB Truecolor
 */
function createSyntheticPngHeaderBuffer(params: {
  widthPx: number;
  heightPx: number;
  colorType?: number;
}): Buffer {
  const buf = Buffer.alloc(64);
  // PNG 8-byte signature
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  // IHDR chunk length (13) + 'IHDR'
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(params.widthPx, 16);
  buf.writeUInt32BE(params.heightPx, 20);
  buf[24] = 8; // bit depth 8
  buf[25] = params.colorType ?? 2; // 2 = Truecolor RGB
  return buf;
}

/**
 * Generates a synthetic 16-bit Stereo 44.1kHz WAV buffer with either dynamic sine-like samples or silence.
 */
function createSyntheticDynamicOrSilentWav(params: {
  silent: boolean;
}): Buffer {
  const sampleRateHz = 44100;
  const channels = 2;
  const bitDepth = 16;
  const numSamples = 4000;
  const pcmPayloadBytes = numSamples * 2;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcmPayloadBytes, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRateHz, 24);
  header.writeUInt32LE(sampleRateHz * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcmPayloadBytes, 40);

  const pcm = Buffer.alloc(pcmPayloadBytes);
  if (!params.silent) {
    for (let i = 0; i < numSamples; i++) {
      // Dynamic varying musical wave amplitude (-18000 to +18000)
      const val = Math.round(Math.sin(i * 0.15) * 18000);
      pcm.writeInt16LE(val, i * 2);
    }
  }

  return Buffer.concat([header, pcm]);
}

async function seedReleaseInForensicProcessing(params: {
  app: FastifyInstance;
  token: string;
  title: string;
  isrcCode: string;
  artworkBuffer: Buffer;
  wavBuffer: Buffer;
}): Promise<string> {
  const createRes = await params.app.inject({
    method: 'POST',
    url: '/catalog/releases',
    headers: { authorization: `Bearer ${params.token}` },
    payload: {
      title: params.title,
      primaryArtist: 'Forensic Test Artist',
      releaseType: 'SINGLE',
      primaryGenre: 'Trap / Urbano',
      pLineYear: 2026,
      pLineOwner: 'Forensic Test Artist',
      cLineYear: 2026,
      cLineOwner: 'Forensic Test Artist',
    },
  });
  const releaseId: string = createRes.json().value.releaseId;

  const trackRes = await params.app.inject({
    method: 'POST',
    url: `/catalog/releases/${releaseId}/tracks`,
    headers: { authorization: `Bearer ${params.token}` },
    payload: {
      trackNumber: 1,
      title: params.title,
      primaryArtist: 'Forensic Test Artist',
      isExplicit: true,
      isInstrumental: false,
      audioLanguage: 'es',
      isrcCode: params.isrcCode,
    },
  });
  const trackId: string = trackRes.json().value.trackId;

  // Upload WAV
  const wavSha = createHash('sha256').update(params.wavBuffer).digest('hex');
  const initWav = await params.app.inject({
    method: 'POST',
    url: '/catalog/uploads/init',
    headers: { authorization: `Bearer ${params.token}` },
    payload: {
      releaseId,
      trackId,
      assetKind: 'TRACK_WAV',
      fileName: 'track.wav',
      expectedByteSize: params.wavBuffer.byteLength,
      expectedSha256Hex: wavSha,
      totalParts: 1,
    },
  });
  const wavSessionId: string = initWav.json().value.uploadSessionId;
  await params.app.inject({
    method: 'PUT',
    url: `/catalog/uploads/${wavSessionId}/part/1`,
    headers: {
      authorization: `Bearer ${params.token}`,
      'content-type': 'application/octet-stream',
    },
    payload: params.wavBuffer,
  });
  await params.app.inject({
    method: 'POST',
    url: `/catalog/uploads/${wavSessionId}/complete`,
    headers: { authorization: `Bearer ${params.token}` },
  });

  // Upload Artwork
  const artSha = createHash('sha256').update(params.artworkBuffer).digest('hex');
  const initArt = await params.app.inject({
    method: 'POST',
    url: '/catalog/uploads/init',
    headers: { authorization: `Bearer ${params.token}` },
    payload: {
      releaseId,
      assetKind: 'RELEASE_ARTWORK',
      fileName: 'cover.png',
      expectedByteSize: params.artworkBuffer.byteLength,
      expectedSha256Hex: artSha,
      totalParts: 1,
    },
  });
  const artSessionId: string = initArt.json().value.uploadSessionId;
  await params.app.inject({
    method: 'PUT',
    url: `/catalog/uploads/${artSessionId}/part/1`,
    headers: {
      authorization: `Bearer ${params.token}`,
      'content-type': 'application/octet-stream',
    },
    payload: params.artworkBuffer,
  });
  await params.app.inject({
    method: 'POST',
    url: `/catalog/uploads/${artSessionId}/complete`,
    headers: { authorization: `Bearer ${params.token}` },
  });

  // Submit to FORENSIC_PROCESSING
  await params.app.inject({
    method: 'POST',
    url: `/catalog/releases/${releaseId}/submit`,
    headers: { authorization: `Bearer ${params.token}` },
  });

  return releaseId;
}

describe('@wave/api - Phase 3 Forensic Pipeline (3000x3000 RGB, Silencedetect & ACRCloud 3-Tier Rules)', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  const testQuarantineDir = './storage/test-quarantine-phase3';
  const testKycDir = './storage/test-kyc-phase3';

  before(async () => {
    const baseEnv = loadApiEnv({
      NODE_ENV: 'test',
      KYC_STORAGE_DIR: testKycDir,
    });
    const testDbUrl = baseEnv.DATABASE_URL_TEST ?? baseEnv.DATABASE_URL;
    prisma = getPrismaClient(testDbUrl);

    await cleanWaveTestDatabase(prisma);

    const created = await createWaveApiApp({
      prisma,
      env: { ...baseEnv, DATABASE_URL: testDbUrl, KYC_STORAGE_DIR: testKycDir },
      quarantineStorageDir: testQuarantineDir,
    });
    app = created.app;
  });

  after(async () => {
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
    await rm(testQuarantineDir, { recursive: true, force: true }).catch(() => null);
    await rm(testKycDir, { recursive: true, force: true }).catch(() => null);
  });

  it('enforces 3000x3000 RGB artwork, rejects silent fraud tracks, and executes ACRCloud <45%, 45-79% (with Beat License PDF + UGC block) and >=80% verdicts', async () => {
    const regRes = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        tier: 'INDIVIDUAL_LAUNCH',
        legalName: 'Mateo Urbano',
        displayName: 'Mateo Beats',
        countryCode: 'AR',
        email: 'mateo.phase3@waverecords.test',
        password: 'MateoPhase3Password2026!',
        acceptTerms: true,
      },
    });
    const token: string = regRes.json().value.accessToken;

    const valid3000RgbPng = createSyntheticPngHeaderBuffer({
      widthPx: 3000,
      heightPx: 3000,
      colorType: 2, // RGB
    });
    const undersized1400Png = createSyntheticPngHeaderBuffer({
      widthPx: 1400,
      heightPx: 1400,
      colorType: 2,
    });
    const dynamicWav = createSyntheticDynamicOrSilentWav({ silent: false });
    const silentFraudWav = createSyntheticDynamicOrSilentWav({ silent: true });

    // 1. Reject undersized 1400x1400 artwork (must be >= 3000x3000 RGB)
    const relBadArt = await seedReleaseInForensicProcessing({
      app,
      token,
      title: 'Undersized Cover Track',
      isrcCode: 'ARRC12600001',
      artworkBuffer: undersized1400Png,
      wavBuffer: dynamicWav,
    });
    const scanBadArt = await app.inject({
      method: 'POST',
      url: `/forensics/releases/${relBadArt}/scan`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    assert.equal(scanBadArt.statusCode, 409);
    assert.equal(scanBadArt.json().error.code, 'FORENSIC_REJECTED');

    // 2. Reject Silent Track Streaming Fraud (silencedetect > 85% silence)
    const relSilent = await seedReleaseInForensicProcessing({
      app,
      token,
      title: 'Silent Bot Fraud Track',
      isrcCode: 'ARRC12600002',
      artworkBuffer: valid3000RgbPng,
      wavBuffer: silentFraudWav,
    });
    const scanSilent = await app.inject({
      method: 'POST',
      url: `/forensics/releases/${relSilent}/scan`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    assert.equal(scanSilent.statusCode, 409);
    assert.equal(scanSilent.json().error.code, 'FORENSIC_REJECTED');

    // 3. ACRCloud Score >= 80% (e.g. 91%) -> Automatic HARD_REJECT_COPYRIGHT -> REJECTED
    const relHardReject = await seedReleaseInForensicProcessing({
      app,
      token,
      title: 'Unauthorized Major Hit Copy',
      isrcCode: 'ARRC12600003',
      artworkBuffer: valid3000RgbPng,
      wavBuffer: dynamicWav,
    });
    const scanHard = await app.inject({
      method: 'POST',
      url: `/forensics/releases/${relHardReject}/scan`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        simulatedAcrCloudScore: 91,
        simulatedMatchedTitle: 'Tití Me Preguntó',
        simulatedMatchedArtist: 'Bad Bunny',
      },
    });
    assert.equal(scanHard.statusCode, 200);
    assert.equal(scanHard.json().value.acrCloudVerdict, 'HARD_REJECT_COPYRIGHT');
    assert.equal(scanHard.json().value.resultingReleaseStatus, 'REJECTED');

    // 4. ACRCloud Score 45% - 79% (e.g. 64%) -> GREY_AREA_MANUAL_UGC_BLOCK -> MANUAL_COPYRIGHT_REVIEW + UGC Blocked -> Upload PDF License -> MODERATION_QUEUE
    const relGreyArea = await seedReleaseInForensicProcessing({
      app,
      token,
      title: 'Type Beat Lease Song',
      isrcCode: 'ARRC12600004',
      artworkBuffer: valid3000RgbPng,
      wavBuffer: dynamicWav,
    });
    const scanGrey = await app.inject({
      method: 'POST',
      url: `/forensics/releases/${relGreyArea}/scan`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        simulatedAcrCloudScore: 64,
        simulatedMatchedTitle: 'Dark Trap Type Beat 2026',
        simulatedMatchedArtist: 'BeatStars Producer',
      },
    });
    assert.equal(scanGrey.statusCode, 200);
    const greyReport = scanGrey.json().value;
    assert.equal(greyReport.acrCloudVerdict, 'GREY_AREA_MANUAL_UGC_BLOCK');
    assert.equal(greyReport.resultingReleaseStatus, 'MANUAL_COPYRIGHT_REVIEW');
    assert.equal(greyReport.blockUgcMonetization, true);

    // Upload Beat License PDF to clear MANUAL_COPYRIGHT_REVIEW -> MODERATION_QUEUE
    const boundary = '----WaveBeatLicenseBoundary';
    const pdfPayload = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="beat-lease-license.pdf"\r\nContent-Type: application/pdf\r\n\r\n`,
        'utf8',
      ),
      Buffer.from('%PDF-1.7 NON-EXCLUSIVE LEASE LICENSE AGREEMENT WAVE RECORDS', 'utf8'),
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'),
    ]);

    const licenseRes = await app.inject({
      method: 'POST',
      url: `/forensics/releases/${relGreyArea}/license-pdf`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: pdfPayload,
    });
    assert.equal(licenseRes.statusCode, 200);
    assert.equal(licenseRes.json().value.nextStatus, 'MODERATION_QUEUE');
    assert.equal(licenseRes.json().value.blockUgcMonetization, true);

    // 5. ACRCloud Score < 45% (e.g. 11%) -> CLEAN_PASS -> Directly to MODERATION_QUEUE with UGC enabled
    const relClean = await seedReleaseInForensicProcessing({
      app,
      token,
      title: '100% Original Masterpiece',
      isrcCode: 'ARRC12600005',
      artworkBuffer: valid3000RgbPng,
      wavBuffer: dynamicWav,
    });
    const scanClean = await app.inject({
      method: 'POST',
      url: `/forensics/releases/${relClean}/scan`,
      headers: { authorization: `Bearer ${token}` },
      payload: { simulatedAcrCloudScore: 11 },
    });
    assert.equal(scanClean.statusCode, 200);
    assert.equal(scanClean.json().value.acrCloudVerdict, 'CLEAN_PASS');
    assert.equal(scanClean.json().value.resultingReleaseStatus, 'MODERATION_QUEUE');
    assert.equal(scanClean.json().value.blockUgcMonetization, false);
  });
});
