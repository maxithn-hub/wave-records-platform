'use client';

import { useState, useMemo } from 'react';
import {
  computeRoyaltyNetDistribution,
  normalizeAndValidateIsrc,
} from '@wave/domain-core';

export function useRoyaltySimulator() {
  const [grossRevenueInput, setGrossRevenueInput] = useState<string>('0.0034819205');
  const [commissionPercentInput, setCommissionPercentInput] = useState<string>('15.0000000000');
  const [isrcInput, setIsrcInput] = useState<string>('US-RC1-26-00451');

  const calculationResult = useMemo(
    () =>
      computeRoyaltyNetDistribution({
        grossRevenueStr: grossRevenueInput,
        waveCommissionPercentStr: commissionPercentInput,
      }),
    [grossRevenueInput, commissionPercentInput],
  );

  const isrcValidationResult = useMemo(
    () => normalizeAndValidateIsrc(isrcInput),
    [isrcInput],
  );

  return {
    grossRevenueInput,
    setGrossRevenueInput,
    commissionPercentInput,
    setCommissionPercentInput,
    isrcInput,
    setIsrcInput,
    calculationResult,
    isrcValidationResult,
  };
}
