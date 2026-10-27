import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { rm } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { loadApiEnv } from '../config/env.schema.js';
import { getPrismaClient } from '../infrastructure/prisma/prisma.service.js';
import { createWaveApiApp } from '../http/create-app.js';
import { hashUserPassword } from '../modules/auth/services/password-hasher.service.js';
import type { HeadlessRevelatorAdapter } from '../modules/revelator/adapters/headless-revelator.adapter.js';
import { cleanWaveTestDatabase } from './test-db-cleaner.js';

function createValid3000x3000RgbPng(): Buffer {
  const buf = Buffer.alloc(64);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(3000, 16);
  buf.writeUInt32BE(3000, 20);
  buf[24] = 8;
  buf[25] = 2; // RGB Truecolor
  return buf;
}

function createDynamicStereoWav(): Buffer {
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
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRateHz, 24);
  header.writeUInt32LE(sampleRateHz * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcmPayloadBytes, 40);

  const pcm = Buffer.alloc(pcmPayloadBytes);
  for (let i = 0; i < numSamples; i++) {
    pcm.writeInt16LE(Math.round(Math.sin(i * 0.15) * 18000), i * 2);
  }
  return Buffer.concat([header, pcm]);
}

async function createAndScanRelease(params: {
  app: FastifyInstance;
  producerToken: string;
  title: string;
  isrcCode: string;
  simulatedAcrScore: number;
}): Promise<{ releaseId: string; trackId: string }> {
  const createRes = await params.app.inject({
    method: 'POST',
    url: '/catalog/releases',
    headers: { authorization: `Bearer ${params.producerToken}` },
    payload: {
      title: params.title,
      primaryArtist: 'Wave Records Artist',
      releaseType: 'SINGLE',
      primaryGenre: 'Reggaeton / Urbano',
      pLineYear: 2026,
      pLineOwner: 'Wave Records LLC',
      cLineYear: 2026,
      cLineOwner: 'Wave Records LLC',
    },
  });
  const releaseId: string = createRes.json().value.releaseId;

  const trackRes = await params.app.inject({
    method: 'POST',
    url: `/catalog/releases/${releaseId}/tracks`,
    headers: { authorization: `Bearer ${params.producerToken}` },
    payload: {
      trackNumber: 1,
      title: params.title,
      primaryArtist: 'Wave Records Artist',
      isExplicit: false,
      isInstrumental: false,
      audioLanguage: 'es',
      isrcCode: params.isrcCode,
    },
  });
  const trackId: string = trackRes.json().value.trackId;

  const wavBuf = createDynamicStereoWav();
  const wavSha = createHash('sha256').update(wavBuf).digest('hex');
  const initWav = await params.app.inject({
    method: 'POST',
    url: '/catalog/uploads/init',
    headers: { authorization: `Bearer ${params.producerToken}` },
    payload: {
      releaseId,
      trackId,
      assetKind: 'TRACK_WAV',
      fileName: 'master.wav',
      expectedByteSize: wavBuf.byteLength,
      expectedSha256Hex: wavSha,
      totalParts: 1,
    },
  });
  const wavSessionId: string = initWav.json().value.uploadSessionId;
  await params.app.inject({
    method: 'PUT',
    url: `/catalog/uploads/${wavSessionId}/part/1`,
    headers: {
      authorization: `Bearer ${params.producerToken}`,
      'content-type': 'application/octet-stream',
    },
    payload: wavBuf,
  });
  await params.app.inject({
    method: 'POST',
    url: `/catalog/uploads/${wavSessionId}/complete`,
    headers: { authorization: `Bearer ${params.producerToken}` },
  });

  const artBuf = createValid3000x3000RgbPng();
  const artSha = createHash('sha256').update(artBuf).digest('hex');
  const initArt = await params.app.inject({
    method: 'POST',
    url: '/catalog/uploads/init',
    headers: { authorization: `Bearer ${params.producerToken}` },
    payload: {
      releaseId,
      assetKind: 'RELEASE_ARTWORK',
      fileName: 'cover.png',
      expectedByteSize: artBuf.byteLength,
      expectedSha256Hex: artSha,
      totalParts: 1,
    },
  });
  const artSessionId: string = initArt.json().value.uploadSessionId;
  await params.app.inject({
    method: 'PUT',
    url: `/catalog/uploads/${artSessionId}/part/1`,
    headers: {
      authorization: `Bearer ${params.producerToken}`,
      'content-type': 'application/octet-stream',
    },
    payload: artBuf,
  });
  await params.app.inject({
    method: 'POST',
    url: `/catalog/uploads/${artSessionId}/complete`,
    headers: { authorization: `Bearer ${params.producerToken}` },
  });

  await params.app.inject({
    method: 'POST',
    url: `/catalog/releases/${releaseId}/submit`,
    headers: { authorization: `Bearer ${params.producerToken}` },
  });

  await params.app.inject({
    method: 'POST',
    url: `/forensics/releases/${releaseId}/scan`,
    headers: { authorization: `Bearer ${params.producerToken}` },
    payload: {
      simulatedAcrCloudScore: params.simulatedAcrScore,
      simulatedMatchedTitle: 'Type Beat Sample Reference',
      simulatedMatchedArtist: 'Producer Lease Catalog',
    },
  });

  return { releaseId, trackId };
}

