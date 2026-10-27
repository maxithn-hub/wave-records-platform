'use client';

import React from 'react';
import { TenantTypeSelectorView } from './TenantTypeSelector.view';
import { useRegisterTenant } from '../hooks/useRegisterTenant.hook';

export function RegisterFormView(): React.JSX.Element {
  const {
    tier,
    setTier,
    legalName,
    setLegalName,
    displayName,
    setDisplayName,
    countryCode,
    setCountryCode,
    email,
    setEmail,
    password,
    setPassword,
    acceptTerms,
    setAcceptTerms,
    isSubmitting,
    errorMessage,
    submitRegistration,
  } = useRegisterTenant();

  return (
    <article className="wave-card">
      <div className="wave-card-header">
        <span className="wave-badge-info">ONBOARDING MULTI-TENANT</span>
        <span className="wave-code-tag">module: auth-register</span>
      </div>
      <h2 className="wave-card-title">Crear Cuenta en Wave Records LLC</h2>
      <p className="wave-card-subtitle">
        Selecciona el nivel operativo para configurar los requisitos legales e impositivos:
      </p>

      <TenantTypeSelectorView selectedTier={tier} onSelectTier={setTier} />

      <form onSubmit={submitRegistration} className="wave-form-grid">
        <label className="wave-label">
          Nombre Legal Completo (Persona Física o Razón Social)
          <input
            type="text"
            required
            minLength={2}
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            placeholder="Ej. Carlos Rivera Morales / Apex Records LLC"
            className="wave-input"
          />
        </label>

        <label className="wave-label">
          Nombre Artístico o Comercial (Sello / Productor)
          <input
            type="text"
            required
            minLength={2}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ej. Nova Wave Music"
            className="wave-input"
          />
        </label>

        <label className="wave-label">
          País de Residencia Fiscal (ISO 2 letras: US, MX, CO, ES, AR...)
          <input
            type="text"
            required
            maxLength={2}
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
            className="wave-input"
          />
        </label>

        <label className="wave-label">
          Correo Electrónico Corporativo / Principal
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="artista@dominio.com"
            className="wave-input"
          />
        </label>

        <label className="wave-label">
          Contraseña Maestra (Mínimo 12 caracteres, Argon2id)
          <input
            type="password"
            required
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="wave-input"
          />
        </label>

        <label className="wave-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
          />
          <span>Acepto el contrato de distribución y políticas anti-fraude de Wave Records LLC</span>
        </label>

        {errorMessage && <div className="wave-inline-error">{errorMessage}</div>}

        <button type="submit" disabled={isSubmitting} className="wave-btn-active">
          {isSubmitting ? 'Registrando Tenant...' : 'Crear Cuenta e Ir a Cumplimiento Fiscal'}
        </button>
      </form>
    </article>
  );
}
