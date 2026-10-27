import { type Result, ok, err, createDomainError } from '@wave/contracts';

/**
 * Fixed-point arithmetic engine matching PostgreSQL DECIMAL(18, 10).
 * 1 unit = 10^10 micro-units (10_000_000_000n).
 * Prevents IEEE-754 floating-point drift in royalty calculations and split distributions.
 */
export const DECIMAL_SCALE = 10;
export const SCALE_FACTOR = 10_000_000_000n;
export const HUNDRED_PERCENT_SCALED = 100n * SCALE_FACTOR;

export function parseDecimal18_10(decimalStr: string): Result<bigint> {
  const trimmed = decimalStr.trim();
  if (!/^-?\d+(\.\d{1,10})?$/.test(trimmed)) {
    return err(
      createDomainError({
        code: 'VALIDATION_ERROR',
        moduleName: 'RoyaltyDecimalMath',
        message: `Valor numérico "${decimalStr}" no cumple con precisión DECIMAL(18, 10).`,
      }),
    );
  }

  const isNegative = trimmed.startsWith('-');
  const unsigned = isNegative ? trimmed.slice(1) : trimmed;
  const [integerPart = '0', fractionPart = ''] = unsigned.split('.');
  const paddedFraction = fractionPart.padEnd(DECIMAL_SCALE, '0');

  const scaledValue = BigInt(integerPart) * SCALE_FACTOR + BigInt(paddedFraction);
  return ok(isNegative ? -scaledValue : scaledValue);
}

export function formatDecimal18_10(scaledValue: bigint): string {
  const isNegative = scaledValue < 0n;
  const absValue = isNegative ? -scaledValue : scaledValue;
  const integerPart = absValue / SCALE_FACTOR;
  const fractionPart = (absValue % SCALE_FACTOR).toString().padStart(DECIMAL_SCALE, '0');
  return `${isNegative ? '-' : ''}${integerPart.toString()}.${fractionPart}`;
}

export interface RoyaltySplitShare {
  readonly participantIdentifier: string;
  readonly percentageStr: string;
}

/**
 * Validates that a set of track/release royalty splits sums to exactly 100.0000000000%.
 */
export function validateRoyaltySplitsTotal(
  shares: readonly RoyaltySplitShare[],
): Result<readonly { participantIdentifier: string; scaledPercentage: bigint }[]> {
  if (shares.length === 0) {
    return err(
      createDomainError({
        code: 'VALIDATION_ERROR',
        moduleName: 'RoyaltyDecimalMath',
        message: 'Se requiere al menos un participante en la división de regalías (splits).',
      }),
    );
  }

  let runningTotal = 0n;
  const parsedShares: { participantIdentifier: string; scaledPercentage: bigint }[] = [];

  for (const share of shares) {
    const parsed = parseDecimal18_10(share.percentageStr);
    if (!parsed.ok) {
      return parsed;
    }
    if (parsed.value <= 0n) {
      return err(
        createDomainError({
          code: 'VALIDATION_ERROR',
          moduleName: 'RoyaltyDecimalMath',
          message: `El porcentaje para "${share.participantIdentifier}" debe ser estrictamente mayor a 0%.`,
        }),
      );
    }
    runningTotal += parsed.value;
    parsedShares.push({
      participantIdentifier: share.participantIdentifier,
      scaledPercentage: parsed.value,
    });
  }

  if (runningTotal !== HUNDRED_PERCENT_SCALED) {
    return err(
      createDomainError({
        code: 'VALIDATION_ERROR',
        moduleName: 'RoyaltyDecimalMath',
        message: `La suma de splits debe ser exactamente 100.0000000000%, pero suma ${formatDecimal18_10(runningTotal)}%.`,
      }),
    );
  }

  return ok(parsedShares);
}

/**
 * Computes net distributor commission and net artist payout in DECIMAL(18, 10).
 */
export function computeRoyaltyNetDistribution(params: {
  grossRevenueStr: string;
  waveCommissionPercentStr: string;
}): Result<{
  grossScaled: bigint;
  commissionScaled: bigint;
  netDistributableScaled: bigint;
  grossFormatted: string;
  commissionFormatted: string;
  netDistributableFormatted: string;
}> {
  const grossRes = parseDecimal18_10(params.grossRevenueStr);
  if (!grossRes.ok) return grossRes;

  const commPercentRes = parseDecimal18_10(params.waveCommissionPercentStr);
  if (!commPercentRes.ok) return commPercentRes;

  const grossScaled = grossRes.value;
  const commissionScaled = (grossScaled * commPercentRes.value) / HUNDRED_PERCENT_SCALED;
  const netDistributableScaled = grossScaled - commissionScaled;

  return ok({
    grossScaled,
    commissionScaled,
    netDistributableScaled,
    grossFormatted: formatDecimal18_10(grossScaled),
    commissionFormatted: formatDecimal18_10(commissionScaled),
    netDistributableFormatted: formatDecimal18_10(netDistributableScaled),
  });
}
