'use client';

import React from 'react';
import Link from 'next/link';

export function WaveOperationalStationsDeckView(): React.JSX.Element {
  return (
    <section className="wave-stations-container" aria-label="Estaciones Operativas de Wave Records LLC">
      <div className="wave-stations-header-box">
        <div>
          <span className="wave-badge-gold">SUITE OPERATIVA PROFESIONAL</span>
          <h2 className="wave-stations-title">Estaciones de Trabajo de Estudio</h2>
          <p className="wave-stations-subtitle">
            Acceso directo a los motores de ingestión de audio, liquidación financiera, moderación DDEX y cumplimiento legal.
          </p>
        </div>
      </div>

      <div className="wave-stations-grid">
        {/* Station 1: Catalog */}
        <article className="wave-station-card">
          <div className="wave-station-top">
            <span className="wave-station-num">01</span>
            <div className="wave-station-tags">
              <span className="wave-badge-ok">PCM 24-BIT</span>
              <span className="wave-badge-info">DDEX METADATA</span>
            </div>
          </div>
          <h3 className="wave-station-name">Catálogo & Ingesta Multipart .WAV</h3>
          <p className="wave-station-desc">
            Subida fragmentada en bloques de 5MB con hash SHA-256 en cuarentena, validación de cabeceras RIFF estéreo de 44.1 kHz o 48 kHz y portadas de alta resolución 3000x3000px RGB.
          </p>
          <div className="wave-station-specs">
            <span>• Códigos ISRC/UPC automáticos</span>
            <span>• Máquina de estados FSM inmutable</span>
          </div>
          <div className="wave-station-footer">
            <Link href="/panel/catalogo" className="wave-btn-gold" style={{ width: '100%', textAlign: 'center' }}>
              Abrir Catálogo de Lanzamientos →
            </Link>
          </div>
        </article>

        {/* Station 2: Royalties & Escrow */}
        <article className="wave-station-card">
          <div className="wave-station-top">
            <span className="wave-station-num">02</span>
            <div className="wave-station-tags">
              <span className="wave-badge-gold">DECIMAL(18,10)</span>
              <span className="wave-badge-ok">ESCROW SEGURO</span>
            </div>
          </div>
          <h3 className="wave-station-name">Motor Financiero & Splits en Escrow</h3>
          <p className="wave-station-desc">
            Cálculo matemático exacto de porcentajes al 100.0000000000%. Retención segura en Escrow para colaboradores invitados sin cuenta hasta que reclamen vía correo electrónico.
          </p>
          <div className="wave-station-specs">
            <span>• Desglose por 12 plataformas DSP</span>
            <span>• Retiros idempotentes ACH / SWIFT</span>
          </div>
          <div className="wave-station-footer">
            <Link href="/panel/finanzas" className="wave-btn-gold" style={{ width: '100%', textAlign: 'center' }}>
              Abrir Billetera & Regalías →
            </Link>
          </div>
        </article>

        {/* Station 3: Backoffice Moderation & Revelator */}
        <article className="wave-station-card">
          <div className="wave-station-top">
            <span className="wave-station-num">03</span>
            <div className="wave-station-tags">
              <span className="wave-badge-warn">ACRCLOUD 3 TIERS</span>
              <span className="wave-badge-info">REVELATOR V2</span>
            </div>
          </div>
          <h3 className="wave-station-name">Moderación Forense & Despacho Revelator</h3>
          <p className="wave-station-desc">
            Detección acústica de coincidencias de audio con ACRCloud, descifrado AES-256-GCM de contratos BeatStars, exclusión automática de UGC y despacho headless con Circuit Breaker.
          </p>
          <div className="wave-station-specs">
            <span>• Token unprompted en caché (8h)</span>
            <span>• Prevención IDOR Multi-Tenant</span>
          </div>
          <div className="wave-station-footer">
            <Link href="/admin/moderacion" className="wave-btn-gold" style={{ width: '100%', textAlign: 'center' }}>
              Abrir Mesa de Moderación →
            </Link>
          </div>
        </article>

        {/* Station 4: Compliance & KYC */}
        <article className="wave-station-card">
          <div className="wave-station-top">
            <span className="wave-station-num">04</span>
            <div className="wave-station-tags">
              <span className="wave-badge-ok">IRS W-9 / W-8BEN</span>
              <span className="wave-badge-gold">KYC AUDITADO</span>
            </div>
          </div>
          <h3 className="wave-station-name">Portal de Cumplimiento Fiscal & KYC</h3>
          <p className="wave-station-desc">
            Verificación de identidad oficial y asistente tributario del IRS para retención justa de impuestos con tratados de doble tributación antes de habilitar retiros monetarios.
          </p>
          <div className="wave-station-specs">
            <span>• Cifrado AES-256-GCM en disco</span>
            <span>• Cola de aprobación administrativa</span>
          </div>
          <div className="wave-station-footer">
            <Link href="/panel/cumplimiento" className="wave-btn-gold" style={{ width: '100%', textAlign: 'center' }}>
              Ver Expediente Fiscal →
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
