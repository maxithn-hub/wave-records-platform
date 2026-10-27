import { type Result, ok } from '@wave/contracts';
import {
  HUNDRED_PERCENT_SCALED,
  parseDecimal18_10,
  formatDecimal18_10,
} from './decimal-math.js';

export interface SplitAllocationInputItem {
  readonly splitId: string;
  readonly collaboratorEmail: string;
  readonly collaboratorTenantId: string | null;
  readonly sharePercentageStr: string;
  readonly isActiveTenantShare: boolean;
}

export interface ComputedSplitAllocation {
  readonly splitId: string;
  readonly collaboratorEmail: string;
  readonly collaboratorTenantId: string | null;
  readonly isActiveTenantShare: boolean;
  readonly allocatedScaled: bigint;
  readonly allocatedFormatted: string;
}

/**
 * Distributes `netDistributableScaled` across track split agreements with exact DECIMAL(18, 10)
 * precision. Any 1-ulp integer division dust is assigned to the first participant so that
 * the sum of all allocations equals `netDistributableScaled` with zero drift.
 */
export function computeTrackSplitAllocations(params: {
  netDistributableScaled: bigint;
  splits: readonly SplitAllocationInputItem[];
}): Result<readonly ComputedSplitAllocation[]> {
  if (params.splits.length === 0) {
    return ok([]);
  }

  const rawAllocations: {
    item: SplitAllocationInputItem;
    allocatedScaled: bigint;
  }[] = [];

  let allocatedSum = 0n;

  for (const item of params.splits) {
    const pctRes = parseDecimal18_10(item.sharePercentageStr);
    if (!pctRes.ok) return pctRes;

    const shareAmount =
      (params.netDistributableScaled * pctRes.value) / HUNDRED_PERCENT_SCALED;
    allocatedSum += shareAmount;
    rawAllocations.push({
      item,
      allocatedScaled: shareAmount,
    });
  }

  const dustRemainder = params.netDistributableScaled - allocatedSum;
  if (dustRemainder !== 0n && rawAllocations[0]) {
    rawAllocations[0].allocatedScaled += dustRemainder;
  }

  return ok(
    rawAllocations.map(({ item, allocatedScaled }) => ({
      splitId: item.splitId,
      collaboratorEmail: item.collaboratorEmail,
      collaboratorTenantId: item.collaboratorTenantId,
      isActiveTenantShare: item.isActiveTenantShare,
      allocatedScaled,
      allocatedFormatted: formatDecimal18_10(allocatedScaled),
    })),
  );
}
