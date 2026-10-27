'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getBrandAssetUrl } from '../../../shared/brand/brand-assets.util';

export function WaveHeroShowcaseView(): React.JSX.Element {
  return (
    <section className="wave-hero-studio-container" aria-label="Presentación Institucional de Wave Records LLC">
      {/* Background ambient lighting */}
      <div className="wave-hero-ambient-glow" />

      <div className="wave-hero-split-grid">
        {/* Left Column: Commercial Proposition & CTAs */}
        <div className="wave-hero-left-col">
          <div className="wave-hero-tag-strip">
            <span className="wave-badge-gold">WHITE-LABEL MUSIC AGGREGATOR</span>
            <span className="wave-badge-ok">REVELATOR V1/V2 HEADLESS</span>
            <span className="wave-badge-info">ACRCLOUD FORENSICS</span>
          </div>

          <h1 className="wave-hero-headline">
            Distribución Musical Global,{' '}
            <span className="wave-gold-gradient-text">
              Blindaje Forense
            </span>{' '}
            y Liquidación Exacta de Regalías
          </h1>

          <p className="wave-hero-lead-text">
            Infraestructura de alta fidelidad para artistas y sellos discográficos independientes:
            subida fragmentada de masters <strong style={{ color: '#fff' }}>.WAV 24-bit / 48kHz</strong> sin compresión,
            detección acústica con ACRCloud, división de splits en <strong style={{ color: '#f5c43e' }}>Escrow</strong> y
            libro mayor financiero inmutable a <strong style={{ color: '#f5c43e' }}>10 decimales</strong>.
          </p>

          <div className="wave-hero-cta-deck">
            <Link href="/panel/catalogo" className="wave-btn-gold wave-hero-btn">
              Subir Música & Catálogo →
            </Link>
            <Link href="/panel/finanzas" className="wave-btn-secondary wave-hero-btn">
              Billetera & Splits en Escrow
            </Link>
            <Link href="/admin/moderacion" className="wave-btn-secondary wave-hero-btn">
              Mesa de Moderación
            </Link>
          </div>

          {/* DSP Streaming Partner Badges */}
          <div className="wave-hero-dsp-ticker">
            <span className="wave-hero-dsp-label">
              Conectado a más de 150 Tiendas & Plataformas DSP en todo el mundo:
            </span>
            <div className="wave-hero-dsp-pills">
              <span className="wave-dsp-pill">SPOTIFY</span>
              <span className="wave-dsp-pill">APPLE MUSIC</span>
              <span className="wave-dsp-pill">TIKTOK / BYTEDANCE</span>
              <span className="wave-dsp-pill">YOUTUBE CONTENT ID</span>
              <span className="wave-dsp-pill">AMAZON MUSIC</span>
              <span className="wave-dsp-pill">TIDAL HI-FI</span>
              <span className="wave-dsp-pill">DEEZER</span>
              <span className="wave-dsp-pill">META RIGHTS MANAGER</span>
            </div>
          </div>
        </div>

        {/* Right Column: Studio Spotlight Enclosure (Official HD Emblem) */}
        <div className="wave-hero-right-col">
          <div className="wave-spotlight-enclosure">
            <div className="wave-spotlight-backdrop" />
            
            <div className="wave-spotlight-emblem-frame">
              <Image
                src={getBrandAssetUrl('/brand/wave-records-emblem-hd.png')}
                alt="Wave Records LLC Official Emblem"
                width={260}
                height={260}
                priority
                className="wave-spotlight-emblem-img"
              />
              <div className="wave-spotlight-lens-flare" />
            </div>

            <div className="wave-spotlight-meta">
              <div className="wave-spotlight-brand-name">WAVE RECORDS LLC</div>
              <div className="wave-spotlight-brand-sub">SONIC HARMONIC HEXAGON • OFFICIAL LOGO</div>
            </div>

            {/* Audio Waveform Equalizer Spectrum Analyzer */}
            <div className="wave-spotlight-eq-strip" title="Monitor de Audio Reactivo de Estudio">
              {Array.from({ length: 28 }).map((_, i) => (
                <span
                  key={i}
                  className="wave-spotlight-eq-bar"
                  style={{
                    animationDelay: `${(i % 7) * 0.08}s`,
                    animationDuration: `${0.7 + (i % 5) * 0.12}s`,
                  }}
                />
              ))}
            </div>

            <div className="wave-spotlight-footer-badge">
              <span className="wave-spotlight-dot" />
              <span>CANAL DE ESTUDIO ACTIVO • 24-BIT / 48kHz PCM LOSSLESS</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
