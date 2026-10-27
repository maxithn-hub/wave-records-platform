'use client';

import { useState, useMemo } from 'react';
import {
  resolvePlatformCapabilities,
  type RuntimeTarget,
  type PlatformCapabilities,
} from '@wave/domain-core';

export interface UsePlatformCapabilitiesReturn {
  readonly target: RuntimeTarget;
  readonly capabilities: PlatformCapabilities;
  readonly setSimulatedTarget: (nextTarget: RuntimeTarget) => void;
}

/**
 * Provides runtime platform capability flags so the Web UI can preview
 * how it behaves as a Full Desktop Web App vs. a Capacitor Android App.
 */
export function usePlatformCapabilities(
  initialTarget: RuntimeTarget = 'WEB_DESKTOP',
): UsePlatformCapabilitiesReturn {
  const [target, setTarget] = useState<RuntimeTarget>(initialTarget);

  const capabilities = useMemo(
    () => resolvePlatformCapabilities(target),
    [target],
  );

  return {
    target,
    capabilities,
    setSimulatedTarget: setTarget,
  };
}
