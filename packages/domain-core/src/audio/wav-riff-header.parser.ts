import { type Result, ok, err, createDomainError } from '@wave/contracts';

export interface WavTechnicalMetadata {
  readonly audioFormat: number; // 1 = Linear PCM
  readonly channels: number;
  readonly sampleRateHz: number;
  readonly bitDepth: number;
  readonly dataChunkBytes: number;
  readonly durationSeconds: number;
}

/**
 * Inspects the binary RIFF/WAVE header of an uploaded audio file.
 * Strictly enforces Wave Records LLC & DSP ingestion rules:
 * - Must be genuine RIFF/WAVE container
 * - Audio format must be 1 (Uncompressed Linear PCM: pcm_s16le or pcm_s24le)
 * - Channels must be 2 (Stereo)
 * - Sample rate must be >= 44100 Hz
 * - Bit depth must be 16 or 24 bits
 */
export function parseAndValidateWavPcmHeader(
  headerOrFullBuffer: Buffer,
  totalFileBytes?: number,
): Result<WavTechnicalMetadata> {
  if (headerOrFullBuffer.byteLength < 44) {
    return err(
      createDomainError({
        code: 'FORENSIC_REJECTED',
        moduleName: 'WavPcmHeaderParser',
        message: 'El archivo es demasiado pequeño para contener un encabezado RIFF/WAVE válido.',
      }),
    );
  }

  const riffTag = headerOrFullBuffer.subarray(0, 4).toString('ascii');
  const waveTag = headerOrFullBuffer.subarray(8, 12).toString('ascii');

  if (riffTag !== 'RIFF' || waveTag !== 'WAVE') {
    return err(
      createDomainError({
        code: 'FORENSIC_REJECTED',
        moduleName: 'WavPcmHeaderParser',
        message:
          'Archivo rechazado: no es un contenedor RIFF/WAVE auténtico (posible MP3 renombrado a .wav).',
      }),
    );
  }

  // Scan chunks starting at byte 12 to locate "fmt " and "data"
  let offset = 12;
  let audioFormat = 0;
  let channels = 0;
  let sampleRateHz = 0;
  let byteRate = 0;
  let bitDepth = 0;
  let dataChunkBytes = 0;
  let foundFmt = false;

  while (offset + 8 <= headerOrFullBuffer.byteLength) {
    const chunkId = headerOrFullBuffer.subarray(offset, offset + 4).toString('ascii');
    const chunkSize = headerOrFullBuffer.readUInt32LE(offset + 4);

    if (chunkId === 'fmt ' && offset + 8 + 16 <= headerOrFullBuffer.byteLength) {
      audioFormat = headerOrFullBuffer.readUInt16LE(offset + 8);
      channels = headerOrFullBuffer.readUInt16LE(offset + 10);
      sampleRateHz = headerOrFullBuffer.readUInt32LE(offset + 12);
      byteRate = headerOrFullBuffer.readUInt32LE(offset + 16);
      bitDepth = headerOrFullBuffer.readUInt16LE(offset + 22);
      foundFmt = true;
    } else if (chunkId === 'data') {
      dataChunkBytes = chunkSize;
      break;
    }

    offset += 8 + chunkSize + (chunkSize % 2);
  }

  if (!foundFmt) {
    return err(
      createDomainError({
        code: 'FORENSIC_REJECTED',
        moduleName: 'WavPcmHeaderParser',
        message: 'Encabezado WAV corrupto: no se encontró el bloque "fmt ".',
      }),
    );
  }

  if (audioFormat !== 1) {
    return err(
      createDomainError({
        code: 'FORENSIC_REJECTED',
        moduleName: 'WavPcmHeaderParser',
        message: `Formato de audio WAV no permitido (código ${audioFormat}). Se exige estrictamente PCM lineal sin comprimir (pcm_s16le o pcm_s24le).`,
      }),
    );
  }

  if (channels !== 2) {
    return err(
      createDomainError({
        code: 'FORENSIC_REJECTED',
        moduleName: 'WavPcmHeaderParser',
        message: `Configuración de canales inválida (${channels} canal[es]). Se exige audio Estéreo (2 canales).`,
      }),
    );
  }

  if (sampleRateHz < 44100) {
    return err(
      createDomainError({
        code: 'FORENSIC_REJECTED',
        moduleName: 'WavPcmHeaderParser',
        message: `Frecuencia de muestreo insuficiente (${sampleRateHz} Hz). El mínimo exigido por los DSPs es 44100 Hz.`,
      }),
    );
  }

  if (bitDepth !== 16 && bitDepth !== 24) {
    return err(
      createDomainError({
        code: 'FORENSIC_REJECTED',
        moduleName: 'WavPcmHeaderParser',
        message: `Profundidad de bits inválida (${bitDepth}-bit). Solo se admite WAV PCM de 16-bit o 24-bit.`,
      }),
    );
  }

  const effectiveDataBytes =
    dataChunkBytes > 0
      ? dataChunkBytes
      : Math.max(0, (totalFileBytes ?? headerOrFullBuffer.byteLength) - 44);

  const computedByteRate =
    byteRate > 0 ? byteRate : sampleRateHz * channels * (bitDepth / 8);

  const durationSeconds =
    computedByteRate > 0 ? Math.max(1, Math.round(effectiveDataBytes / computedByteRate)) : 1;

  return ok({
    audioFormat,
    channels,
    sampleRateHz,
    bitDepth,
    dataChunkBytes: effectiveDataBytes,
    durationSeconds,
  });
}
