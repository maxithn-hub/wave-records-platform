'use client';

import React, { useState } from 'react';
import type { ReleaseType } from '@wave/contracts';

export function CreateReleaseDraftCardView({
  defaultOwnerName,
  onCreateDraft,
}: {
  readonly defaultOwnerName: string;
  readonly onCreateDraft: (params: {
    title: string;
    primaryArtist: string;
    releaseType: ReleaseType;
    primaryGenre: string;
    upcCode?: string;
    pLineOwner: string;
    cLineOwner: string;
  }) => Promise<boolean>;
}): React.JSX.Element {
  const [title, setTitle] = useState('');
  const [primaryArtist, setPrimaryArtist] = useState(defaultOwnerName);
  const [releaseType, setReleaseType] = useState<ReleaseType>('SINGLE');
  const [primaryGenre, setPrimaryGenre] = useState('Latin / Urbano');
  const [upcCode, setUpcCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const ok = await onCreateDraft({
        title,
        primaryArtist,
        releaseType,
        primaryGenre,
        ...(upcCode.trim() ? { upcCode: upcCode.trim() } : {}),
        pLineOwner: primaryArtist,
        cLineOwner: primaryArtist,
      });
      if (ok) {
        setTitle('');
        setUpcCode('');
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <article className="wave-card">
      <div className="wave-card-header">
        <span className="wave-badge-info">NUEVO LANZAMIENTO DDEX</span>
        <span className="wave-code-tag">module: release-draft-creator</span>
      </div>
      <h2 className="wave-card-title">1. Crear Borrador de Lanzamiento</h2>
      <p className="wave-card-subtitle">
        Valida dígito de control UPC Módulo-10 e inicializa la máquina de estados en{' '}
        <code>DRAFT</code>.
      </p>

      <form onSubmit={handleSubmit} className="wave-form-grid">
        <label className="wave-label">
          Título del Lanzamiento (Single / EP / Álbum)
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Midnight Horizon"
            className="wave-input"
          />
        </label>

        <label className="wave-label">
          Artista Principal
          <input
            type="text"
            required
            value={primaryArtist}
            onChange={(e) => setPrimaryArtist(e.target.value)}
            className="wave-input"
          />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <label className="wave-label">
            Formato de Lanzamiento
            <select
              value={releaseType}
              onChange={(e) => setReleaseType(e.target.value as ReleaseType)}
              className="wave-input"
            >
              <option value="SINGLE">SINGLE (1 Track)</option>
              <option value="EP">EP (2 a 6 Tracks)</option>
              <option value="ALBUM">ALBUM (7+ Tracks)</option>
            </select>
          </label>

          <label className="wave-label">
            Género Principal
            <input
              type="text"
              required
              value={primaryGenre}
              onChange={(e) => setPrimaryGenre(e.target.value)}
              className="wave-input"
            />
          </label>
        </div>

        <label className="wave-label">
          Código de Barras UPC-12 / EAN-13 (Opcional — se valida Módulo-10)
          <input
            type="text"
            value={upcCode}
            onChange={(e) => setUpcCode(e.target.value)}
            placeholder="Ej. 036000291452"
            className="wave-input"
          />
        </label>

        <button type="submit" disabled={isCreating} className="wave-btn-active">
          {isCreating ? 'Creando Borrador...' : 'Crear Lanzamiento en Catálogo'}
        </button>
      </form>
    </article>
  );
}
