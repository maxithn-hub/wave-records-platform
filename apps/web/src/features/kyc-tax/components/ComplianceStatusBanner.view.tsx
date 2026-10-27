'use client';

import React from 'react';
import type { ComplianceStatusDto } from '@wave/contracts';

export function ComplianceStatusBannerView({
  status,
}: {
  readonly status: ComplianceStatusDto;
}): React.JSX.Element {
  return (
    <article className="wave-card">
      <div className="wave-card-header">
        <span className={status.payoutEligible ? 'wave-badge-ok' : 'wave-badge-warn'}>
          {status.payoutEligible
            ? 'HABILITADO PARA RETIROS DE REGALÍAS'
            : 'RETIROS BLOQUEADOS POR CUMPLIMIENTO'}
        </span>
        <span className="wave-code-tag">module: compliance-banner</span>
      </div>

      <h2 className="wave-card-title">
        Estado del Tenant: {status.tenantStatus} • Formulario IRS Requerido: {status.requiredTaxForm}
      </h2>

      <div className="wave-status-list" style={{ marginTop: '0.75rem' }}>
        <div className="wave-status-item">
          <div className="wave-status-row">
            <strong>1. Verificación de Identidad (KYC):</strong>
            <span
              className={
                status.kyc.status === 'VERIFIED' ? 'wave-pill-green' : 'wave-pill-muted'
              }
            >
              {status.kyc.status}
            </span>
          </div>
          {status.kyc.rejectionReason && (
            <p className="wave-inline-error">
              Motivo de rechazo KYC: {status.kyc.rejectionReason}
            </p>
          )}
        </div>

        <div className="wave-status-item">
          <div className="wave-status-row">
            <strong>2. Declaración Fiscal IRS ({status.requiredTaxForm}):</strong>
            <span
              className={
                status.tax.status === 'VALIDATED' ? 'wave-pill-green' : 'wave-pill-muted'
              }
            >
              {status.tax.status}{' '}
              {status.tax.maskedTaxId ? `(${status.tax.maskedTaxId})` : ''}
            </span>
          </div>
          {status.tax.rejectionReason && (
            <p className="wave-inline-error">
              Motivo de rechazo Fiscal: {status.tax.rejectionReason}
            </p>
          )}
        </div>
      </div>

      {status.payoutBlockers.length > 0 && (
        <div className="wave-ledger-box" style={{ marginTop: '1rem' }}>
          <strong className="wave-ledger-label">Requisitos pendientes para liberar pagos:</strong>
          {status.payoutBlockers.map((b) => (
            <div key={b} className="wave-status-detail">
              • {b}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
