'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWaveSession } from '../session/SessionProvider.view';
import { useShowcaseMode } from '../showcase/ShowcaseModeProvider.view';
import { WaveHexLogoView } from '../brand/WaveHexLogo.view';

export function WaveTopNavView(): React.JSX.Element {
  const pathname = usePathname();
  const { currentUser, logoutSession } = useWaveSession();
  const { isShowcaseMode, toggleShowcaseMode } = useShowcaseMode();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Close mobile drawer whenever the user navigates
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const isActive = (path: string): boolean => {
    if (path === '/' && pathname === '/') return true;
    if (path !== '/' && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="wave-topbar">
      <div className="wave-topbar-main-row">
        {/* Brand Identity */}
        <div className="wave-topbar-brand">
          <Link href="/" className="wave-brand-link">
            <WaveHexLogoView size={42} useOfficialAsset={true} showGlow={true} />
            <div>
              <span className="wave-brand-title">WAVE RECORDS LLC</span>
              <span className="wave-brand-subtitle">
                STUDIO OPERATIONS & ROYALTY ENGINE
              </span>
            </div>
          </Link>
        </div>

        {/* Grouped Desktop Navigation Deck (Hidden on Mobile) */}
        <nav className="wave-topbar-nav" aria-label="Navegación Principal">
          <div className="wave-nav-group">
            <Link
              href="/"
              className={`wave-nav-tab ${isActive('/') ? 'wave-nav-tab-active' : ''}`}
            >
              Inicio
            </Link>
            <Link
              href="/panel/catalogo"
              className={`wave-nav-tab ${isActive('/panel/catalogo') ? 'wave-nav-tab-active' : ''}`}
            >
              Catálogo
            </Link>
            <Link
              href="/panel/finanzas"
              className={`wave-nav-tab ${isActive('/panel/finanzas') ? 'wave-nav-tab-active' : ''}`}
            >
              Finanzas & Splits
            </Link>
            <Link
              href="/panel/cumplimiento"
              className={`wave-nav-tab ${isActive('/panel/cumplimiento') ? 'wave-nav-tab-active' : ''}`}
            >
              KYC & Impuestos
            </Link>
            <Link
              href="/admin/moderacion"
              className={`wave-nav-tab ${isActive('/admin/moderacion') ? 'wave-nav-tab-active' : ''}`}
            >
              Moderación DSPs
            </Link>
          </div>
        </nav>

        {/* Desktop Utility & Session Controls (Hidden on Mobile) */}
        <div className="wave-topbar-actions">
          {/* Showcase Mode Toggle */}
          <button
            type="button"
            onClick={toggleShowcaseMode}
            title="Alternar entre datos de demostración para cliente y base de datos PostgreSQL 18"
            className={`wave-showcase-pill ${isShowcaseMode ? 'wave-showcase-pill-active' : 'wave-showcase-pill-real'}`}
          >
            <span className="wave-showcase-dot" />
            <span>{isShowcaseMode ? 'Modo Demo Cliente: ACTIVO' : 'Modo Operación Real'}</span>
          </button>

          {/* User Auth Deck */}
          {!currentUser ? (
            <div className="wave-auth-btns">
              <Link href="/ingresar" className="wave-nav-btn-secondary">
                Ingresar
              </Link>
              <Link href="/registro" className="wave-nav-btn-gold">
                Registro
              </Link>
            </div>
          ) : (
            <div className="wave-user-pill-deck">
              <span className="wave-pill-gold">
                {currentUser.tenant.displayName} ({currentUser.role})
              </span>
              <button
                type="button"
                onClick={() => void logoutSession()}
                className="wave-nav-btn-secondary"
              >
                Salir
              </button>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Toggle Button (Shown on <= 960px) */}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          className={`wave-mobile-menu-btn ${isMobileMenuOpen ? 'wave-mobile-menu-btn-open' : ''}`}
          aria-label={isMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú de navegación'}
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? (
            <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>✕</span>
          ) : (
            <div className="wave-hamburger-icon">
              <span />
              <span />
              <span />
            </div>
          )}
        </button>
      </div>

      {/* Responsive Collapsible Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="wave-mobile-drawer" role="dialog" aria-label="Menú Móvil">
          <div className="wave-mobile-drawer-inner">
            <span className="wave-mobile-drawer-label">Estaciones de Estudio</span>
            <div className="wave-mobile-nav-list">
              <Link
                href="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`wave-mobile-nav-link ${isActive('/') ? 'wave-mobile-nav-link-active' : ''}`}
              >
                <span>🏠</span> Inicio
              </Link>
              <Link
                href="/panel/catalogo"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`wave-mobile-nav-link ${isActive('/panel/catalogo') ? 'wave-mobile-nav-link-active' : ''}`}
              >
                <span>💿</span> Catálogo & Ingesta WAV
              </Link>
              <Link
                href="/panel/finanzas"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`wave-mobile-nav-link ${isActive('/panel/finanzas') ? 'wave-mobile-nav-link-active' : ''}`}
              >
                <span>🪙</span> Billetera & Splits en Escrow
              </Link>
              <Link
                href="/panel/cumplimiento"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`wave-mobile-nav-link ${isActive('/panel/cumplimiento') ? 'wave-mobile-nav-link-active' : ''}`}
              >
                <span>🛡️</span> Expediente KYC & Fiscal IRS
              </Link>
              <Link
                href="/admin/moderacion"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`wave-mobile-nav-link ${isActive('/admin/moderacion') ? 'wave-mobile-nav-link-active' : ''}`}
              >
                <span>⚖️</span> Mesa de Moderación DSPs
              </Link>
            </div>

            <div className="wave-mobile-drawer-divider" />

            {/* Mobile Showcase Mode Switch */}
            <div style={{ marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={toggleShowcaseMode}
                className={`wave-showcase-pill ${isShowcaseMode ? 'wave-showcase-pill-active' : 'wave-showcase-pill-real'}`}
                style={{ width: '100%', justifyContent: 'center', padding: '0.65rem' }}
              >
                <span className="wave-showcase-dot" />
                <span>{isShowcaseMode ? 'Modo Demo Cliente: ACTIVO' : 'Modo Operación Real'}</span>
              </button>
            </div>

            {/* Mobile Auth Deck */}
            {!currentUser ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <Link
                  href="/ingresar"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="wave-nav-btn-secondary"
                  style={{ textAlign: 'center', padding: '0.65rem' }}
                >
                  Ingresar
                </Link>
                <Link
                  href="/registro"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="wave-nav-btn-gold"
                  style={{ textAlign: 'center', padding: '0.65rem' }}
                >
                  Registro
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <span className="wave-pill-gold" style={{ textAlign: 'center' }}>
                  {currentUser.tenant.displayName} ({currentUser.role})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void logoutSession();
                    setIsMobileMenuOpen(false);
                  }}
                  className="wave-nav-btn-secondary"
                  style={{ width: '100%', padding: '0.65rem' }}
                >
                  Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
