import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { type Result, ok, err, createDomainError } from '@wave/contracts';
import type {
  AssembledQuarantineAsset,
  QuarantineMultipartStoragePort,
} from '../ports/quarantine-multipart.port.js';

export class LocalQuarantineMultipartStorageAdapter
  implements QuarantineMultipartStoragePort
{
  private readonly baseDir: string;

  public constructor(baseDir = './storage/quarantine') {
    this.baseDir = resolve(baseDir);
  }

  public async writeUploadChunk(params: {
    uploadSessionId: string;
    partNumber: number;
    chunkBuffer: Buffer;
  }): Promise<Result<{ partNumber: number; byteLength: number }>> {
    if (params.chunkBuffer.byteLength === 0) {
      return err(
        createDomainError({
          code: 'VALIDATION_ERROR',
          moduleName: 'LocalQuarantineMultipartStorage',
          message: `El fragmento (part #${params.partNumber}) está vacío.`,
        }),
      );
    }

    try {
      const partPath = join(
        this.baseDir,
        '_staging',
        params.uploadSessionId,
        `part-${String(params.partNumber).padStart(5, '0')}.bin`,
      );
      await mkdir(dirname(partPath), { recursive: true });
      await writeFile(partPath, params.chunkBuffer);

      return ok({
        partNumber: params.partNumber,
        byteLength: params.chunkBuffer.byteLength,
      });
    } catch (caught: unknown) {
      return err(
        createDomainError({
          code: 'INTERNAL_MODULE_FAULT',
          moduleName: 'LocalQuarantineMultipartStorage',
          message:
            caught instanceof Error
              ? caught.message
              : 'Error al escribir fragmento en cuarentena.',
        }),
      );
    }
  }

  public async assembleAndVerifyMultipartUpload(params: {
    uploadSessionId: string;
    tenantId: string;
    releaseId: string;
    totalParts: number;
    expectedSha256Hex: string;
    extension: 'wav' | 'img';
  }): Promise<Result<AssembledQuarantineAsset>> {
    const stagingDir = join(this.baseDir, '_staging', params.uploadSessionId);

    try {
      const buffers: Buffer[] = [];
      const hash = createHash('sha256');

      for (let part = 1; part <= params.totalParts; part++) {
        const partPath = join(
          stagingDir,
          `part-${String(part).padStart(5, '0')}.bin`,
        );
        const partBytes = await readFile(partPath).catch(() => null);
        if (!partBytes) {
          return err(
            createDomainError({
              code: 'VALIDATION_ERROR',
              moduleName: 'LocalQuarantineMultipartStorage',
              message: `Falta el fragmento #${part} de ${params.totalParts} para completar el ensamblaje.`,
            }),
          );
        }
        hash.update(partBytes);
        buffers.push(partBytes);
      }

      const actualSha256Hex = hash.digest('hex').toLowerCase();
      if (actualSha256Hex !== params.expectedSha256Hex.toLowerCase()) {
        await rm(stagingDir, { recursive: true, force: true }).catch(() => null);
        return err(
          createDomainError({
            code: 'INTEGRITY_CHECK_FAILED',
            moduleName: 'LocalQuarantineMultipartStorage',
            message: `Fallo de integridad SHA-256: se esperaba ${params.expectedSha256Hex}, pero el archivo ensamblado produjo ${actualSha256Hex}.`,
          }),
        );
      }

      const fullBuffer = Buffer.concat(buffers);
      const quarantineObjectKey = `tenants/${params.tenantId}/releases/${params.releaseId}/${params.uploadSessionId}.${params.extension}`;
      const finalPath = join(this.baseDir, quarantineObjectKey);

      await mkdir(dirname(finalPath), { recursive: true });
      await writeFile(finalPath, fullBuffer);
      await rm(stagingDir, { recursive: true, force: true }).catch(() => null);

      return ok({
        quarantineObjectKey,
        actualSha256Hex,
        totalBytes: fullBuffer.byteLength,
        headerSampleBuffer: fullBuffer.subarray(0, Math.min(fullBuffer.byteLength, 4096)),
      });
    } catch (caught: unknown) {
      return err(
        createDomainError({
          code: 'INTERNAL_MODULE_FAULT',
          moduleName: 'LocalQuarantineMultipartStorage',
          message:
            caught instanceof Error
              ? caught.message
              : 'Error al ensamblar fragmentos de cuarentena.',
        }),
      );
    }
  }
}
