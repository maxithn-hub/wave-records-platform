'use client';

import { useState } from 'react';

export function useFaultTrigger() {
  const [isFaultActive, setIsFaultActive] = useState<boolean>(false);

  return {
    isFaultActive,
    triggerControlledModuleCrash: () => setIsFaultActive(true),
    resetFault: () => setIsFaultActive(false),
  };
}
