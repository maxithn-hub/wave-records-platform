import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { loadApiEnv } from '../config/env.schema.js';
import { getPrismaClient } from '../infrastructure/prisma/prisma.service.js';
import { createWaveApiApp } from '../http/create-app.js';
import { hashUserPassword } from '../modules/auth/services/password-hasher.service.js';
import { cleanWaveTestDatabase } from './test-db-cleaner.js';

function createMultipartPayload(params: {
  boundary: string;
  fields: Record<string, string>;
  fileField: string;
  filename: string;
  contentType: string;
  fileBuffer: Buffer;
}): Buffer {
  const chunks: Buffer[] = [];
  for (const [k, v] of Object.entries(params.fields)) {
    chunks.push(
      Buffer.from(
        `--${params.boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`,
        'utf8',
      ),
    );
  }
  chunks.push(
    Buffer.from(
      `--${params.boundary}\r\nContent-Disposition: form-data; name="${params.fileField}"; filename="${params.filename}"\r\nContent-Type: ${params.contentType}\r\n\r\n`,
      'utf8',
    ),
  );
  chunks.push(params.fileBuffer);
  chunks.push(Buffer.from(`\r\n--${params.boundary}--\r\n`, 'utf8'));
  return Buffer.concat(chunks);
}

describe('@wave/api - Phase 1 PostgreSQL Integration Suite (Auth, Anti-IDOR, KYC & IRS Tax)', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  const testStorageDir = './storage/test-kyc-phase1';

  before(async () => {
    const baseEnv = loadApiEnv({
      NODE_ENV: 'test',
      KYC_STORAGE_DIR: testStorageDir,
    });
    const testDbUrl = baseEnv.DATABASE_URL_TEST ?? baseEnv.DATABASE_URL;
    prisma = getPrismaClient(testDbUrl);

    // Clean test tables in reverse dependency order
    await cleanWaveTestDatabase(prisma);

    const created = await createWaveApiApp({
      prisma,
      env: { ...baseEnv, DATABASE_URL: testDbUrl, KYC_STORAGE_DIR: testStorageDir },
      maxAuthAttemptsPerMinute: 5,
    });
    app = created.app;
  });

  after(async () => {
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
    await rm(testStorageDir, { recursive: true, force: true }).catch(() => null);
  });

  it('completes full lifecycle: Register -> Refresh Rotation & Reuse Detection -> Anti-IDOR -> KYC & W-8BEN -> Admin Approval -> Payout Eligible', async () => {
    // 1. Register Tenant A (Artist in Mexico -> INDIVIDUAL_LAUNCH -> requires W8BEN)
    const regARes = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        tier: 'INDIVIDUAL_LAUNCH',
        legalName: 'Carlos Rivera Morales',
        displayName: 'Nova Wave MX',
        countryCode: 'MX',
        email: 'artist.mx@waverecords.test',
        password: 'StrongArtistPassword2026!',
        acceptTerms: true,
      },
    });
    assert.equal(regARes.statusCode, 201);
    const regABody = regARes.json();
    assert.equal(regABody.ok, true);
    let tokenA: string = regABody.value.accessToken;
    const cookieA1 = regARes.cookies.find((c) => c.name === 'wave_refresh_token');
    assert.ok(cookieA1?.value);

    // 2. Register Tenant B (Label in US -> LABEL_GROWTH -> requires W9)
    const regBRes = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        tier: 'LABEL_GROWTH',
        legalName: 'Apex Sound Holdings LLC',
        displayName: 'Apex Sound US',
        countryCode: 'US',
        email: 'label.us@waverecords.test',
        password: 'StrongLabelPassword2026!',
        acceptTerms: true,
      },
    });
    assert.equal(regBRes.statusCode, 201);
    const tokenB: string = regBRes.json().value.accessToken;

    // Fetch /auth/me for both
    const meARes = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    assert.equal(meARes.statusCode, 200);
    const tenantAId: string = meARes.json().value.tenant.id;

    const meBRes = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${tokenB}` },
    });
    const tenantBId: string = meBRes.json().value.tenant.id;

    // 3. Test Refresh Token Rotation & Reuse Theft Detection
    const refresh1 = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { wave_refresh_token: cookieA1.value },
    });
    assert.equal(refresh1.statusCode, 200);
    const cookieA2 = refresh1.cookies.find((c) => c.name === 'wave_refresh_token');
    assert.ok(cookieA2?.value);
    assert.notEqual(cookieA2.value, cookieA1.value);

    // Replay already-rotated cookieA1 -> must trigger theft detection and revoke family!
    const replayAttempt = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { wave_refresh_token: cookieA1.value },
    });
    assert.equal(replayAttempt.statusCode, 401);

    // Now even cookieA2 in that family must be revoked!
    const afterTheftAttempt = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { wave_refresh_token: cookieA2.value },
    });
    assert.equal(afterTheftAttempt.statusCode, 401);

    // Re-login Tenant A to get a fresh session
    const loginARes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'artist.mx@waverecords.test',
        password: 'StrongArtistPassword2026!',
      },
    });
    assert.equal(loginARes.statusCode, 200);
    tokenA = loginARes.json().value.accessToken;

    // 4. Anti-IDOR Verification: Tenant A cannot query Tenant B's compliance status
    const idorAttempt = await app.inject({
      method: 'GET',
      url: `/compliance/status?tenantId=${tenantBId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    assert.equal(idorAttempt.statusCode, 403);
    assert.equal(idorAttempt.json().error.code, 'FORBIDDEN_IDOR');

    // Client-injected revelatorEnterpriseId is blocked with 403
    const injectedRevAttempt = await app.inject({
      method: 'GET',
      url: '/compliance/status?revelatorEnterpriseId=777',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    assert.equal(injectedRevAttempt.statusCode, 403);

    // Standard tenant cannot access /admin/* routes
    const nonAdminAttempt = await app.inject({
      method: 'GET',
      url: '/admin/compliance/queue',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    assert.equal(nonAdminAttempt.statusCode, 403);

    // 5. Reject structurally invalid IRS SSN on W-9 (e.g., starting with 666)
    const badW9 = await app.inject({
      method: 'POST',
      url: '/compliance/tax/w9',
      headers: { authorization: `Bearer ${tokenB}` },
      payload: {
        formType: 'W9',
        taxpayerLegalName: 'Apex Sound Holdings LLC',
        federalTaxClassification: 'LLC',
        tinType: 'SSN',
        rawTinNumber: '666-12-3456',
        addressLine1: '742 Evergreen Terrace',
        city: 'Miami',
        stateCode: 'FL',
        zipCode: '33101',
        certifyUnderPenaltyOfPerjury: true,
        electronicSignatureName: 'John Manager',
      },
    });
    assert.equal(badW9.statusCode, 422);

    // Submit valid W-8BEN for Tenant A (Mexican individual artist)
    const rawFtin = 'RIMC920814ABC';
    const w8Res = await app.inject({
      method: 'POST',
      url: '/compliance/tax/w8ben',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        formType: 'W8BEN',
        beneficialOwnerName: 'Carlos Rivera Morales',
        countryOfCitizenship: 'MX',
        permanentResidenceAddress: 'Av. Reforma 222',
        cityOrTown: 'Ciudad de México',
        countryOfResidence: 'MX',
        rawForeignTaxId: rawFtin,
        dateOfBirthIso: '1992-08-14',
        claimTaxTreatyBenefits: true,
        treatyCountryCode: 'MX',
        certifyNonUsPersonAndPerjury: true,
        electronicSignatureName: 'Carlos Rivera Morales',
      },
    });
    assert.equal(w8Res.statusCode, 201);
    assert.equal(w8Res.json().value.maskedTaxId, '***-**-4ABC');

    // Verify in PostgreSQL that rawFtin is NOT stored in plaintext
    const dbTax = await prisma.taxDeclaration.findFirstOrThrow({
      where: { tenantId: tenantAId },
    });
    assert.ok(dbTax.encryptedTaxIdHex);
    assert.equal(dbTax.encryptedTaxIdHex.includes(rawFtin), false);
    assert.equal(dbTax.taxIdLast4, '4ABC');

    // 6. Upload KYC Document (Reject spoofed non-image, accept genuine PNG magic bytes)
    const boundary = '----WaveBoundaryTest123';
    const spoofedBody = createMultipartPayload({
      boundary,
      fields: { documentType: 'PASSPORT' },
      fileField: 'file',
      filename: 'passport.png',
      contentType: 'image/png',
      fileBuffer: Buffer.from('NOT_A_REAL_PNG_FILE', 'utf8'),
    });
    const spoofedKycRes = await app.inject({
      method: 'POST',
      url: '/compliance/kyc/documents',
      headers: {
        authorization: `Bearer ${tokenA}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: spoofedBody,
    });
    assert.equal(spoofedKycRes.statusCode, 422);

    // Genuine PNG header bytes (89 50 4E 47 0D 0A 1A 0A) + payload
    const genuinePngBytes = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('WAVE-KYC-TEST-PASSPORT-IMAGE-PAYLOAD', 'utf8'),
    ]);
    const validKycBody = createMultipartPayload({
      boundary,
      fields: { documentType: 'PASSPORT' },
      fileField: 'file',
      filename: 'passport.png',
      contentType: 'image/png',
      fileBuffer: genuinePngBytes,
    });
    const validKycRes = await app.inject({
      method: 'POST',
      url: '/compliance/kyc/documents',
      headers: {
        authorization: `Bearer ${tokenA}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: validKycBody,
    });
    assert.equal(validKycRes.statusCode, 201);
    const kycId: string = validKycRes.json().value.kycVerificationId;

    // Verify encrypted file on disk does NOT contain raw PNG header or plaintext payload
    const kycRecord = await prisma.kycVerification.findUniqueOrThrow({
      where: { id: kycId },
    });
    const diskBytes = await readFile(join(testStorageDir, kycRecord.s3ObjectKey!));
    assert.equal(diskBytes.includes(Buffer.from('WAVE-KYC-TEST-PASSPORT')), false);

    // 7. Create Compliance Admin & Approve both KYC and Tax -> Tenant auto-activates!
    const adminPasswordHash = await hashUserPassword('AdminComplianceSecret2026!');
    await prisma.user.create({
      data: {
        tenantId: tenantBId,
        email: 'compliance.admin@waverecords.test',
        passwordHash: adminPasswordHash,
        role: 'WAVE_COMPLIANCE_ADMIN',
      },
    });

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'compliance.admin@waverecords.test',
        password: 'AdminComplianceSecret2026!',
      },
    });
    assert.equal(adminLogin.statusCode, 200);
    const adminToken: string = adminLogin.json().value.accessToken;

    // Admin fetches queue
    const queueRes = await app.inject({
      method: 'GET',
      url: '/admin/compliance/queue',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(queueRes.statusCode, 200);
    assert.equal(queueRes.json().value.items.length, 2);

    // Admin inspects decrypted KYC document
    const docStreamRes = await app.inject({
      method: 'GET',
      url: `/admin/compliance/kyc/${kycId}/document`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(docStreamRes.statusCode, 200);
    assert.equal(docStreamRes.headers['content-type'], 'image/png');
    assert.ok(docStreamRes.headers['cache-control']?.includes('no-store'));
    assert.deepEqual(docStreamRes.rawPayload, genuinePngBytes);

    // Admin approves KYC
    const approveKycRes = await app.inject({
      method: 'POST',
      url: `/admin/compliance/kyc/${kycId}/decision`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { decision: 'APPROVE' },
    });
    assert.equal(approveKycRes.statusCode, 200);
    assert.equal(approveKycRes.json().value.tenantActivated, false); // Tax still pending

    // Admin validates W-8BEN Tax Declaration
    const approveTaxRes = await app.inject({
      method: 'POST',
      url: `/admin/compliance/tax/${dbTax.id}/decision`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { decision: 'APPROVE' },
    });
    assert.equal(approveTaxRes.statusCode, 200);
    assert.equal(approveTaxRes.json().value.tenantActivated, true); // Both KYC + Tax now verified!

    // 8. Check Tenant A compliance status: must now be ACTIVE and payoutEligible = true
    const finalStatusRes = await app.inject({
      method: 'GET',
      url: '/compliance/status',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    assert.equal(finalStatusRes.statusCode, 200);
    const finalStatus = finalStatusRes.json().value;
    assert.equal(finalStatus.tenantStatus, 'ACTIVE');
    assert.equal(finalStatus.payoutEligible, true);
    assert.equal(finalStatus.payoutBlockers.length, 0);

    // 9. Verify rate limiting (6th login attempt for same email+IP returns 429)
    for (let i = 0; i < 5; i++) {
      await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'ratelimit@waverecords.test', password: 'WrongPassword123!' },
      });
    }
    const sixthAttempt = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'ratelimit@waverecords.test', password: 'WrongPassword123!' },
    });
    assert.equal(sixthAttempt.statusCode, 429);
  });
});
