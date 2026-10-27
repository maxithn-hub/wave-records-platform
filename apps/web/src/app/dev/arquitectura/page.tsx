'use client';

import React from 'react';
import { IsolatedModuleBoundary } from '../../../shared/error-isolation/IsolatedModuleBoundary.view';
import { usePlatformCapabilities } from '../../../shared/platform/usePlatformCapabilities.hook';
import { ArchitectureHealthCardView } from '../../../features/system-status/components/ArchitectureHealthCard.view';
import { PlatformCapabilityInspectorCardView } from '../../../features/system-status/components/PlatformCapabilityInspectorCard.view';
import { RoyaltyPrecisionPreviewCardView } from '../../../features/royalty-preview/components/RoyaltyPrecisionPreviewCard.view';
import { FaultSimulatorWidgetView } from '../../../features/fault-isolation-demo/components/FaultSimulatorWidget.view';

export default function DevArchitecturePage(): React.JSX.Element {
  const { target, capabilities, setSimulatedTarget } = usePlatformCapabilities('WEB_DESKTOP');

  return (
    <div className="wave-grid">
      <IsolatedModuleBoundary
        moduleId="mod-arch-health"
        moduleTitle="Estado de Cimientos Arquitectónicos"
      >
        <ArchitectureHealthCardView />
      </IsolatedModuleBoundary>

      <IsolatedModuleBoundary
        moduleId="mod-platform-capabilities"
        moduleTitle="Adaptador de Capacidades Web / Android"
      >
        <PlatformCapabilityInspectorCardView
          currentTarget={target}
          capabilities={capabilities}
          onChangeTarget={setSimulatedTarget}
        />
      </IsolatedModuleBoundary>

      <IsolatedModuleBoundary
        moduleId="mod-royalty-ledger-math"
        moduleTitle="Motor Financiero DECIMAL(18, 10) & Validador ISRC"
      >
        <RoyaltyPrecisionPreviewCardView />
      </IsolatedModuleBoundary>

      <IsolatedModuleBoundary
        moduleId="mod-chaos-fault-simulator"
        moduleTitle="Simulador de Fallo Crítico Aislado"
      >
        <FaultSimulatorWidgetView />
      </IsolatedModuleBoundary>
    </div>
  );
}
