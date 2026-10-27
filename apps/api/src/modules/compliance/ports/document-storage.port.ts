import { type Result, ok, err, createDomainError } from '@wave/contracts';

export type AllowedComplianceMimeType = 'image/jpeg' | 'image/png' | 'application/pdf';

export interface StoredEncryptedDocument {
  readonly objectKey: string;
  readonly mimeType: AllowedComplianceMimeType;
  readonly ivHex: string;
  readonly authTagHex: string;
}

export interface DocumentStoragePort {
  saveEncryptedDocument(params: {
    tenantId: string;
    category: 'kyc' | 'tax-w8bene';
    rawBuffer: Buffer;
  }): Promise<Result<StoredEncryptedDocument>>;

  readDecryptedDocument(params: {
    objectKey: string;
    ivHex: string;
    authTagHex: string;
  }): Promise<Result<Buffer>>;
}

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Inspects file magic bytes (first 8 bytes) rather than trusting client-supplied extensions.
 * Allows only genuine JPEG, PNG, or PDF files up to 10 MB.
 */
export function detectAndValidateDocumentMagicBytes(
  rawBuffer: Buffer,
): Result<AllowedComplianceMimeType> {
  if (rawBuffer.byteLength === 0) {
    return err(
      createDomainError({
        code: 'VALIDATION_ERROR',
        moduleName: 'DocumentMagicByteValidator',
        message: 'El archivo subido está vacío.',
      }),
    );
  }

  if (rawBuffer.byteLength > MAX_DOCUMENT_BYTES) {
    return err(
      createDomainError({
        code: 'VALIDATION_ERROR',
        moduleName: 'DocumentMagicByteValidator',
        message: 'El documento supera el límite máximo permitido de 10 MB.',
      }),
    );
  }

  // PDF: %PDF- (25 50 44 46 2D)
  if (
    rawBuffer.byteLength >= 5 &&
    rawBuffer[0] === 0x25 &&
    rawBuffer[1] === 0x50 &&
    rawBuffer[2] === 0x44 &&
    rawBuffer[3] === 0x46 &&
    rawBuffer[4] === 0x2d
  ) {
    return ok('application/pdf');
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    rawBuffer.byteLength >= 8 &&
    rawBuffer[0] === 0x89 &&
    rawBuffer[1] === 0x50 &&
    rawBuffer[2] === 0x4e &&
    rawBuffer[3] === 0x47
  ) {
    return ok('image/png');
  }

  // JPEG: FF D8 FF
  if (
    rawBuffer.byteLength >= 3 &&
    rawBuffer[0] === 0xff &&
    rawBuffer[1] === 0xd8 &&
    rawBuffer[2] === 0xff
  ) {
    return ok('image/jpeg');
  }

  return err(
    createDomainError({
      code: 'VALIDATION_ERROR',
      moduleName: 'DocumentMagicByteValidator',
      message:
        'Formato de archivo rechazado por inspección de bytes mágicos. Solo se admiten PDF, PNG o JPEG auténticos.',
    }),
  );
}
