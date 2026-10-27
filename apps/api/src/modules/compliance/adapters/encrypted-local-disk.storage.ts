import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { type Result, ok, err, createDomainError } from '@wave/contracts';
import {
  type DocumentStoragePort,
  type StoredEncryptedDocument,
  detectAndValidateDocumentMagicBytes,
} from '../ports/document-storage.port.js';

/**
 * Local Disk Encrypted Storage Adapter (Phase 1).
 * Encrypts every KYC / W-8BEN-E document with AES-256-GCM before writing to disk.
 * In Phase 2, this adapter can be swapped for S3/R2 without changing any use-case.
 */
export class EncryptedLocalDiskStorageAdapter implements DocumentStoragePort {
  private readonly baseDir: string;
  private readonly keyBuffer: Buffer;

  public constructor(baseDir: string, masterKeyHex: string) {
    this.baseDir = resolve(baseDir);
    this.keyBuffer = Buffer.from(masterKeyHex, 'hex');
    if (this.keyBuffer.byteLength !== 32) {
      throw new Error('KYC_DOCUMENT_ENCRYPTION_KEY_HEX debe tener 32 bytes (64 hex chars).');
    }
  }

  public async saveEncryptedDocument(params: {
    tenantId: string;
    category: 'kyc' | 'tax-w8bene';
    rawBuffer: Buffer;
  }): Promise<Result<StoredEncryptedDocument>> {
    const mimeCheck = detectAndValidateDocumentMagicBytes(params.rawBuffer);
    if (!mimeCheck.ok) {
      return mimeCheck;
    }

    try {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', this.keyBuffer, iv);
      const encryptedBytes = Buffer.concat([
        cipher.update(params.rawBuffer),
        cipher.final(),
      ]);
      const authTag = cipher.getAuthTag();

      const objectKey = `${params.category}/${params.tenantId}/${randomUUID()}.enc`;
      const fullPath = join(this.baseDir, objectKey);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, encryptedBytes);

      return ok({
        objectKey,
        mimeType: mimeCheck.value,
        ivHex: iv.toString('hex'),
        authTagHex: authTag.toString('hex'),
      });
    } catch (caught: unknown) {
      return err(
        createDomainError({
          code: 'INTERNAL_MODULE_FAULT',
          moduleName: 'EncryptedLocalDiskStorageAdapter',
          message:
            caught instanceof Error
              ? caught.message
              : 'No se pudo almacenar el documento cifrado.',
        }),
      );
    }
  }

  public async readDecryptedDocument(params: {
    objectKey: string;
    ivHex: string;
    authTagHex: string;
  }): Promise<Result<Buffer>> {
    try {
      const fullPath = resolve(this.baseDir, params.objectKey);
      if (!fullPath.startsWith(this.baseDir)) {
        return err(
          createDomainError({
            code: 'FORBIDDEN_IDOR',
            moduleName: 'EncryptedLocalDiskStorageAdapter',
            message: 'Ruta de documento fuera del directorio permitido.',
          }),
        );
      }

      const encryptedBytes = await readFile(fullPath);
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.keyBuffer,
        Buffer.from(params.ivHex, 'hex'),
      );
      decipher.setAuthTag(Buffer.from(params.authTagHex, 'hex'));

      const decryptedBytes = Buffer.concat([
        decipher.update(encryptedBytes),
        decipher.final(),
      ]);

      return ok(decryptedBytes);
    } catch {
      return err(
        createDomainError({
          code: 'INTEGRITY_CHECK_FAILED',
          moduleName: 'EncryptedLocalDiskStorageAdapter',
          message: 'Fallo al descifrar o verificar autenticidad del documento KYC.',
        }),
      );
    }
  }
}
