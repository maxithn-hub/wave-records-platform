import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { type Result, ok, err, createDomainError } from '@wave/contracts';

export interface EncryptedFieldEnvelope {
  readonly ciphertextHex: string;
  readonly ivHex: string;
  readonly authTagHex: string;
}

const ALGORITHM = 'aes-256-gcm';
const IV_BYTE_LENGTH = 12; // 96-bit IV recommended by NIST for AES-GCM

/**
 * Field-level AES-256-GCM encryption for sensitive IRS Tax IDs (SSN, EIN, Foreign TIN).
 * Ensures plaintext tax identifiers are never stored in PostgreSQL or logs.
 */
export function encryptSensitiveTaxIdentifier(
  plaintextTaxId: string,
  masterKeyHex: string,
): Result<EncryptedFieldEnvelope> {
  try {
    const keyBuffer = Buffer.from(masterKeyHex, 'hex');
    if (keyBuffer.byteLength !== 32) {
      return err(
        createDomainError({
          code: 'INTERNAL_MODULE_FAULT',
          moduleName: 'AesGcmCipher',
          message: 'La llave maestra AES-256 debe tener exactamente 32 bytes (64 caracteres hex).',
        }),
      );
    }

    const iv = randomBytes(IV_BYTE_LENGTH);
    const cipher = createCipheriv(ALGORITHM, keyBuffer, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintextTaxId, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return ok({
      ciphertextHex: encrypted.toString('hex'),
      ivHex: iv.toString('hex'),
      authTagHex: authTag.toString('hex'),
    });
  } catch (caught: unknown) {
    return err(
      createDomainError({
        code: 'INTERNAL_MODULE_FAULT',
        moduleName: 'AesGcmCipher',
        message:
          caught instanceof Error
            ? caught.message
            : 'Error al cifrar identificador fiscal.',
      }),
    );
  }
}

export function decryptSensitiveTaxIdentifier(
  envelope: EncryptedFieldEnvelope,
  masterKeyHex: string,
): Result<string> {
  try {
    const keyBuffer = Buffer.from(masterKeyHex, 'hex');
    if (keyBuffer.byteLength !== 32) {
      return err(
        createDomainError({
          code: 'INTERNAL_MODULE_FAULT',
          moduleName: 'AesGcmCipher',
          message: 'La llave maestra AES-256 debe tener exactamente 32 bytes.',
        }),
      );
    }

    const decipher = createDecipheriv(
      ALGORITHM,
      keyBuffer,
      Buffer.from(envelope.ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(envelope.authTagHex, 'hex'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertextHex, 'hex')),
      decipher.final(),
    ]);

    return ok(decrypted.toString('utf8'));
  } catch {
    return err(
      createDomainError({
        code: 'INTEGRITY_CHECK_FAILED',
        moduleName: 'AesGcmCipher',
        message: 'Fallo de integridad criptográfica (AuthTag inválido o datos fiscales alterados).',
      }),
    );
  }
}
