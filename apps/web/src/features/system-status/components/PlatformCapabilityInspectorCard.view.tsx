'use client';

import React from 'react';
import type { PlatformCapabilities, RuntimeTarget } from '@wave/domain-core';

export interface PlatformCapabilityInspectorProps {
  readonly currentTarget: RuntimeTarget;
  readonly capabilities: PlatformCapabilities;
  readonly onChangeTarget: (target: RuntimeTarget) => void;
}

export function PlatformCapabilityInspectorCardView({
  currentTarget,
  capabilities,
  onChangeTarget,
}: PlatformCapabilityInspectorProps): React.JSX.Element {
  const flags = [
    {
      label: 'Subida Multipart de Audio WAV Lossless (PCM 16/24-bit)',
      enabled: capabilities.canUploadLosslessWav,
    },
    {
      label: 'Subida de Portada 3000x3000px RGB',
      enabled: capabilities.canUploadHighResArtwork,
    },
    {
      label: 'Aceptación de Splits de Regalías & Contratos',
      enabled: capabilities.canApproveSplits,
    },
    {
      label: 'Dashboard de Analíticas DSP & Billetera de Retiros',
      enabled: capabilities.canRequestRoyaltyPayout,
    },
    {
      label: 'Backoffice de Moderación Forense (Admin)',
      enabled: capabilities.canAccessAdminBackoffice,
    },
  ];

  return (
    <article className="wave-card">
      <div className="wave-card-header">
        <span className="wave-badge-info">CAPACITOR-READY</span>
        <span className="wave-code-tag">module: platform-adapter</span>
      </div>
      <h2 className="wave-card-title">Adaptador Web → Futura App Android</h2>
      <p className="wave-card-subtitle">
        Cambia el perfil de ejecución para comprobar cómo la misma estructura se adapta sin
        reescribir código cuando se empaquete para Android:
      </p>

      <div className="wave-btn-group">
        <button
          type="button"
          onClick={() => onChangeTarget('WEB_DESKTOP')}
          className={currentTarget === 'WEB_DESKTOP' ? 'wave-btn-active' : 'wave-btn-secondary'}
        >
          Web Desktop (Completo)
        </button>
        <button
          type="button"
          onClick={() => onChangeTarget('CAPACITOR_ANDROID')}
          className={
            currentTarget === 'CAPACITOR_ANDROID' ? 'wave-btn-active' : 'wave-btn-secondary'
          }
        >
          Capacitor Android (Ligero)
        </button>
      </div>

      <ul className="wave-status-list">
        {flags.map((flag) => (
          <li key={flag.label} className="wave-status-item">
            <div className="wave-status-row">
              <span>{flag.label}</span>
              <span className={flag.enabled ? 'wave-pill-green' : 'wave-pill-muted'}>
                {flag.enabled ? 'HABILITADO' : 'OCULTO EN MÓVIL'}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
