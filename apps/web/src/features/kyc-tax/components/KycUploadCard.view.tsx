'use client';

import React, { useState } from 'react';
import type { KycDocumentType } from '@wave/contracts';
import { useWaveSession } from '../../../shared/session/SessionProvider.view';

export function KycUploadCardView({
  onSubmitted,
}: {
  readonly onSubmitted: () => Promise<void>;
}): React.JSX.Element {
  const { accessToken } = useWaveSession();
  const [documentType, setDocumentType] = useState<KycDocumentType>('PASSPORT');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!selectedFile || !accessToken) return;

    setIsUploading(true);
    setFeedback(null);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('documentType', documentType);
      formData.append('file', selectedFile);

      const res = await fetch('/api/compliance/kyc/documents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });

      const body = (await res.json()) as {
        ok: boolean;
        error?: { message: string };
      };

      if (!res.ok || !body.ok) {
        setErrorMsg(body.error?.message ?? 'No se pudo subir el documento KYC.');
        return;
      }

      setFeedback('Documento cifrado con AES-256-GCM y enviado a revisión exitosamente.');
      await onSubmitted();
    } catch {
      setErrorMsg('Fallo de red al subir documento KYC.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <article className="wave-card">
      <div className="wave-card-header">
        <span className="wave-badge-info">PUERTO KYC DESACOPLADO</span>
        <span className="wave-code-tag">module: kyc-upload</span>
      </div>
      <h2 className="wave-card-title">Subida de Documento de Identidad (KYC)</h2>
      <p className="wave-card-subtitle">
        Se valida mediante inspección de bytes mágicos (PDF, PNG o JPEG hasta 10 MB) y se cifra en
        reposo con AES-256-GCM.
      </p>

      <form onSubmit={handleSubmit} className="wave-form-grid">
        <label className="wave-label">
          Tipo de Documento Oficial
          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as KycDocumentType)}
            className="wave-input"
          >
            <option value="PASSPORT">Pasaporte Vigente</option>
            <option value="NATIONAL_ID">Documento Nacional de Identidad (DNI / INE / Cédula)</option>
            <option value="DRIVERS_LICENSE">Licencia de Conducir</option>
            <option value="ARTICLES_OF_INCORPORATION">Acta Constitutiva (Sellos / LLC)</option>
          </select>
        </label>

        <label className="wave-label">
          Archivo (PDF, PNG o JPG auténtico)
          <input
            type="file"
            required
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            className="wave-input"
          />
        </label>

        {errorMsg && <div className="wave-inline-error">{errorMsg}</div>}
        {feedback && <div className="wave-pill-green">{feedback}</div>}

        <button type="submit" disabled={isUploading || !selectedFile} className="wave-btn-active">
          {isUploading ? 'Cifrando y subiendo...' : 'Enviar Documento a Verificación'}
        </button>
      </form>
    </article>
  );
}
