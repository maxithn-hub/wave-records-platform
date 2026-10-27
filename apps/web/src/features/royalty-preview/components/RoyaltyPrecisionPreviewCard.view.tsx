'use client';

import React from 'react';
import { useRoyaltySimulator } from '../hooks/useRoyaltySimulator.hook';

export function RoyaltyPrecisionPreviewCardView(): React.JSX.Element {
  const {
    grossRevenueInput,
    setGrossRevenueInput,
    commissionPercentInput,
    setCommissionPercentInput,
    isrcInput,
    setIsrcInput,
    calculationResult,
    isrcValidationResult,
  } = useRoyaltySimulator();

  return (
    <article className="wave-card">
      <div className="wave-card-header">
        <span className="wave-badge-ok">MOTOR DECIMAL(18, 10)</span>
        <span className="wave-code-tag">module: royalty-preview</span>
      </div>
      <h2 className="wave-card-title">Verificador de Micro-Regalías e ISRC</h2>
      <p className="wave-card-subtitle">
        Conectado en tiempo real al paquete compartido <code>@wave/domain-core</code>.
      </p>

      <div className="wave-form-grid">
        <label className="wave-label">
          Ingreso Bruto por Stream (USD)
          <input
            type="text"
            value={grossRevenueInput}
            onChange={(e) => setGrossRevenueInput(e.target.value)}
            className="wave-input"
          />
        </label>

        <label className="wave-label">
          Comisión Wave Records LLC (%)
          <input
            type="text"
            value={commissionPercentInput}
            onChange={(e) => setCommissionPercentInput(e.target.value)}
            className="wave-input"
          />
        </label>

        <label className="wave-label">
          Validación ISO 3901 ISRC
          <input
            type="text"
            value={isrcInput}
            onChange={(e) => setIsrcInput(e.target.value)}
            className="wave-input"
          />
        </label>
      </div>

      {calculationResult.ok ? (
        <div className="wave-ledger-box">
          <div>
            <span className="wave-ledger-label">Retención Wave Records:</span>
            <strong className="wave-ledger-value">
              ${calculationResult.value.commissionFormatted} USD
            </strong>
          </div>
          <div>
            <span className="wave-ledger-label">Neto Liquidable a Artista/Sello:</span>
            <strong className="wave-ledger-value-highlight">
              ${calculationResult.value.netDistributableFormatted} USD
            </strong>
          </div>
        </div>
      ) : (
        <div className="wave-inline-error">{calculationResult.error.message}</div>
      )}

      <div style={{ marginTop: '0.75rem' }}>
        {isrcValidationResult.ok ? (
          <span className="wave-pill-green">
            ISRC Normalizado Válido: {isrcValidationResult.value}
          </span>
        ) : (
          <span className="wave-inline-error">{isrcValidationResult.error.message}</span>
        )}
      </div>
    </article>
  );
}
