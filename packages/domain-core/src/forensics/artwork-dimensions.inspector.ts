import { type Result, ok, err, createDomainError } from '@wave/contracts';

export interface ArtworkInspectionReport {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly colorSpace: 'RGB' | 'GRAYSCALE' | 'CMYK';
  readonly format: 'PNG' | 'JPEG';
}

const MIN_DSP_ARTWORK_DIMENSION_PX = 3000;

/**
 * Inspects binary PNG (IHDR chunk) and JPEG (SOF0/SOF2 markers) headers to verify:
 * 1. Exact 1:1 square aspect ratio (width === height)
 * 2. Minimum 3000x3000 px resolution
 * 3. Strictly RGB color space (rejects CMYK 4-channel and Grayscale 1-channel)
 */
export function inspectAndValidateArtworkBuffer(
  imageBuffer: Buffer,
): Result<ArtworkInspectionReport> {
  // 1. Check PNG IHDR (8-byte PNG signature + 4-byte length + 'IHDR' + 4-byte width + 4-byte height + bitDepth + colorType)
  if (
    imageBuffer.byteLength >= 26 &&
    imageBuffer[0] === 0x89 &&
    imageBuffer[1] === 0x50 &&
    imageBuffer[2] === 0x4e &&
    imageBuffer[3] === 0x47
  ) {
    const widthPx = imageBuffer.readUInt32BE(16);
    const heightPx = imageBuffer.readUInt32BE(20);
    const pngColorType = imageBuffer[25]!;
    // PNG colorType: 2 = Truecolor RGB, 6 = Truecolor RGBA, 0/4 = Grayscale
    const colorSpace =
      pngColorType === 2 || pngColorType === 6 ? 'RGB' : 'GRAYSCALE';

    return validateExtractedArtworkAttributes({
      widthPx,
      heightPx,
      colorSpace,
      format: 'PNG',
    });
  }

  // 2. Check JPEG SOF markers (FF D8 ... FF C0 / FF C2)
  if (
    imageBuffer.byteLength >= 20 &&
    imageBuffer[0] === 0xff &&
    imageBuffer[1] === 0xd8
  ) {
    let offset = 2;
    while (offset + 9 < imageBuffer.byteLength) {
      if (imageBuffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = imageBuffer[offset + 1]!;
      // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2)
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        const heightPx = imageBuffer.readUInt16BE(offset + 5);
        const widthPx = imageBuffer.readUInt16BE(offset + 7);
        const components = imageBuffer[offset + 9]!;
        const colorSpace =
          components === 3 ? 'RGB' : components === 4 ? 'CMYK' : 'GRAYSCALE';

        return validateExtractedArtworkAttributes({
          widthPx,
          heightPx,
          colorSpace,
          format: 'JPEG',
        });
      }

      const segmentLength = imageBuffer.readUInt16BE(offset + 2);
      if (segmentLength < 2) break;
      offset += 2 + segmentLength;
    }
  }

  return err(
    createDomainError({
      code: 'FORENSIC_REJECTED',
      moduleName: 'ArtworkDimensionsInspector',
      message: 'No se pudieron leer las dimensiones binarias de la portada (PNG/JPEG inválido).',
    }),
  );
}

function validateExtractedArtworkAttributes(
  report: ArtworkInspectionReport,
): Result<ArtworkInspectionReport> {
  if (report.colorSpace !== 'RGB') {
    return err(
      createDomainError({
        code: 'FORENSIC_REJECTED',
        moduleName: 'ArtworkDimensionsInspector',
        message: `Espacio de color inválido en portada (${report.colorSpace}). Los DSPs exigen estrictamente espacio de color RGB.`,
      }),
    );
  }

  if (report.widthPx !== report.heightPx) {
    return err(
      createDomainError({
        code: 'FORENSIC_REJECTED',
        moduleName: 'ArtworkDimensionsInspector',
        message: `La portada debe ser estrictamente cuadrada 1:1 (recibido: ${report.widthPx}x${report.heightPx} px).`,
      }),
    );
  }

  if (report.widthPx < MIN_DSP_ARTWORK_DIMENSION_PX) {
    return err(
      createDomainError({
        code: 'FORENSIC_REJECTED',
        moduleName: 'ArtworkDimensionsInspector',
        message: `Resolución de portada insuficiente (${report.widthPx}x${report.heightPx} px). Se exige mínimo 3000x3000 px en RGB.`,
      }),
    );
  }

  return ok(report);
}
