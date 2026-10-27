'use client';

import React from 'react';

export function ArchitectureHealthCardView(): React.JSX.Element {
  const layers = [
    {
      name: 'Jerarquía Multi-Tenant (Revelator V1/V2)',
      status: 'BLINDADO EN SERVIDOR',
      detail: 'Mapeo Tenant UUID -> RevelatorChildAccountId aislado contra IDOR.',
    },
    {
      name: 'Cifrado Fiscal IRS (W-9 / W-8BEN)',
      status: 'AES-256-GCM ACTIVO',
      detail: 'SSN, EIN y FTIN cifrados con IV de 96 bits y verificación de AuthTag.',
    },
    {
      name: 'Workers Forenses (FFmpeg / Sharp / ACRCloud)',
      status: 'SANDBOX SEPARADO',
      detail: 'Colas BullMQ con Dead-Letter Queue para evitar bloqueos en API HTTP.',
    },
    {
      name: 'Motor Financiero (Royalty Ledger)',
      status: 'DECIMAL(18, 10)',
      detail: 'Aritmética exacta BigInt de punto fijo sin deriva IEEE-754.',
    },
  ];

  return (
    <article className="wave-card">
      <div className="wave-card-header">
        <span className="wave-badge-ok">FASE 0 OPERATIVA</span>
        <span className="wave-code-tag">module: system-status</span>
      </div>
      <h2 className="wave-card-title">Estado de Cimientos Arquitectónicos</h2>
      <p className="wave-card-subtitle">
        Cada subsistema opera en archivos desacoplados con validación de contratos Zod.
      </p>
      <ul className="wave-status-list">
        {layers.map((layer) => (
          <li key={layer.name} className="wave-status-item">
            <div className="wave-status-row">
              <strong>{layer.name}</strong>
              <span className="wave-pill-green">{layer.status}</span>
            </div>
            <p className="wave-status-detail">{layer.detail}</p>
          </li>
        ))}
      </ul>
    </article>
  );
}
