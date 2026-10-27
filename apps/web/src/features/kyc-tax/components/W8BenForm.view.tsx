'use client';

import React, { useState } from 'react';
import { useWaveSession } from '../../../shared/session/SessionProvider.view';

export function W8BenFormView({
  defaultCountryCode,
  onSubmitted,
}: {
  readonly defaultCountryCode: string;
  readonly onSubmitted: () => Promise<void>;
}): React.JSX.Element {
  const { accessToken } = useWaveSession();
  const [beneficialOwnerName, setOwnerName] = useState('');
  const [countryOfCitizenship, setCitizenship] = useState(
    defaultCountryCode === 'US' ? 'MX' : defaultCountryCode,
  );
  const [permanentResidenceAddress, setAddress] = useState('');
  const [cityOrTown, setCity] = useState('');
  const [countryOfResidence, setResidence] = useState(
    defaultCountryCode === 'US' ? 'MX' : defaultCountryCode,
  );
  const [rawForeignTaxId, setRawFtin] = useState('');
  const [dateOfBirthIso, setDob] = useState('1995-05-15');
  const [claimTaxTreatyBenefits, setClaimTreaty] = useState(true);
  const [treatyCountryCode, setTreatyCountry] = useState(
    defaultCountryCode === 'US' ? 'MX' : defaultCountryCode,
  );
  const [electronicSignatureName, setSignature] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!accessToken) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/compliance/tax/w8ben', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          formType: 'W8BEN',
          beneficialOwnerName,
          countryOfCitizenship: countryOfCitizenship.toUpperCase(),
          permanentResidenceAddress,
          cityOrTown,
          countryOfResidence: countryOfResidence.toUpperCase(),
          rawForeignTaxId,
          dateOfBirthIso,
          claimTaxTreatyBenefits,
          ...(claimTaxTreatyBenefits
            ? { treatyCountryCode: treatyCountryCode.toUpperCase() }
            : {}),
          certifyNonUsPersonAndPerjury: true,
          electronicSignatureName,
        }),
      });

      const body = (await res.json()) as {
        ok: boolean;
        value?: { maskedTaxId: string };
        error?: { message: string };
      };

      if (!res.ok || !body.ok) {
        setErrorMsg(body.error?.message ?? 'Error al enviar formulario W-8BEN.');
        return;
      }

      setSuccessMsg(`Formulario W-8BEN cifrado y registrado (${body.value?.maskedTaxId}).`);
      setRawFtin('');
      await onSubmitted();
    } catch {
      setErrorMsg('Error de red al presentar W-8BEN.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <article className="wave-card">
      <div className="wave-card-header">
        <span className="wave-badge-ok">IRS FORM W-8BEN (NON-US INDIVIDUALS)</span>
        <span className="wave-code-tag">module: tax-w8ben</span>
      </div>
      <h2 className="wave-card-title">Declaración Fiscal Internacional W-8BEN</h2>
      <p className="wave-card-subtitle">
        Para artistas y productores fuera de EE. UU. El Foreign Tax ID (RFC, RUT, NIF, CUIT) se
        cifra con AES-256-GCM.
      </p>

      <form onSubmit={handleSubmit} className="wave-form-grid">
        <label className="wave-label">
          Nombre Completo del Beneficiario Efectivo
          <input
            type="text"
            required
            value={beneficialOwnerName}
            onChange={(e) => setOwnerName(e.target.value)}
            className="wave-input"
          />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <label className="wave-label">
            País de Ciudadanía (ISO 2)
            <input
              type="text"
              required
              maxLength={2}
              value={countryOfCitizenship}
              onChange={(e) => setCitizenship(e.target.value.toUpperCase())}
              className="wave-input"
            />
          </label>
          <label className="wave-label">
            País de Residencia Fiscal (Distinto de US)
            <input
              type="text"
              required
              maxLength={2}
              value={countryOfResidence}
              onChange={(e) => setResidence(e.target.value.toUpperCase())}
              className="wave-input"
            />
          </label>
        </div>

        <label className="wave-label">
          Dirección de Residencia Permanente
          <input
            type="text"
            required
            value={permanentResidenceAddress}
            onChange={(e) => setAddress(e.target.value)}
            className="wave-input"
          />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <label className="wave-label">
            Ciudad o Provincia
            <input
              type="text"
              required
              value={cityOrTown}
              onChange={(e) => setCity(e.target.value)}
              className="wave-input"
            />
          </label>
          <label className="wave-label">
            Fecha de Nacimiento (YYYY-MM-DD)
            <input
              type="text"
              required
              value={dateOfBirthIso}
              onChange={(e) => setDob(e.target.value)}
              className="wave-input"
            />
          </label>
        </div>

        <label className="wave-label">
          Identificador Fiscal Extranjero — FTIN (RFC / NIF / RUT / CUIT — cifrado AES-256-GCM)
          <input
            type="password"
            required
            minLength={4}
            value={rawForeignTaxId}
            onChange={(e) => setRawFtin(e.target.value)}
            className="wave-input"
          />
        </label>

        <label className="wave-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={claimTaxTreatyBenefits}
            onChange={(e) => setClaimTreaty(e.target.checked)}
          />
          <span>Reclamar beneficios de Tratado de Doble Tributación con EE. UU.</span>
        </label>

        {claimTaxTreatyBenefits && (
          <label className="wave-label">
            País del Tratado Fiscal (ISO 2)
            <input
              type="text"
              required
              maxLength={2}
              value={treatyCountryCode}
              onChange={(e) => setTreatyCountry(e.target.value.toUpperCase())}
              className="wave-input"
            />
          </label>
        )}

        <label className="wave-label">
          Firma Electrónica del Beneficiario (Bajo pena de perjurio)
          <input
            type="text"
            required
            value={electronicSignatureName}
            onChange={(e) => setSignature(e.target.value)}
            className="wave-input"
          />
        </label>

        {errorMsg && <div className="wave-inline-error">{errorMsg}</div>}
        {successMsg && <div className="wave-pill-green">{successMsg}</div>}

        <button type="submit" disabled={isSubmitting} className="wave-btn-active">
          {isSubmitting ? 'Cifrando y firmando W-8BEN...' : 'Firmar y Enviar W-8BEN'}
        </button>
      </form>
    </article>
  );
}
