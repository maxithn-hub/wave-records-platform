'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { getBrandAssetUrl } from '../brand/brand-assets.util';

export function WaveSplashScreenView(): React.JSX.Element | null {
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);

  useEffect(() => {
    // Exact 1.5s (1500ms) splash screen duration requested by the user
    const timer = setTimeout(() => {
      setIsFadingOut(true);
      const exitTimer = setTimeout(() => {
        setIsVisible(false);
      }, 350); // 350ms smooth fade-out and scale transition
      return () => clearTimeout(exitTimer);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <aside
      aria-label="Cargando Wave Records LLC"
      className="wave-splash-overlay"
      style={{
        opacity: isFadingOut ? 0 : 1,
        transform: isFadingOut ? 'scale(1.03)' : 'scale(1)',
        pointerEvents: isFadingOut ? 'none' : 'auto',
      }}
    >
      <div className="wave-splash-radial-glow" />

      <div className="wave-splash-content">
        {/* Spotlight Gold Emblem */}
        <div className="wave-splash-emblem-wrapper">
          <Image
            src={getBrandAssetUrl('/brand/wave-records-emblem-hd.png')}
            alt="Wave Records LLC Logo"
            width={130}
            height={130}
            priority
            className="wave-splash-emblem-img"
          />
          <div className="wave-splash-pulse-ring" />
        </div>

        {/* Brand Titles */}
        <h1 className="wave-splash-title">WAVE RECORDS LLC</h1>
        <p className="wave-splash-subtitle">
          HEADLESS MUSIC DISTRIBUTION & ROYALTY OPERATIONS
        </p>

        {/* Animated Studio Equalizer Bars */}
        <div className="wave-splash-eq">
          {Array.from({ length: 16 }).map((_, i) => (
            <span
              key={i}
              className="wave-splash-eq-bar"
              style={{
                animationDelay: `${(i % 5) * 0.12}s`,
                animationDuration: `${0.6 + (i % 4) * 0.15}s`,
              }}
            />
          ))}
        </div>

        {/* 1.5-Second Laser Progress Bar */}
        <div className="wave-splash-progress-track">
          <div className="wave-splash-progress-fill" />
        </div>

        <span className="wave-splash-status-text">
          Calibrando canal de audio 24-bit / 48kHz y conectando a DSPs...
        </span>
      </div>
    </aside>
  );
}
