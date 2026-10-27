'use client';

import React from 'react';
import Image from 'next/image';

export interface WaveHexLogoProps {
  readonly size?: number;
  readonly showGlow?: boolean;
  readonly animated?: boolean;
  readonly useOfficialAsset?: boolean;
  readonly className?: string;
}

/**
 * High-definition representation of the official Wave Records LLC emblem:
 * Open solar gold hexagon split by an acoustic audio waveform over obsidian background.
 * Exact brand color values: #FFE07D (Highlight), #F5C43E (Solar Gold), #D99B16 (Warm Amber), #9A6708 (Deep Bronze).
 */
export function WaveHexLogoView({
  size = 40,
  showGlow = true,
  animated = false,
  useOfficialAsset = false,
  className = '',
}: WaveHexLogoProps): React.JSX.Element {
  if (useOfficialAsset) {
    return (
      <div
        className={`${animated ? 'wave-hex-animated' : ''} ${className}`}
        style={{
          width: size,
          height: size,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          filter: showGlow
            ? 'drop-shadow(0 0 12px rgba(245, 196, 62, 0.45)) drop-shadow(0 0 24px rgba(217, 155, 22, 0.25))'
            : undefined,
        }}
      >
        <Image
          src="/brand/wave-records-emblem-hd.png"
          alt="Wave Records LLC Official Emblem"
          width={size}
          height={size}
          priority
          style={{
            objectFit: 'contain',
            borderRadius: `${Math.round(size * 0.12)}px`,
          }}
        />
      </div>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${animated ? 'wave-hex-animated' : ''} ${className}`}
      style={{
        filter: showGlow
          ? 'drop-shadow(0 0 10px rgba(245, 196, 62, 0.5)) drop-shadow(0 0 22px rgba(217, 155, 22, 0.3))'
          : undefined,
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
    >
      <defs>
        <linearGradient id="waveGoldGradientV2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF2A8" />
          <stop offset="35%" stopColor="#F5C43E" />
          <stop offset="70%" stopColor="#D99B16" />
          <stop offset="100%" stopColor="#9A6708" />
        </linearGradient>
        <linearGradient id="waveWaveformGradient" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#D99B16" />
          <stop offset="20%" stopColor="#F5C43E" />
          <stop offset="50%" stopColor="#FFF4B8" />
          <stop offset="80%" stopColor="#F5C43E" />
          <stop offset="100%" stopColor="#D99B16" />
        </linearGradient>
      </defs>

      {/* Top Hexagon Roof (open waist) */}
      <path
        d="M 44 86 L 44 66 L 100 34 L 156 66 L 156 86"
        stroke="url(#waveGoldGradientV2)"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Bottom Hexagon Base (open waist) */}
      <path
        d="M 44 114 L 44 134 L 100 166 L 156 134 L 156 114"
        stroke="url(#waveGoldGradientV2)"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Central Acoustic Audio Waveform (High-Energy Sine Wave) */}
      <path
        d="M 10 100 
           C 18 95, 24 105, 32 100 
           C 38 90, 44 110, 52 88 
           C 60 58, 66 132, 74 78 
           C 82 24, 90 152, 100 64 
           C 110 6, 118 142, 126 82 
           C 134 66, 140 122, 148 90 
           C 156 78, 162 108, 170 100 
           C 178 95, 184 105, 190 100"
        stroke="url(#waveWaveformGradient)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
