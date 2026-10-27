'use client';

import React, { useState } from 'react';
import { useWaveSession } from '../../../shared/session/SessionProvider.view';

export function W9FormView({
  onSubmitted,
}: {
  readonly onSubmitted: () => Promise<void>;
}): React.JSX.Element {
  const { accessToken } = useWaveSession();
  const [taxpayerLegalName, setTaxpayerLegalName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [federalTaxClassification, setClassification] = useState('LLC');
  const [tinType, setTinType] = useState<'SSN' | 'EIN'>('EIN');
  const [rawTinNumber, setRawTinNumber] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('FL');
  const [zipCode, setZipCode] = useState('');
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
      const res = await fetch('/api/compliance/tax/w9', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          formType: 'W9',
          taxpayerLegalName,
          ...(businessName ? { businessName } : {}),
          federalTaxClassification,
          tinType,
          rawTinNumber,
          addressLine1,
          city,
          stateCode: stateCode.toUpperCase(),
          zipCode,
          certifyUnderPenaltyOfPerjury: true,
          electronicSignatureName,
        }),
      });

      const body = (await res.json()) as {
        ok: boolean;
        value?: { maskedTaxId: string };
        error?: { message: string };
      };

      if (!res.ok || !body.ok) {
        setErrorMsg(body.error?.message ?? 'Error al enviar formulario W-9.');
        return;
      }

      setSuccessMsg(`Formulario W-9 cifrado y registrado (${body.value?.maskedTaxId}).`);
      setRawTinNumber('');
      await onSubmitted();
    } catch {
      setErrorMsg('Error de red al presentar W-9.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <article className="wave-card">
      <div className="wave-card-header">
        <span className="wave-badge-ok">IRS FORM W-9 (US PERSONS / ENTITIES)</span>
        <span className="wave-code-tag">module: tax-w9</span>
      </div>
      <h2 className="wave-card-title">Declaración Fiscal W-9 (Estados Unidos)</h2>
      <p className="wave-card-subtitle">
        El SSN o EIN se cifra inmediatamente en el servidor con AES-256-GCM.
      </p>

      <form onSubmit={handleSubmit} className="wave-form-grid">
        <label className="wave-label">
          Nombre Legal del Contribuyente (Línea 1 del W-9)
          <input
            type="text"
            required
            value={taxpayerLegalName}
            onChange={(e) => setTaxpayerLegalName(e.target.value)}
            className="wave-input"
          />
        </label>

        <label className="wave-label">
          Nombre Comercial / Disregarded Entity (Opcional)
          <input
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="wave-input"
          />
        </label>

        <label className="wave-label">
          Clasificación Fiscal Federal
          <select
            value={federalTaxClassification}
            onChange={(e) => setClassification(e.target.value)}
            className="wave-input"
          >
            <option value="INDIVIDUAL_SOLE_PROPRIETOR">Individual / Sole Proprietor</option>
            <option value="LLC">Limited Liability Company (LLC)</option>
            <option value="C_CORPORATION">C Corporation</option>
            <option value="S_CORPORATION">S Corporation</option>
            <option value="PARTNERSHIP">Partnership</option>
          </select>
        </label>

        <div className="wave-btn-group">
          <button
            type="button"
            onClick={() => setTinType('EIN')}
            className={tinType === 'EIN' ? 'wave-btn-active' : 'wave-btn-secondary'}
          >
            EIN (Employer ID)
          </button>
          <button
            type="button"
            onClick={() => setTinType('SSN')}
            className={tinType === 'SSN' ? 'wave-btn-active' : 'wave-btn-secondary'}
          >
            SSN (Seguro Social)
          </button>
        </div>

        <label className="wave-label">
          Número {tinType} (9 dígitos — se cifra con AES-256-GCM)
          <input
            type="password"
            required
            placeholder="Ej. 12-3456789"
            value={rawTinNumber}
            onChange={(e) => setRawTinNumber(e.target.value)}
            className="wave-input"
          />
        </label>

        <label className="wave-label">
          Dirección en EE. UU.
          <input
            type="text"
            required
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            className="wave-input"
          />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.5rem' }}>
          <label className="wave-label">
            Ciudad
            <input
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="wave-input"
            />
          </label>
          <label className="wave-label">
            Estado (2 letras)
            <input
              type="text"
              required
              maxLength={2}
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value.toUpperCase())}
              className="wave-input"
            />
          </label>
          <label className="wave-label">
            ZIP Code
            <input
              type="text"
              required
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              className="wave-input"
            />
          </label>
        </div>

        <label className="wave-label">
          Firma Electrónica (Bajo pena de perjurio)
          <input
            type="text"
            required
            value={electronicSignatureName}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Escribe tu nombre legal completo"
            className="wave-input"
          />
        </label>

        {errorMsg && <div className="wave-inline-error">{errorMsg}</div>}
        {successMsg && <div className="wave-pill-green">{successMsg}</div>}

        <button type="submit" disabled={isSubmitting} className="wave-btn-active">
          {isSubmitting ? 'Cifrando y firmando W-9...' : 'Firmar y Enviar W-9'}
        </button>
      </form>
    </article>
  );
}
