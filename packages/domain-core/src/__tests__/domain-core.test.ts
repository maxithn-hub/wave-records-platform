import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePlatformCapabilities,
  normalizeAndValidateIsrc,
  validateUpcOrEan,
  validateRoyaltySplitsTotal,
  computeRoyaltyNetDistribution,
  validateReleaseStateTransition,
  isReleaseEditableByTenant,
} from '../index.js';

describe('@wave/domain-core - Phase 0 Architecture & Domain Suite', () => {
  it('disables lossless WAV upload on CAPACITOR_ANDROID while keeping Web Desktop full-featured', () => {
    const webCaps = resolvePlatformCapabilities('WEB_DESKTOP');
    const androidCaps = resolvePlatformCapabilities('CAPACITOR_ANDROID');

    assert.equal(webCaps.canUploadLosslessWav, true);
    assert.equal(webCaps.canAccessAdminBackoffice, true);

    assert.equal(androidCaps.canUploadLosslessWav, false);
    assert.equal(androidCaps.canApproveSplits, true);
    assert.equal(androidCaps.canRequestRoyaltyPayout, true);
    assert.equal(androidCaps.supportsNativePushNotifications, true);
  });

  it('validates and normalizes ISO 3901 ISRC codes accurately', () => {
    const valid = normalizeAndValidateIsrc('us-rc1-26-00451');
    assert.equal(valid.ok, true);
    if (valid.ok) {
      assert.equal(valid.value, 'USRC12600451');
    }

    const invalid = normalizeAndValidateIsrc('INVALID-ISRC');
    assert.equal(invalid.ok, false);
  });

  it('validates Modulo-10 check digits for UPC-12 and rejects tampered barcodes', () => {
    const validUpc = validateUpcOrEan('036000291452');
    assert.equal(validUpc.ok, true);

    const invalidUpc = validateUpcOrEan('036000291459');
    assert.equal(invalidUpc.ok, false);
  });

  it('enforces exact 100.0000000000% royalty splits using DECIMAL(18, 10) fixed-point math', () => {
    const exactSplits = validateRoyaltySplitsTotal([
      { participantIdentifier: 'artist@wave.com', percentageStr: '50.3333333333' },
      { participantIdentifier: 'producer@wave.com', percentageStr: '49.6666666667' },
    ]);
    assert.equal(exactSplits.ok, true);

    const driftedSplits = validateRoyaltySplitsTotal([
      { participantIdentifier: 'artist@wave.com', percentageStr: '50.0000000000' },
      { participantIdentifier: 'producer@wave.com', percentageStr: '49.9999999999' },
    ]);
    assert.equal(driftedSplits.ok, false);
  });

  it('computes Wave Records LLC commission and net artist royalty with 10-decimal precision', () => {
    const calc = computeRoyaltyNetDistribution({
      grossRevenueStr: '0.0034819205',
      waveCommissionPercentStr: '15.0000000000',
    });
    assert.equal(calc.ok, true);
    if (calc.ok) {
      assert.equal(calc.value.commissionFormatted, '0.0005222880');
      assert.equal(calc.value.netDistributableFormatted, '0.0029596325');
    }
  });

  it('enforces Release Finite State Machine transitions and blocks direct bypass to LIVE_ON_DSPS', () => {
    const illegalBypass = validateReleaseStateTransition('DRAFT', 'LIVE_ON_DSPS');
    assert.equal(illegalBypass.ok, false);

    const legalStep = validateReleaseStateTransition('FORENSIC_PROCESSING', 'MANUAL_COPYRIGHT_REVIEW');
    assert.equal(legalStep.ok, true);

    assert.equal(isReleaseEditableByTenant('DRAFT'), true);
    assert.equal(isReleaseEditableByTenant('LIVE_ON_DSPS'), false);
  });
});
