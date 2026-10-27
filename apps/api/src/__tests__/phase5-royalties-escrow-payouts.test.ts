import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { loadApiEnv } from '../config/env.schema.js';
import { getPrismaClient } from '../infrastructure/prisma/prisma.service.js';
import { createWaveApiApp } from '../http/create-app.js';
import { cleanWaveTestDatabase } from './test-db-cleaner.js';

describe('@wave/api - Phase 5 Financial Engine (DECIMAL(18,10) Ledger, Ghost Account Escrow Splits & Idempotent Payouts)', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  const testQuarantineDir = './storage/test-quarantine-phase5';
  const testKycDir = './storage/test-kyc-phase5';

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

  it('enforces 100.0000000000% splits, holds Ghost Account shares in Escrow until claimed, prevents double-ingest/double-payout via Idempotency-Key, and blocks payouts without KYC/Tax', async () => {
    // 1. Register Owner Producer Tenant
    const regOwner = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        tier: 'INDIVIDUAL_LAUNCH',
        legalName: 'Valeria Owner Producer',
        displayName: 'Valeria Music LLC',
        countryCode: 'CO',
        email: 'owner.phase5@waverecords.test',
        password: 'OwnerPhase5Password!',
        acceptTerms: true,
      },
    });
    assert.equal(regOwner.statusCode, 201);
    const ownerToken: string = regOwner.json().value.accessToken;
    const meOwner = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const ownerTenantId: string = meOwner.json().value.tenant.id;

    // Create a Release & Track
    const relRes = await app.inject({
      method: 'POST',
      url: '/catalog/releases',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        title: 'Regalías Exactas (feat. Ghost Collab)',
        primaryArtist: 'Valeria Music',
        releaseType: 'SINGLE',
        primaryGenre: 'Latin Urban',
        pLineYear: 2026,
        pLineOwner: 'Valeria Music LLC',
        cLineYear: 2026,
        cLineOwner: 'Valeria Music LLC',
      },
    });
    const releaseId: string = relRes.json().value.releaseId;

    const trackRes = await app.inject({
      method: 'POST',
      url: `/catalog/releases/${releaseId}/tracks`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        trackNumber: 1,
        title: 'Regalías Exactas (feat. Ghost Collab)',
        primaryArtist: 'Valeria Music',
        isExplicit: false,
        isInstrumental: false,
        audioLanguage: 'es',
        isrcCode: 'USWVR2690501',
      },
    });
    const trackId: string = trackRes.json().value.trackId;

    // 2. Reject invalid splits that do not sum to 100.0000000000% (e.g., 99.5%)
    const invalidSplitsRes = await app.inject({
      method: 'POST',
      url: `/royalties/tracks/${trackId}/splits`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        splits: [
          {
            collaboratorEmail: 'owner.phase5@waverecords.test',
            sharePercentage: '70.0000000000',
          },
          {
            collaboratorEmail: 'ghost.collab@waverecords.test',
            sharePercentage: '29.5000000000',
          },
        ],
      },
    });
    assert.equal(invalidSplitsRes.statusCode, 422);

    // 3. Configure valid 70.0000000000% (Active Owner) + 30.0000000000% (Unregistered Ghost Account)
    const validSplitsRes = await app.inject({
      method: 'POST',
      url: `/royalties/tracks/${trackId}/splits`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        splits: [
          {
            collaboratorEmail: 'owner.phase5@waverecords.test',
            sharePercentage: '70.0000000000',
          },
          {
            collaboratorEmail: 'ghost.collab@waverecords.test',
            sharePercentage: '30.0000000000',
          },
        ],
      },
    });
    assert.equal(validSplitsRes.statusCode, 200);
    const configuredSplits = validSplitsRes.json().value;
    assert.equal(configuredSplits.length, 2);
    assert.equal(configuredSplits[0].status, 'ACCEPTED_ACTIVE');
    assert.equal(configuredSplits[0].collaboratorTenantId, ownerTenantId);
    assert.equal(configuredSplits[1].status, 'PENDING_INVITATION_ESCROW');
    assert.equal(configuredSplits[1].collaboratorTenantId, null);

    // 4. Ingest $1,000.0000000000 gross revenue from SPOTIFY
    // Wave 15% commission = $150.0000000000 -> Net Distributable = $850.0000000000
    // Owner 70% of $850 = $595.0000000000 | Ghost 30% of $850 = $255.0000000000 (Held in Escrow)
    const ingestRes1 = await app.inject({
      method: 'POST',
      url: '/royalties/statements/ingest',
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'idempotency-key': 'stmt-spotify-2026-10-001',
      },
      payload: {
        trackId,
        dspStore: 'SPOTIFY',
        countryCode: 'US',
        streamsCount: 250000,
        grossRevenueUsd: '1000.0000000000',
      },
    });
    assert.equal(ingestRes1.statusCode, 200);
    const stmt1 = ingestRes1.json().value;
    assert.equal(stmt1.idempotentReplay, false);
    assert.equal(stmt1.grossRevenueUsd, '1000.0000000000');
    assert.equal(stmt1.waveCommissionUsd, '150.0000000000');
    assert.equal(stmt1.netDistributableUsd, '850.0000000000');
    assert.equal(stmt1.totalHeldInEscrowUsd, '255.0000000000');

    // Replay same statement with same Idempotency-Key -> must NOT double-credit!
    const ingestReplay = await app.inject({
      method: 'POST',
      url: '/royalties/statements/ingest',
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'idempotency-key': 'stmt-spotify-2026-10-001',
      },
      payload: {
        trackId,
        dspStore: 'SPOTIFY',
        countryCode: 'US',
        streamsCount: 250000,
        grossRevenueUsd: '1000.0000000000',
      },
    });
    assert.equal(ingestReplay.statusCode, 200);
    assert.equal(ingestReplay.json().value.idempotentReplay, true);

    // Check Owner's Dashboard: availableBalanceUsd must be exactly 595.0000000000
    const ownerDash1 = await app.inject({
      method: 'GET',
      url: '/royalties/dashboard',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(ownerDash1.statusCode, 200);
    assert.equal(ownerDash1.json().value.availableBalanceUsd, '595.0000000000');
    assert.equal(ownerDash1.json().value.totalEscrowHeldByMyTracksUsd, '255.0000000000');

    // 5. Ghost Account Collaborator registers with ghost.collab@waverecords.test and claims Escrow!
    const regGhost = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        tier: 'INDIVIDUAL_LAUNCH',
        legalName: 'Diego Ghost Collaborator',
        displayName: 'Diego Producer',
        countryCode: 'MX',
        email: 'ghost.collab@waverecords.test',
        password: 'GhostCollabPassword123!',
        acceptTerms: true,
      },
    });
    assert.equal(regGhost.statusCode, 201);
    const ghostToken: string = regGhost.json().value.accessToken;

    const claimRes = await app.inject({
      method: 'POST',
      url: '/royalties/splits/claim-escrow',
      headers: { authorization: `Bearer ${ghostToken}` },
    });
    assert.equal(claimRes.statusCode, 200);
    const claimSummary = claimRes.json().value;
    assert.equal(claimSummary.activatedSplitsCount, 1);
    assert.equal(claimSummary.releasedEscrowHoldsCount, 1);
    assert.equal(claimSummary.totalReleasedUsd, '255.0000000000');
    assert.equal(claimSummary.newRunningBalanceUsd, '255.0000000000');

    // 6. Verify Compliance Gate: Ghost Collaborator (KYC/Tax not verified) is blocked from Payout (403)
    const blockedPayoutRes = await app.inject({
      method: 'POST',
      url: '/royalties/payouts',
      headers: {
        authorization: `Bearer ${ghostToken}`,
        'idempotency-key': 'payout-ghost-blocked-001',
      },
      payload: {
        requestedAmountUsd: '100.0000000000',
      },
    });
    assert.equal(blockedPayoutRes.statusCode, 403);
    assert.equal(blockedPayoutRes.json().error.code, 'TAX_COMPLIANCE_REQUIRED');

    // 7. Activate Owner's KYC + IRS Tax (VERIFIED + VALIDATED + ACTIVE) and test Idempotent Payout
    await prisma.tenant.update({
      where: { id: ownerTenantId },
      data: { status: 'ACTIVE' },
    });
    await prisma.kycVerification.create({
      data: {
        tenantId: ownerTenantId,
        status: 'VERIFIED',
        documentType: 'PASSPORT',
        verifiedAt: new Date(),
      },
    });
    await prisma.taxDeclaration.create({
      data: {
        tenantId: ownerTenantId,
        formType: 'W8BEN',
        status: 'VALIDATED',
        taxpayerLegalName: 'Valeria Owner Producer',
        residenceCountryCode: 'CO',
        electronicSignature: 'Valeria Owner Producer',
      },
    });

    const payoutRes1 = await app.inject({
      method: 'POST',
      url: '/royalties/payouts',
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'idempotency-key': 'payout-owner-2026-001',
      },
      payload: {
        requestedAmountUsd: '200.0000000000',
      },
    });
    assert.equal(payoutRes1.statusCode, 200);
    assert.equal(payoutRes1.json().value.idempotentReplay, false);
    assert.equal(payoutRes1.json().value.requestedAmount, '200.0000000000');
    assert.equal(payoutRes1.json().value.remainingBalanceUsd, '395.0000000000');

    // Replay same Payout with same Idempotency-Key -> must NOT deduct again!
    const payoutReplay = await app.inject({
      method: 'POST',
      url: '/royalties/payouts',
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'idempotency-key': 'payout-owner-2026-001',
      },
      payload: {
        requestedAmountUsd: '200.0000000000',
      },
    });
    assert.equal(payoutReplay.statusCode, 200);
    assert.equal(payoutReplay.json().value.idempotentReplay, true);
    assert.equal(payoutReplay.json().value.remainingBalanceUsd, '395.0000000000');
  });
});
