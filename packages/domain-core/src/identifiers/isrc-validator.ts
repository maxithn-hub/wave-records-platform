import { type Result, ok, err, createDomainError } from '@wave/contracts';

/**
 * ISO 3901 Standard ISRC Format:
 * 2-char Country Code + 3-alphanumeric Registrant Code + 2-digit Year + 5-digit Designation Code
 */
const ISRC_NORMALIZED_REGEX = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;

export function normalizeAndValidateIsrc(rawInput: string): Result<string> {
  const cleaned = rawInput.replace(/[-\s]/g, '').toUpperCase();

  if (!ISRC_NORMALIZED_REGEX.test(cleaned)) {
    return err(
      createDomainError({
        code: 'VALIDATION_ERROR',
        moduleName: 'ISRCValidator',
        message: `Código ISRC inválido ("${rawInput}"). Debe cumplir ISO 3901 (12 caracteres alfanuméricos: CC-XXX-YY-NNNNN).`,
      }),
    );
  }

  return ok(cleaned);
}
