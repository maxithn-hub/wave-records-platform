'use client';

import React, { useState } from 'react';
import { WaveHexLogoView } from '../../../shared/brand/WaveHexLogo.view';

export function InteractiveStudioPreviewCardView(): React.JSX.Element {
  const [selectedScenario, setSelectedScenario] = useState<'clean' | 'grey' | 'reject'>('clean');
  const [selectedTier, setSelectedTier] = useState<'launch' | 'growth'>('launch');

  return (
    <article className="wave-card">
      <div className="wave-card-header">
        <span className="wave-badge-gold">STUDIO DEMO INTERACTIVO</span>
        <span className="wave-code-tag">ACRCloud & Revelator Engine</span>
      </div>

      <h2 className="wave-card-title">Consola de Previsualización & Diagnóstico en Tiempo Real</h2>
      <p className="wave-card-subtitle">
        Demostración interactiva de las reglas de negocio de Wave Records LLC: detección de huella acústica y modelos de cuenta Multi-Tenant.
      </p>

      {/* Selector de Escenarios Forenses */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label className="wave-label" style={{ marginBottom: '0.6rem' }}>
          Simulador de Ingesta & Huella Acústica ACRCloud (Prueba las 3 Reglas de Negocio):
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
          <button
            type="button"
            onClick={() => setSelectedScenario('clean')}
            className={selectedScenario === 'clean' ? 'wave-btn-active' : 'wave-btn-secondary'}
            style={{ fontSize: '0.78rem', padding: '0.6rem' }}
          >
            1. Clean Pass (12% &lt; 45%)
          </button>
          <button
            type="button"
            onClick={() => setSelectedScenario('grey')}
            className={selectedScenario === 'grey' ? 'wave-btn-active' : 'wave-btn-secondary'}
            style={{ fontSize: '0.78rem', padding: '0.6rem' }}
          >
            2. Zona Gris (64% Type Beat)
          </button>
          <button
            type="button"
            onClick={() => setSelectedScenario('reject')}
            className={selectedScenario === 'reject' ? 'wave-btn-active' : 'wave-btn-secondary'}
            style={{ fontSize: '0.78rem', padding: '0.6rem' }}
          >
            3. Rechazo Duro (91% &ge; 80%)
          </button>
        </div>
      </div>

      {/* Display del Escenario */}
      <div
        style={{
          background: '#07070a',
          border: '1px solid var(--wave-border-medium)',
          borderRadius: '12px',
          padding: '1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <WaveHexLogoView size={28} showGlow={false} />
            <strong style={{ fontSize: '0.9rem', color: '#fff' }}>
              {selectedScenario === 'clean' && 'Track: "Sol Dorado (Original Mix)"'}
              {selectedScenario === 'grey' && 'Track: "Noche de Humo (feat. Ghost Producer)"'}
              {selectedScenario === 'reject' && 'Track: "Unauthorized Beat Copy (Infracción)"'}
            </strong>
          </div>
          <div>
            {selectedScenario === 'clean' && <span className="wave-badge-ok">VEREDICTO: CLEAN_PASS (12%)</span>}
            {selectedScenario === 'grey' && <span className="wave-badge-warn">VEREDICTO: GREY_AREA (64%)</span>}
            {selectedScenario === 'reject' && <span className="wave-badge-danger">VEREDICTO: HARD_REJECT (91%)</span>}
          </div>
        </div>

        {/* Dynamic Simulated Waveform Bars */}
        <div
          style={{
            height: '42px',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            background: 'rgba(245, 196, 62, 0.03)',
            borderRadius: '6px',
            padding: '0 0.5rem',
            marginBottom: '0.85rem',
            border: '1px solid rgba(245, 196, 62, 0.1)',
          }}
        >
          {Array.from({ length: 48 }).map((_, i) => {
            const heightPct =
              selectedScenario === 'clean'
                ? Math.abs(Math.sin(i * 0.35)) * 80 + 15
                : selectedScenario === 'grey'
                ? Math.abs(Math.cos(i * 0.45)) * 90 + 10
                : 95;
            const barColor =
              selectedScenario === 'clean'
                ? '#10b981'
                : selectedScenario === 'grey'
                ? '#f5c43e'
                : '#ef4444';
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${heightPct}%`,
                  backgroundColor: barColor,
                  borderRadius: '2px',
                  opacity: 0.85,
                  transition: 'height 0.3s ease, background-color 0.3s ease',
                }}
              />
            );
          })}
        </div>

        <p style={{ fontSize: '0.82rem', color: 'var(--wave-text-champagne)', lineHeight: 1.45 }}>
          {selectedScenario === 'clean' &&
            '✓ Audio 100% original. Sin coincidencias no autorizadas en ACRCloud. Despacho habilitado a todas las tiendas DSP y a redes sociales con monetización de YouTube Content ID activa.'}
          {selectedScenario === 'grey' &&
            '⚠ Beat no-exclusivo (BeatStars/Type Beat). La plataforma activa blockUgcMonetization = true para proteger al sello de reclamos en YouTube y exige la licencia en PDF descifrada con AES-256-GCM antes del despacho.'}
          {selectedScenario === 'reject' &&
            '✕ Infracción de derechos de autor detectada (≥ 80%). El lanzamiento se bloquea automáticamente en estado REJECTED para proteger la cuenta agregadora de Wave Records LLC.'}
        </p>
      </div>

      {/* Planes Multi-Tenant */}
      <div>
        <label className="wave-label" style={{ marginBottom: '0.6rem' }}>
          Jerarquía de Cuentas B2B / B2C (Mapeo a Cuentas Hijas en Revelator):
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
          <div
            onClick={() => setSelectedTier('launch')}
            style={{
              cursor: 'pointer',
              padding: '1rem',
              borderRadius: '10px',
              border: selectedTier === 'launch' ? '1px solid var(--wave-gold-primary)' : '1px solid var(--wave-border-subtle)',
              background: selectedTier === 'launch' ? 'rgba(245, 196, 62, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.9rem', color: '#fff' }}>Wave Launch (B2C)</strong>
              <span className="wave-pill-gold">Artistas & Productores</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--wave-text-champagne)', marginTop: '0.4rem' }}>
              Para solistas y creadores. Revelator Child Account "Launch", retención de 15% de comisión, pagos por transferencia y splits automáticos.
            </p>
          </div>

          <div
            onClick={() => setSelectedTier('growth')}
            style={{
              cursor: 'pointer',
              padding: '1rem',
              borderRadius: '10px',
              border: selectedTier === 'growth' ? '1px solid var(--wave-gold-primary)' : '1px solid var(--wave-border-subtle)',
              background: selectedTier === 'growth' ? 'rgba(245, 196, 62, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.9rem', color: '#fff' }}>Wave Growth (B2B)</strong>
              <span className="wave-pill-green">Sellos Discográficos</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--wave-text-champagne)', marginTop: '0.4rem' }}>
              Para sellos con catálogo multiequipo. Revelator Child Account "Growth", soporte DDEX masivo, W-8BEN-E para entidades internacionales y comisiones negociadas.
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
