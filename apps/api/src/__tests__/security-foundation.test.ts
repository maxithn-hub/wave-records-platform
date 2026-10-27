import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  encryptSensitiveTaxIdentifier,
  decryptSensitiveTaxIdentifier,
  enforceTenantIsolation,
  executeIsolatedUseCase,
} from '../main.js';

const TEST_MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('@wave/api - Phase 0 Security, Encryption & Fault Isolation Suite', () => {
  it('encrypts SSN/FTIN with AES-256-GCM and detects any ciphertext or authTag tampering', () => {
    const rawSsn = '123456789';
    const encryptedResult = encryptSensitiveTaxIdentifier(rawSsn, TEST_MASTER_KEY);
    assert.equal(encryptedResult.ok, true);

    if (encryptedResult.ok) {
      assert.notEqual(encryptedResult.value.ciphertextHex, rawSsn);

      const decryptedResult = decryptSensitiveTaxIdentifier(
        encryptedResult.value,
        TEST_MASTER_KEY,
      );
      assert.equal(decryptedResult.ok, true);
      if (decryptedResult.ok) {
        assert.equal(decryptedResult.value, rawSsn);
      }

      // Tamper with authTag to verify GCM integrity rejection
      const tampered = decryptSensitiveTaxIdentifier(
        {
          ...encryptedResult.value,
          authTagHex: '00000000000000000000000000000000',
        },
        TEST_MASTER_KEY,
      );
      assert.equal(tampered.ok, false);
      if (!tampered.ok) {
        assert.equal(tampered.error.code, 'INTEGRITY_CHECK_FAILED');
      }
    }
  });

  it('prevents cross-tenant IDOR access and blocks client-injected Revelator IDs', () => {
    const tenantASession = {
      userId: 'user-1',
      sessionTenantId: 'tenant-uuid-A',
      role: 'TENANT_OWNER' as const,
    };

    // Cross-tenant attempt (Tenant A trying to access Tenant B)
    const crossTenantAttempt = enforceTenantIsolation({
      session: tenantASession,
      targetResourceTenantId: 'tenant-uuid-B',
    });
    assert.equal(crossTenantAttempt.ok, false);
    if (!crossTenantAttempt.ok) {
      assert.equal(crossTenantAttempt.error.code, 'FORBIDDEN_IDOR');
    }

    // Attempt to inject revelatorEnterpriseId from client query/body
    const injectedParamAttempt = enforceTenantIsolation({
      session: tenantASession,
      targetResourceTenantId: 'tenant-uuid-A',
      clientSuppliedHeadersOrQuery: { revelatorEnterpriseId: 99999 },
    });
    assert.equal(injectedParamAttempt.ok, false);

    // Valid same-tenant access
    const validAccess = enforceTenantIsolation({
      session: tenantASession,
      targetResourceTenantId: 'tenant-uuid-A',
    });
    assert.equal(validAccess.ok, true);
  });

  it('contains unexpected exceptions inside executeIsolatedUseCase without crashing process', async () => {
    const crashedUseCaseResult = await executeIsolatedUseCase('RoyaltyPayoutUseCase', async () => {
      throw new Error('Simulated database connection timeout');
    });

    assert.equal(crashedUseCaseResult.ok, false);
    if (!crashedUseCaseResult.ok) {
      assert.equal(crashedUseCaseResult.error.code, 'INTERNAL_MODULE_FAULT');
      assert.equal(crashedUseCaseResult.error.moduleName, 'RoyaltyPayoutUseCase');
      assert.ok(crashedUseCaseResult.error.traceId);
    }
  });
});
