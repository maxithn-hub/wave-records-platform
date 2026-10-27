import { type Result, ok, err, createDomainError } from '@wave/contracts';

/**
 * Validates standard Modulo-10 check digit for 12-digit UPC-A and 13-digit EAN-13 codes
 * required by DSPs and Revelator catalog ingestion.
 */
export function validateUpcOrEan(rawBarcode: string): Result<string> {
  const cleaned = rawBarcode.replace(/[-\s]/g, '');

  if (!/^\d{12,13}$/.test(cleaned)) {
    return err(
      createDomainError({
        code: 'VALIDATION_ERROR',
        moduleName: 'UPCValidator',
        message: `El código UPC/EAN ("${rawBarcode}") debe contener exactamente 12 (UPC-A) o 13 (EAN-13) dígitos numéricos.`,
      }),
    );
  }

  const digits = cleaned.split('').map(Number);
  const checkDigit = digits.pop()!;

  let sum = 0;
  const reversedPayload = [...digits].reverse();
  for (let i = 0; i < reversedPayload.length; i++) {
    const digit = reversedPayload[i]!;
    // Starting from rightmost payload position (index 0): weight is 3 for even index, 1 for odd index
    const weight = i % 2 === 0 ? 3 : 1;
    sum += digit * weight;
  }

  const expectedCheckDigit = (10 - (sum % 10)) % 10;

  if (checkDigit !== expectedCheckDigit) {
    return err(
      createDomainError({
        code: 'VALIDATION_ERROR',
        moduleName: 'UPCValidator',
        message: `Dígito verificador UPC/EAN inválido en "${cleaned}". Se esperaba ${expectedCheckDigit}, se recibió ${checkDigit}.`,
      }),
    );
  }

  return ok(cleaned);
}
