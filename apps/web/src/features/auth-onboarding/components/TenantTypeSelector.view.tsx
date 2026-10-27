'use client';

import React from 'react';
import type { TenantTier } from '@wave/contracts';

export interface TenantTypeSelectorProps {
  readonly selectedTier: TenantTier;
  readonly onSelectTier: (tier: TenantTier) => void;
}

export function TenantTypeSelectorView({
  selectedTier,
  onSelectTier,
}: TenantTypeSelectorProps): React.JSX.Element {
  return (
    <div className="wave-btn-group" role="radiogroup" aria-label="Tipo de Cuenta">
      <button
        type="button"
        onClick={() => onSelectTier('INDIVIDUAL_LAUNCH')}
        className={
          selectedTier === 'INDIVIDUAL_LAUNCH' ? 'wave-btn-active' : 'wave-btn-secondary'
        }
      >
        Artista / Productor Individual (Launch)
      </button>
      <button
        type="button"
        onClick={() => onSelectTier('LABEL_GROWTH')}
        className={selectedTier === 'LABEL_GROWTH' ? 'wave-btn-active' : 'wave-btn-secondary'}
      >
        Sello Discográfico / Agregadora (Growth)
      </button>
    </div>
  );
}