describe('@wave/api - Phase 4 Backoffice Moderation & Headless Revelator V1/V2 Suite', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let revelatorAdapter: HeadlessRevelatorAdapter;
  const testQuarantineDir = './storage/test-quarantine-phase4';
  const testKycDir = './storage/test-kyc-phase4';

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
    revelatorAdapter = created.revelatorAdapter;
  });

  after(async () => {
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
    await rm(testQuarantineDir, { recursive: true, force: true }).catch(() => null);
    await rm(testKycDir, { recursive: true, force: true }).catch(() => null);
  });

  it('provisions Revelator Child Account server-side, caches 8h Unprompted Auth token, blocks UGC on Grey-Area Beat Lease, and isolates Revelator outages via Circuit Breaker', async () => {
    // 1. Register Producer Tenant (INDIVIDUAL_LAUNCH)
    const regProducer = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        tier: 'INDIVIDUAL_LAUNCH',
        legalName: 'Sebastián Producer',
        displayName: 'Sebas Wave Beats',
        countryCode: 'CO',
        email: 'sebas.phase4@waverecords.test',
        password: 'ProducerPhase4Password!',
        acceptTerms: true,
      },
    });
    assert.equal(regProducer.statusCode, 201);
    const producerToken: string = regProducer.json().value.accessToken;

    // 2. Seed Admin User (WAVE_COMPLIANCE_ADMIN)
    const adminTenant = await prisma.tenant.create({
      data: {
        legalName: 'Wave Records Backoffice LLC',
        displayName: 'Wave Moderation Ops',
        tier: 'LABEL_GROWTH',
        status: 'ACTIVE',
        countryCode: 'US',
      },
    });
    const adminHash = await hashUserPassword('AdminModerationPassword123!');
    await prisma.user.create({
      data: {
        tenantId: adminTenant.id,
        email: 'moderator.phase4@waverecords.test',
        passwordHash: adminHash,
        role: 'WAVE_COMPLIANCE_ADMIN',
      },
    });
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'moderator.phase4@waverecords.test',
        password: 'AdminModerationPassword123!',
      },
    });
    assert.equal(adminLogin.statusCode, 200);
    const adminToken: string = adminLogin.json().value.accessToken;

    // 3. Verify Producer is blocked from Moderation Backoffice (403 FORBIDDEN_IDOR)
    const forbiddenQueueRes = await app.inject({
      method: 'GET',
      url: '/admin/moderation/queue',
      headers: { authorization: `Bearer ${producerToken}` },
    });
    assert.equal(forbiddenQueueRes.statusCode, 403);

    // 4. CASE A: Clean Release (<45% ACRCloud) -> Approved & Dispatched to Revelator V2
    const cleanRel = await createAndScanRelease({
      app,
      producerToken,
      title: 'Noche En Medellín (Original Mix)',
      isrcCode: 'USWVR2690101',
      simulatedAcrScore: 14,
    });

    const approveCleanRes = await app.inject({
      method: 'POST',
      url: `/admin/moderation/releases/${cleanRel.releaseId}/decision`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        decision: 'APPROVE_AND_DISPATCH',
        moderationNotes: 'Audio 100% original verificado. Despachado a DSPs y Content ID.',
      },
    });
    assert.equal(approveCleanRes.statusCode, 200);
    const cleanDispatch = approveCleanRes.json().value;
    assert.equal(cleanDispatch.releaseStatus, 'LIVE_ON_DSPS');
    assert.equal(cleanDispatch.unpromptedTokenCached, false); // First call issued fresh 8h token!
    assert.equal(cleanDispatch.ugcMonetizationBlocked, false);
    assert.equal(cleanDispatch.ugcMonetizationPolicy, 'MONETIZE_ALL');
    assert.equal(cleanDispatch.dspTargets.includes('YOUTUBE_CONTENT_ID'), true);
    assert.equal(cleanDispatch.dspTargets.includes('TIKTOK_SOUND_MONETIZATION'), true);
    assert.equal(cleanDispatch.revelatorPlanType, 'Launch');
    assert.ok(cleanDispatch.revelatorEnterpriseId >= 100_000);
    assert.ok(cleanDispatch.revelatorReleaseId >= 700_000);

    // 5. CASE B: Grey-Area Beat Lease (68% ACRCloud) -> PDF Decryption & UGC Blocked Dispatch + 8h Token Cache Hit!
    const greyRel = await createAndScanRelease({
      app,
      producerToken,
      title: 'Fuego Urbano (Beat Lease)',
      isrcCode: 'USWVR2690102',
      simulatedAcrScore: 68,
    });

    // Attempting to approve before Beat License PDF is uploaded must fail (409)
    const prematureApprove = await app.inject({
      method: 'POST',
      url: `/admin/moderation/releases/${greyRel.releaseId}/decision`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        decision: 'APPROVE_AND_DISPATCH',
        moderationNotes: 'Intentando aprobar sin licencia PDF.',
      },
    });
    assert.equal(prematureApprove.statusCode, 409);

    // Producer uploads Beat License PDF
    const boundary = '----WaveBeatLicenseBoundaryPhase4';
    const rawPdfFileBuffer = Buffer.from(
      '%PDF-1.7\n%BeatStars Non-Exclusive Lease Contract - Sebas Wave Beats\n%%EOF',
      'utf8',
    );
    const pdfExpectedSha = createHash('sha256').update(rawPdfFileBuffer).digest('hex');
    const multipartPdfBody = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="beat-lease-license.pdf"\r\nContent-Type: application/pdf\r\n\r\n`,
        'utf8',
      ),
      rawPdfFileBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'),
    ]);
    const uploadLicenseRes = await app.inject({
      method: 'POST',
      url: `/forensics/releases/${greyRel.releaseId}/license-pdf`,
      headers: {
        authorization: `Bearer ${producerToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: multipartPdfBody,
    });
    assert.equal(uploadLicenseRes.statusCode, 200);

    // Admin decrypts and inspects the Beat License PDF on-the-fly (AES-256-GCM)
    const inspectPdfRes = await app.inject({
      method: 'GET',
      url: `/admin/moderation/releases/${greyRel.releaseId}/beat-license`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(inspectPdfRes.statusCode, 200);
    const pdfInspection = inspectPdfRes.json().value;
    assert.equal(pdfInspection.pdfMagicHeaderValid, true);
    assert.equal(pdfInspection.sha256Hex, pdfExpectedSha);

    // Admin approves & dispatches Grey-Area release
    const approveGreyRes = await app.inject({
      method: 'POST',
      url: `/admin/moderation/releases/${greyRel.releaseId}/decision`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        decision: 'APPROVE_AND_DISPATCH',
        moderationNotes: 'Licencia de Beat verificada. Monetización UGC bloqueada preventivamente.',
      },
    });
    assert.equal(approveGreyRes.statusCode, 200);
    const greyDispatch = approveGreyRes.json().value;
    assert.equal(greyDispatch.releaseStatus, 'LIVE_ON_DSPS');
    assert.equal(greyDispatch.unpromptedTokenCached, true); // Served from 8-hour Unprompted Token Cache!
    assert.equal(greyDispatch.ugcMonetizationBlocked, true);
    assert.equal(greyDispatch.ugcMonetizationPolicy, 'BLOCKED_BEAT_LEASE_GREY_AREA');
    // Verify UGC Content-ID stores were excluded while standard streaming DSPs remain active
    assert.equal(greyDispatch.dspTargets.includes('SPOTIFY'), true);
    assert.equal(greyDispatch.dspTargets.includes('APPLE_MUSIC'), true);
    assert.equal(greyDispatch.dspTargets.includes('YOUTUBE_CONTENT_ID'), false);
    assert.equal(greyDispatch.dspTargets.includes('TIKTOK_SOUND_MONETIZATION'), false);
    assert.equal(greyDispatch.dspTargets.includes('META_RIGHTS_MANAGER'), false);

    // 6. CASE C: Circuit Breaker Fault Isolation on Revelator Outage
    const outageRel = await createAndScanRelease({
      app,
      producerToken,
      title: 'Resiliencia Extrema (Circuit Breaker Test)',
      isrcCode: 'USWVR2690103',
      simulatedAcrScore: 10,
    });

    revelatorAdapter.setSimulatedOutage(true);

    const failAttempt1 = await app.inject({
      method: 'POST',
      url: `/admin/moderation/releases/${outageRel.releaseId}/decision`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        decision: 'APPROVE_AND_DISPATCH',
        moderationNotes: 'Intento durante caída simulada 1.',
      },
    });
    assert.equal(failAttempt1.statusCode, 503);

    const failAttempt2 = await app.inject({
      method: 'POST',
      url: `/admin/moderation/releases/${outageRel.releaseId}/decision`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        decision: 'APPROVE_AND_DISPATCH',
        moderationNotes: 'Intento durante caída simulada 2 (abre Circuit Breaker).',
      },
    });
    assert.equal(failAttempt2.statusCode, 503);
    assert.equal(revelatorAdapter.circuitBreaker.getState(), 'OPEN');

    // Verify release remained safely in MODERATION_QUEUE without state corruption
    const queueCheck = await app.inject({
      method: 'GET',
      url: '/admin/moderation/queue',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(queueCheck.statusCode, 200);
    const outageItem = queueCheck
      .json()
      .value.find((item: { releaseId: string }) => item.releaseId === outageRel.releaseId);
    assert.equal(outageItem.status, 'MODERATION_QUEUE');
    assert.equal(outageItem.latestDeliveryJob.deliveryStatus, 'FAILED_CIRCUIT_BREAKER_ISOLATED');

    // Restore Revelator service and verify retry succeeds
    revelatorAdapter.setSimulatedOutage(false);
    const recoveryAttempt = await app.inject({
      method: 'POST',
      url: `/admin/moderation/releases/${outageRel.releaseId}/decision`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        decision: 'APPROVE_AND_DISPATCH',
        moderationNotes: 'Reintento exitoso tras recuperación del Circuit Breaker.',
      },
    });
    assert.equal(recoveryAttempt.statusCode, 200);
    assert.equal(recoveryAttempt.json().value.releaseStatus, 'LIVE_ON_DSPS');
    assert.equal(recoveryAttempt.json().value.attemptCount, 3);
  });
});
