'use client';

import React, { useState } from 'react';
import { IsolatedModuleBoundary } from '../shared/error-isolation/IsolatedModuleBoundary.view';
import { WaveHeroShowcaseView } from '../features/brand-showcase/components/WaveHeroShowcase.view';
import { WaveMetricsCockpitView } from '../features/brand-showcase/components/WaveMetricsCockpit.view';
import { WaveOperationalStationsDeckView } from '../features/brand-showcase/components/WaveOperationalStationsDeck.view';
import { InteractiveStudioPreviewCardView } from '../features/brand-showcase/components/InteractiveStudioPreviewCard.view';
import { ArchitectureHealthCardView } from '../features/system-status/components/ArchitectureHealthCard.view';
import { RoyaltyPrecisionPreviewCardView } from '../features/royalty-preview/components/RoyaltyPrecisionPreviewCard.view';
import { FaultSimulatorWidgetView } from '../features/fault-isolation-demo/components/FaultSimulatorWidget.view';

export default function WaveHomePage(): React.JSX.Element {
  const [showTechDiagnostics, setShowTechDiagnostics] = useState<boolean>(false);

  return (
    <div className="wave-home-layout">
      {/* 1. Cinematic 2-Column Client Hero Showcase */}
      <IsolatedModuleBoundary
        moduleId="mod-hero-brand-showcase"
        moduleTitle="Presentación de Marca & Alianzas DSP Globales"
      >
        <WaveHeroShowcaseView />
      </IsolatedModuleBoundary>

      {/* 2. Executive 4-Card Metrics Cockpit */}
      <IsolatedModuleBoundary
        moduleId="mod-metrics-cockpit"
        moduleTitle="Cockpit de Métricas Clave de Estudio"
      >
        <WaveMetricsCockpitView />
      </IsolatedModuleBoundary>

      {/* 3. 4-Pillar Workstations Deck */}
      <IsolatedModuleBoundary
        moduleId="mod-operational-stations"
        moduleTitle="Estaciones Operativas de Wave Records LLC"
      >
        <WaveOperationalStationsDeckView />
      </IsolatedModuleBoundary>

      {/* 4. Interactive Studio Ingest & ACRCloud Console */}
      <div style={{ marginTop: '2rem' }}>
        <IsolatedModuleBoundary
          moduleId="mod-studio-interactive-demo"
          moduleTitle="Consola de Previsualización & Diagnóstico en Vivo"
        >
          <InteractiveStudioPreviewCardView />
        </IsolatedModuleBoundary>
      </div>

      {/* 5. Technical Resilience & Architecture Diagnostics (Collapsible Deck) */}
      <section className="wave-tech-diagnostics-section" aria-label="Diagnóstico de Arquitectura">
        <div className="wave-tech-diagnostics-header">
          <div>
            <span className="wave-badge-info">AUDITORÍA DE ARQUITECTURA & TOLERANCIA A FALLOS</span>
            <h3 style={{ fontSize: '1.15rem', color: '#fff', marginTop: '0.35rem' }}>
              Centro de Diagnóstico Técnico & Resiliencia Monorepo
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--wave-text-champagne)' }}>
              Pruebas de aislamiento de procesos (*Bulkhead*), coma fija DECIMAL(18,10) y salud de microservicios.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowTechDiagnostics((prev) => !prev)}
            className="wave-btn-secondary"
            style={{ fontSize: '0.82rem', padding: '0.55rem 1.1rem' }}
          >
            {showTechDiagnostics ? '▲ Ocultar Diagnóstico Técnico' : '▼ Desplegar Diagnóstico Técnico'}
          </button>
        </div>

        {showTechDiagnostics && (
          <div className="wave-grid" style={{ marginTop: '1.5rem' }}>
            <IsolatedModuleBoundary
              moduleId="mod-arch-health"
              moduleTitle="Estado de Cimientos Arquitectónicos"
            >
              <ArchitectureHealthCardView />
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
        )}
      </section>
    </div>
  );
}
