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
 * Generates a synthetically valid RIFF/WAVE Linear PCM binary buffer for testing.
 */
function createSyntheticWavBuffer(params: {
  audioFormat?: number;
  channels: number;
  sampleRateHz: number;
  bitDepth: number;
  pcmPayloadBytes: number;
}): Buffer {
  const audioFormat = params.audioFormat ?? 1; // 1 = PCM
  const byteRate = params.sampleRateHz * params.channels * (params.bitDepth / 8);
  const blockAlign = params.channels * (params.bitDepth / 8);
  const header = Buffer.alloc(44);

  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + params.pcmPayloadBytes, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(audioFormat, 20);
  header.writeUInt16LE(params.channels, 22);
  header.writeUInt32LE(params.sampleRateHz, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(params.bitDepth, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(params.pcmPayloadBytes, 40);

  const pcmData = Buffer.alloc(params.pcmPayloadBytes, 0x1a);
  return Buffer.concat([header, pcmData]);
}

describe('@wave/api - Phase 2 Catalog Engine, Multipart SHA-256 Ingest & FSM Immutability Suite', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  const testQuarantineDir = './storage/test-quarantine-phase2';

  before(async () => {
    const baseEnv = loadApiEnv({ NODE_ENV: 'test' });
    const testDbUrl = baseEnv.DATABASE_URL_TEST ?? baseEnv.DATABASE_URL;
    prisma = getPrismaClient(testDbUrl);

    await cleanWaveTestDatabase(prisma);

    const created = await createWaveApiApp({
      prisma,
      env: { ...baseEnv, DATABASE_URL: testDbUrl },
      quarantineStorageDir: testQuarantineDir,
    });
    app = created.app;
  });

  after(async () => {
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
    await rm(testQuarantineDir, { recursive: true, force: true }).catch(() => null);
  });

  it('validates UPC/ISRC, assembles multi-chunk WAV & Artwork with SHA-256 verification, rejects invalid PCM, and locks Release on submission', async () => {
    // 1. Register Producer Tenant
    const regRes = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        tier: 'INDIVIDUAL_LAUNCH',
        legalName: 'Alejandro Producer',
        displayName: 'Wave Lab Studios',
        countryCode: 'CO',
        email: 'producer.phase2@waverecords.test',
        password: 'ProducerPhase2Password!',
        acceptTerms: true,
      },
    });
    assert.equal(regRes.statusCode, 201);
    const token: string = regRes.json().value.accessToken;

    // 2. Reject tampered UPC check-digit (422)
    const badUpcRes = await app.inject({
      method: 'POST',
      url: '/catalog/releases',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'Midnight Horizon',
        primaryArtist: 'Wave Lab Studios',
        releaseType: 'SINGLE',
        primaryGenre: 'Electronic',
        pLineYear: 2026,
        pLineOwner: 'Wave Lab Studios',
        cLineYear: 2026,
        cLineOwner: 'Wave Lab Studios',
        upcCode: '036000291459', // Invalid check digit
      },
    });
    assert.equal(badUpcRes.statusCode, 422);

    // 3. Create valid SINGLE Release Draft with valid Modulo-10 UPC
    const createRelRes = await app.inject({
      method: 'POST',
      url: '/catalog/releases',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'Midnight Horizon',
        versionTitle: 'Original Mix',
        primaryArtist: 'Wave Lab Studios',
        releaseType: 'SINGLE',
        primaryGenre: 'Electronic',
        releaseDateIso: '2026-11-15',
        pLineYear: 2026,
        pLineOwner: 'Wave Lab Studios',
        cLineYear: 2026,
        cLineOwner: 'Wave Lab Studios',
        upcCode: '036000291452',
      },
    });
    assert.equal(createRelRes.statusCode, 201);
    const releaseId: string = createRelRes.json().value.releaseId;

    // 4. Add Track #1 metadata with lowercase hyphenated ISRC -> normalized to USRC12600888
    const trackRes = await app.inject({
      method: 'POST',
      url: `/catalog/releases/${releaseId}/tracks`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        trackNumber: 1,
        title: 'Midnight Horizon',
        primaryArtist: 'Wave Lab Studios',
        isExplicit: false,
        isInstrumental: true,
        audioLanguage: 'zxx',
        isrcCode: 'us-rc1-26-00888',
      },
    });
    assert.equal(trackRes.statusCode, 200);
    const trackId: string = trackRes.json().value.trackId;
    assert.equal(trackRes.json().value.normalizedIsrc, 'USRC12600888');

    // 5. Reject Mono (1-channel) WAV file during Multipart Completion (409 FORENSIC_REJECTED)
    const monoWav = createSyntheticWavBuffer({
      channels: 1, // Invalid: must be 2 stereo
      sampleRateHz: 48000,
      bitDepth: 24,
      pcmPayloadBytes: 1200,
    });
    const monoSha256 = createHash('sha256').update(monoWav).digest('hex');

    const initMono = await app.inject({
      method: 'POST',
      url: '/catalog/uploads/init',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        releaseId,
        trackId,
        assetKind: 'TRACK_WAV',
        fileName: 'mono-invalid.wav',
        expectedByteSize: monoWav.byteLength,
        expectedSha256Hex: monoSha256,
        totalParts: 1,
      },
    });
    assert.equal(initMono.statusCode, 201);
    const monoSessionId: string = initMono.json().value.uploadSessionId;

    await app.inject({
      method: 'PUT',
      url: `/catalog/uploads/${monoSessionId}/part/1`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/octet-stream',
      },
      payload: monoWav,
    });

    const completeMono = await app.inject({
      method: 'POST',
      url: `/catalog/uploads/${monoSessionId}/complete`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(completeMono.statusCode, 409);
    assert.equal(completeMono.json().error.code, 'FORENSIC_REJECTED');

    // 6. Upload genuine 24-bit / 48kHz Stereo WAV split across 2 chunks & verify SHA-256
    const stereoWav = createSyntheticWavBuffer({
      channels: 2,
      sampleRateHz: 48000,
      bitDepth: 24,
      pcmPayloadBytes: 288000, // 1 second of 48kHz 24-bit stereo audio
    });
    const stereoSha256 = createHash('sha256').update(stereoWav).digest('hex');
    const midpoint = Math.floor(stereoWav.byteLength / 2);
    const chunk1 = stereoWav.subarray(0, midpoint);
    const chunk2 = stereoWav.subarray(midpoint);

    const initStereo = await app.inject({
      method: 'POST',
      url: '/catalog/uploads/init',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        releaseId,
        trackId,
        assetKind: 'TRACK_WAV',
        fileName: 'midnight-horizon-master.wav',
        expectedByteSize: stereoWav.byteLength,
        expectedSha256Hex: stereoSha256,
        totalParts: 2,
      },
    });
    assert.equal(initStereo.statusCode, 201);
    const stereoSessionId: string = initStereo.json().value.uploadSessionId;

    const p1Res = await app.inject({
      method: 'PUT',
      url: `/catalog/uploads/${stereoSessionId}/part/1`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/octet-stream',
      },
      payload: chunk1,
    });
    assert.equal(p1Res.statusCode, 200);

    const p2Res = await app.inject({
      method: 'PUT',
      url: `/catalog/uploads/${stereoSessionId}/part/2`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/octet-stream',
      },
      payload: chunk2,
    });
    assert.equal(p2Res.statusCode, 200);

    const completeStereo = await app.inject({
      method: 'POST',
      url: `/catalog/uploads/${stereoSessionId}/complete`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(completeStereo.statusCode, 200);
    const stereoResult = completeStereo.json().value;
    assert.equal(stereoResult.verifiedSha256Hex, stereoSha256);
    assert.equal(stereoResult.wavTechnical.sampleRateHz, 48000);
    assert.equal(stereoResult.wavTechnical.bitDepth, 24);
    assert.equal(stereoResult.wavTechnical.channels, 2);

    // 7. Upload Release Artwork via Multipart Upload
    const pngArtwork = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('WAVE-RECORDS-COVER-ARTWORK-3000X3000-RGB', 'utf8'),
    ]);
    const artworkSha256 = createHash('sha256').update(pngArtwork).digest('hex');

    const initArt = await app.inject({
      method: 'POST',
      url: '/catalog/uploads/init',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        releaseId,
        assetKind: 'RELEASE_ARTWORK',
        fileName: 'cover-3000.png',
        expectedByteSize: pngArtwork.byteLength,
        expectedSha256Hex: artworkSha256,
        totalParts: 1,
      },
    });
    const artSessionId: string = initArt.json().value.uploadSessionId;

    await app.inject({
      method: 'PUT',
      url: `/catalog/uploads/${artSessionId}/part/1`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/octet-stream',
      },
      payload: pngArtwork,
    });

    const completeArt = await app.inject({
      method: 'POST',
      url: `/catalog/uploads/${artSessionId}/complete`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(completeArt.statusCode, 200);

    // 8. Submit Release to Forensics -> Transitions to FORENSIC_PROCESSING and locks edits!
    const submitRes = await app.inject({
      method: 'POST',
      url: `/catalog/releases/${releaseId}/submit`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(submitRes.statusCode, 200);
    assert.equal(submitRes.json().value.nextStatus, 'FORENSIC_PROCESSING');

    // 9. Verify Immutability Lock: tenant cannot mutate track metadata once in FORENSIC_PROCESSING
    const illegalEditAttempt = await app.inject({
      method: 'POST',
      url: `/catalog/releases/${releaseId}/tracks`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        trackNumber: 1,
        title: 'Tampered Title After Submission',
        primaryArtist: 'Wave Lab Studios',
        isExplicit: false,
        isInstrumental: true,
        audioLanguage: 'zxx',
        isrcCode: 'USRC12600888',
      },
    });
    assert.equal(illegalEditAttempt.statusCode, 409);
    assert.equal(illegalEditAttempt.json().error.code, 'INVALID_STATE_TRANSITION');
  });
});
