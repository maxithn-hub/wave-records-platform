import { type Result, ok, err, createDomainError } from '@wave/contracts';

export interface AudioSignalForensicsReport {
  readonly silenceRatio: number;
  readonly isConstantStaticFraud: boolean;
  readonly passedSignalForensics: boolean;
}

const MAX_ALLOWED_SILENCE_RATIO = 0.85; // Reject tracks that are >85% dead silence

/**
 * Inspects linear PCM audio samples (16-bit or 24-bit) to detect:
 * 1. Dead-air / silent track streaming fraud (silencedetect equivalent)
 * 2. Constant DC-offset / flat digital static noise fraud
 */
export function analyzePcmAudioSignalForensics(params: {
  wavBuffer: Buffer;
  bitDepth: number;
}): Result<AudioSignalForensicsReport> {
  if (params.wavBuffer.byteLength <= 44) {
    return err(
      createDomainError({
        code: 'FORENSIC_REJECTED',
        moduleName: 'PcmSilenceDetector',
        message: 'El archivo WAV no contiene muestras de audio después del encabezado.',
      }),
    );
  }

  const bytesPerSample = params.bitDepth === 24 ? 3 : 2;
  const pcmStartOffset = 44;
  const availableBytes = params.wavBuffer.byteLength - pcmStartOffset;
  const totalSamples = Math.floor(availableBytes / bytesPerSample);

  if (totalSamples === 0) {
    return err(
      createDomainError({
        code: 'FORENSIC_REJECTED',
        moduleName: 'PcmSilenceDetector',
        message: 'Muestras PCM insuficientes para análisis forense.',
      }),
    );
  }

  // Sample up to 20,000 evenly-spaced points across the track for fast deterministic analysis
  const step = Math.max(1, Math.floor(totalSamples / 20_000));
  let inspectedCount = 0;
  let silentCount = 0;
  let firstSampleValue: number | null = null;
  let allSamplesIdenticalNonZero = true;

  // Silence threshold (~ -50 dBFS): 100 for 16-bit, 25600 for 24-bit
  const silenceThreshold = params.bitDepth === 24 ? 25_600 : 100;

  for (let i = 0; i < totalSamples; i += step) {
    const bytePos = pcmStartOffset + i * bytesPerSample;
    if (bytePos + bytesPerSample > params.wavBuffer.byteLength) break;

    let sampleInt = 0;
    if (bytesPerSample === 2) {
      sampleInt = params.wavBuffer.readInt16LE(bytePos);
    } else {
      // 24-bit signed little-endian
      const b0 = params.wavBuffer[bytePos]!;
      const b1 = params.wavBuffer[bytePos + 1]!;
      const b2 = params.wavBuffer[bytePos + 2]!;
      const unsigned = b0 | (b1 << 8) | (b2 << 16);
      sampleInt = unsigned & 0x800000 ? unsigned | ~0xffffff : unsigned;
    }

    const absAmplitude = Math.abs(sampleInt);
    if (absAmplitude <= silenceThreshold) {
      silentCount += 1;
    }

    if (firstSampleValue === null) {
      firstSampleValue = sampleInt;
    } else if (sampleInt !== firstSampleValue) {
      allSamplesIdenticalNonZero = false;
    }

    inspectedCount += 1;
  }

  const silenceRatio = inspectedCount > 0 ? Number((silentCount / inspectedCount).toFixed(4)) : 1;

  if (silenceRatio > MAX_ALLOWED_SILENCE_RATIO) {
    return err(
      createDomainError({
        code: 'FORENSIC_REJECTED',
        moduleName: 'PcmSilenceDetector',
        message: `Fraude de silencio detectado (silencedetect): el ${(silenceRatio * 100).toFixed(1)}% del track es silencio absoluto (máximo permitido: 85%).`,
      }),
    );
  }

  // If >99% of samples have the exact same non-zero DC offset and file is large enough, flag static fraud
  const isConstantStaticFraud =
    inspectedCount >= 500 && allSamplesIdenticalNonZero && (firstSampleValue ?? 0) !== 0;

  if (isConstantStaticFraud) {
    return err(
      createDomainError({
        code: 'FORENSIC_REJECTED',
        moduleName: 'PcmSilenceDetector',
        message:
          'Fraude de señal detectado: onda estática plana sin variación musical (DC Offset / Static Bot Track).',
      }),
    );
  }

  return ok({
    silenceRatio,
    isConstantStaticFraud: false,
    passedSignalForensics: true,
  });
}
