'use client';

import React, { useState } from 'react';
import { useAdminComplianceQueue } from '../hooks/useAdminComplianceQueue.hook';

export function ComplianceQueueTableView(): React.JSX.Element {
  const { items, isLoading, errorMsg, submitDecision } = useAdminComplianceQueue();
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  return (
    <article className="wave-card">
      <div className="wave-card-header">
        <span className="wave-badge-warn">BACKOFFICE COMPLIANCE ADMIN</span>
        <span className="wave-code-tag">module: admin-compliance-queue</span>
      </div>
      <h2 className="wave-card-title">Cola de Revisión de Identidad (KYC) e Impuestos IRS</h2>
      <p className="wave-card-subtitle">
        Cuando tanto el KYC como el Formulario Fiscal de un Tenant son aprobados, su cuenta pasa
        automáticamente a estado <code>ACTIVE</code> y se habilitan los retiros.
      </p>

      {isLoading && <p className="wave-status-detail">Cargando expedientes pendientes...</p>}
      {errorMsg && <div className="wave-inline-error">{errorMsg}</div>}

      {!isLoading && items.length === 0 && !errorMsg && (
        <div className="wave-pill-green">
          No hay solicitudes de KYC o formularios fiscales pendientes de revisión.
        </div>
      )}

      <ul className="wave-status-list" style={{ marginTop: '1rem' }}>
        {items.map((item) => (
          <li key={`${item.kind}-${item.id}`} className="wave-status-item">
            <div className="wave-status-row">
              <strong>
                [{item.kind}] {item.tenantDisplayName} ({item.tenantTier} • {item.tenantCountryCode})
              </strong>
              <span className="wave-code-tag">
                {item.kind === 'KYC'
                  ? `Doc: ${item.documentType}`
                  : `Form: ${item.formType} (${item.maskedTaxId ?? 'PDF'})`}
              </span>
            </div>

            {item.signerName && (
              <p className="wave-status-detail">Firmante: {item.signerName}</p>
            )}

            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                marginTop: '0.75rem',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <button
                type="button"
                onClick={() =>
                  void submitDecision({
                    kind: item.kind,
                    id: item.id,
                    decision: 'APPROVE',
                  })
                }
                className="wave-btn-recover"
              >
                Aprobar {item.kind}
              </button>

              <input
                type="text"
                placeholder="Motivo de rechazo (mín. 5 caracteres)..."
                value={rejectionReasons[item.id] ?? ''}
                onChange={(e) =>
                  setRejectionReasons((prev) => ({
                    ...prev,
                    [item.id]: e.target.value,
                  }))
                }
                className="wave-input"
                style={{ flex: 1, minWidth: '220px' }}
              />

              <button
                type="button"
                onClick={() =>
                  void submitDecision({
                    kind: item.kind,
                    id: item.id,
                    decision: 'REJECT',
                    reason: rejectionReasons[item.id] ?? '',
                  })
                }
                className="wave-btn-danger"
              >
                Rechazar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
