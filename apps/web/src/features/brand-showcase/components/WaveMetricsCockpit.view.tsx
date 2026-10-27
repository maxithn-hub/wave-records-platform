'use client';

import React from 'react';
import Link from 'next/link';
import { useShowcaseMode } from '../../../shared/showcase/ShowcaseModeProvider.view';

export function WaveMetricsCockpitView(): React.JSX.Element {
  const { isShowcaseMode } = useShowcaseMode();

  return (
    <section className="wave-metrics-deck" aria-label="Métricas Principales de Wave Records LLC">
      {/* Metric 1: Royalties */}
      <div className="wave-metric-card">
        <div className="wave-metric-header">
          <span className="wave-metric-icon">🪙</span>
          <span className="wave-metric-badge-ok">+18.4% ESTE MES</span>
        </div>
        <div className="wave-metric-body">
          <h3 className="wave-metric-value">$14,850.45 <span className="wave-metric-unit">USD</span></h3>
          <p className="wave-metric-title">Balance Neto Distribuible</p>
          <p className="wave-metric-subtext">
            {isShowcaseMode
              ? '$3,240.00 en Escrow para colaboradores invitados'
              : 'Fondos auditados en libro mayor inmutable'}
          </p>
        </div>
        <div className="wave-metric-footer">
          <Link href="/panel/finanzas" className="wave-metric-link">
            Abrir Billetera →
          </Link>
        </div>
      </div>

      {/* Metric 2: Streams */}
      <div className="wave-metric-card">
        <div className="wave-metric-header">
          <span className="wave-metric-icon">🎧</span>
          <span className="wave-metric-badge-gold">12 DSPS AUDITADOS</span>
        </div>
        <div className="wave-metric-body">
          <h3 className="wave-metric-value">8,177,700</h3>
          <p className="wave-metric-title">Streams Globales Acumulados</p>
          <p className="wave-metric-subtext">
            Spotify (1.8M) • Apple (980k) • TikTok (4.1M)
          </p>
        </div>
        <div className="wave-metric-footer">
          <Link href="/panel/finanzas" className="wave-metric-link">
            Analítica de Tiendas →
          </Link>
        </div>
      </div>

      {/* Metric 3: Catalog Releases */}
      <div className="wave-metric-card">
        <div className="wave-metric-header">
          <span className="wave-metric-icon">💿</span>
          <span className="wave-metric-badge-info">WAV 24-BIT / 48kHz</span>
        </div>
        <div className="wave-metric-body">
          <h3 className="wave-metric-value">18 <span className="wave-metric-unit">Masters</span></h3>
          <p className="wave-metric-title">Catálogo Activo en Tiendas</p>
          <p className="wave-metric-subtext">
            Metadatos DDEX, códigos ISRC/UPC y portadas 3000x3000
          </p>
        </div>
        <div className="wave-metric-footer">
          <Link href="/panel/catalogo" className="wave-metric-link">
            Gestionar Catálogo →
          </Link>
        </div>
      </div>

      {/* Metric 4: Compliance Status */}
      <div className="wave-metric-card">
        <div className="wave-metric-header">
          <span className="wave-metric-icon">🛡️</span>
          <span className="wave-metric-badge-ok">VERIFICADO</span>
        </div>
        <div className="wave-metric-body">
          <h3 className="wave-metric-value">100% <span className="wave-metric-unit">Cumplimiento</span></h3>
          <p className="wave-metric-title">Blindaje KYC & Fiscal IRS</p>
          <p className="wave-metric-subtext">
            Formulario W-8BEN validado (0% tratado de retención)
          </p>
        </div>
        <div className="wave-metric-footer">
          <Link href="/panel/cumplimiento" className="wave-metric-link">
            Expediente Fiscal →
          </Link>
        </div>
      </div>
    </section>
  );
}
