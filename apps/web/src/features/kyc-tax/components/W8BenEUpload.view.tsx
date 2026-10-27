'use client';

import React, { useState } from 'react';
import { useWaveSession } from '../../../shared/session/SessionProvider.view';

export function W8BenEUploadView({
  defaultCountryCode,
  onSubmitted,
}: {
  readonly defaultCountryCode: string;
  readonly onSubmitted: () => Promise<void>;
}): React.JSX.Element {
  const { accessToken } = useWaveSession();
  const [entityLegalName, setEntityName] = useState('');
  const [countryOfIncorporation, setCountry] = useState(
    defaultCountryCode === 'US' ? 'MX' : defaultCountryCode,
  );
  const [electronicSignatureName, setSignature] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!accessToken || !pdfFile) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const formData = new FormData();
      formData.append('entityLegalName', entityLegalName);
      formData.append('countryOfIncorporation', countryOfIncorporation.toUpperCase());
      formData.append('electronicSignatureName', electronicSignatureName);
      formData.append('file', pdfFile);

      const res = await fetch('/api/compliance/tax/w8bene', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });

      const body = (await res.json()) as {
        ok: boolean;
        error?: { message: string };
      };

      if (!res.ok || !body.ok) {
        setErrorMsg(body.error?.message ?? 'Error al subir PDF W-8BEN-E.');
        return;
      }

      setSuccessMsg('PDF oficial W-8BEN-E cifrado y enviado a revisión manual.');
      await onSubmitted();
    } catch {
      setErrorMsg('Error de red al subir W-8BEN-E.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <article className="wave-card">
      <div className="wave-card-header">
        <span className="wave-badge-info">IRS FORM W-8BEN-E (FOREIGN LABELS / ENTITIES)</span>
        <span className="wave-code-tag">module: tax-w8bene</span>
      </div>
      <h2 className="wave-card-title">Subida de Formulario W-8BEN-E (Sellos Extranjeros)</h2>
      <p className="wave-card-subtitle">
        Para personas morales y sellos fuera de EE. UU. Sube el PDF oficial firmado para revisión
        del oficial de cumplimiento.
      </p>

      <form onSubmit={handleSubmit} className="wave-form-grid">
        <label className="wave-label">
          Razón Social del Sello / Entidad Extranjera
          <input
            type="text"
            required
            value={entityLegalName}
            onChange={(e) => setEntityName(e.target.value)}
            className="wave-input"
          />
        </label>

        <label className="wave-label">
          País de Constitución (ISO 2 letras, distinto de US)
          <input
            type="text"
            required
            maxLength={2}
            value={countryOfIncorporation}
            onChange={(e) => setCountry(e.target.value.toUpperCase())}
            className="wave-input"
          />
        </label>

        <label className="wave-label">
          Nombre del Representante Legal Firmante
          <input
            type="text"
            required
            value={electronicSignatureName}
            onChange={(e) => setSignature(e.target.value)}
            className="wave-input"
          />
        </label>

        <label className="wave-label">
          Archivo PDF Oficial W-8BEN-E Firmado (Máx. 10 MB)
          <input
            type="file"
            required
            accept=".pdf"
            onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
            className="wave-input"
          />
        </label>

        {errorMsg && <div className="wave-inline-error">{errorMsg}</div>}
        {successMsg && <div className="wave-pill-green">{successMsg}</div>}

        <button type="submit" disabled={isSubmitting || !pdfFile} className="wave-btn-active">
          {isSubmitting ? 'Cifrando y subiendo PDF...' : 'Subir W-8BEN-E Firmado'}
        </button>
      </form>
    </article>
  );
}
