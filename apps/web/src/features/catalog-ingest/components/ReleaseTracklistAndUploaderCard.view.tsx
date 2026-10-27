'use client';

import React, { useState } from 'react';
import type { CatalogReleaseDetailDto } from '@wave/contracts';
import type { PlatformCapabilities } from '@wave/domain-core';
import { useChunkedSha256Uploader } from '../hooks/useChunkedSha256Uploader.hook';

export function ReleaseTracklistAndUploaderCardView({
  release,
  capabilities,
  onUpsertTrack,
  onSubmitToForensics,
  onReloadRelease,
}: {
  readonly release: CatalogReleaseDetailDto;
  readonly capabilities: PlatformCapabilities;
  readonly onUpsertTrack: (params: {
    releaseId: string;
    trackNumber: number;
    title: string;
    primaryArtist: string;
    isrcCode: string;
    isExplicit: boolean;
    isInstrumental: boolean;
  }) => Promise<boolean>;
  readonly onSubmitToForensics: (releaseId: string) => Promise<boolean>;
  readonly onReloadRelease: () => Promise<void>;
}): React.JSX.Element {
  const {
    isUploading,
    progressPercent,
    statusText,
    errorMessage: uploadError,
    uploadFileInChunks,
  } = useChunkedSha256Uploader();

  const [trackNumber, setTrackNumber] = useState(release.tracks.length + 1);
  const [trackTitle, setTrackTitle] = useState(release.title);
  const [trackIsrc, setTrackIsrc] = useState('US-RC1-26-00451');
  const [isExplicit, setIsExplicit] = useState(false);
  const [isInstrumental, setIsInstrumental] = useState(false);

  const handleSaveTrack = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const ok = await onUpsertTrack({
      releaseId: release.id,
      trackNumber,
      title: trackTitle,
      primaryArtist: release.primaryArtist,
      isrcCode: trackIsrc,
      isExplicit,
      isInstrumental,
    });
    if (ok) {
      setTrackNumber((prev) => prev + 1);
    }
  };

  return (
    <article className="wave-card">
      <div className="wave-card-header">
        <span className={release.isEditable ? 'wave-badge-info' : 'wave-badge-ok'}>
          FSM ESTADO: {release.status}
        </span>
        <span className="wave-code-tag">module: release-multipart-ingest</span>
      </div>

      <h2 className="wave-card-title">
        {release.title} — {release.primaryArtist} ({release.releaseType})
      </h2>
      <p className="wave-card-subtitle">
        UPC: <code>{release.upcCode ?? 'Pendiente'}</code> • Portada en Cuarentena:{' '}
        <strong>{release.artworkQuarantineKey ? 'VERIFICADA (SHA-256)' : 'PENDIENTE'}</strong>
      </p>

      {/* Subida de Portada 3000x3000 RGB */}
      {release.isEditable && capabilities.canUploadHighResArtwork && (
        <div className="wave-status-item" style={{ marginBottom: '1rem' }}>
          <label className="wave-label">
            Subir Portada Oficial (3000x3000 px RGB — Multipart + SHA-256)
            <input
              type="file"
              accept=".png,.jpg,.jpeg"
              disabled={isUploading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const ok = await uploadFileInChunks({
                  releaseId: release.id,
                  assetKind: 'RELEASE_ARTWORK',
                  file,
                });
                if (ok) await onReloadRelease();
              }}
              className="wave-input"
            />
          </label>
        </div>
      )}

      {/* Formulario para añadir / editar Track (bloqueado si isEditable === false) */}
      {release.isEditable ? (
        <form onSubmit={handleSaveTrack} className="wave-form-grid" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: '0.5rem' }}>
            <label className="wave-label">
              Track #
              <input
                type="number"
                min={1}
                max={99}
                required
                value={trackNumber}
                onChange={(e) => setTrackNumber(Number(e.target.value))}
                className="wave-input"
              />
            </label>
            <label className="wave-label">
              Título del Track
              <input
                type="text"
                required
                value={trackTitle}
                onChange={(e) => setTrackTitle(e.target.value)}
                className="wave-input"
              />
            </label>
            <label className="wave-label">
              Código ISRC (ISO 3901)
              <input
                type="text"
                required
                value={trackIsrc}
                onChange={(e) => setTrackIsrc(e.target.value)}
                className="wave-input"
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <label className="wave-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={isExplicit}
                onChange={(e) => setIsExplicit(e.target.checked)}
              />
              <span>Letra Explícita</span>
            </label>

            <label className="wave-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={isInstrumental}
                onChange={(e) => setIsInstrumental(e.target.checked)}
              />
              <span>Instrumental (zxx)</span>
            </label>
          </div>

          <button type="submit" className="wave-btn-secondary">
            Guardar Metadatos del Track #{trackNumber}
          </button>
        </form>
      ) : (
        <div className="wave-ledger-box" style={{ marginBottom: '1rem' }}>
          <strong className="wave-ledger-value-highlight">
            Inmutabilidad de Catálogo Activa ({release.status})
          </strong>
          <p className="wave-status-detail">
            El lanzamiento ya fue enviado al pipeline forense y sus metadatos/audios están
            bloqueados contra modificaciones.
          </p>
        </div>
      )}

      {/* Estado de progreso Multipart + SHA-256 */}
      {(isUploading || statusText || uploadError) && (
        <div className="wave-ledger-box" style={{ marginBottom: '1rem' }}>
          {statusText && <p className="wave-status-detail">{statusText}</p>}
          {isUploading && (
            <p className="wave-ledger-value-highlight">Progreso: {progressPercent}%</p>
          )}
          {uploadError && <p className="wave-inline-error">{uploadError}</p>}
        </div>
      )}

      {/* Lista de Tracks y Subida de WAV PCM por fragmentos */}
      <ul className="wave-status-list">
        {release.tracks.map((track) => (
          <li key={track.id} className="wave-status-item">
            <div className="wave-status-row">
              <strong>
                #{track.trackNumber} — {track.title} (<code>{track.isrcCode}</code>)
              </strong>
              <span className={track.wavQuarantineKey ? 'wave-pill-green' : 'wave-pill-muted'}>
                {track.wavQuarantineKey
                  ? `WAV PCM ${track.sampleRateHz}Hz / ${track.bitDepth}-bit (${track.channels}ch)`
                  : 'SIN AUDIO WAV'}
              </span>
            </div>

            {track.wavSha256Hash && (
              <p className="wave-status-detail">
                SHA-256 Verificado: <code>{track.wavSha256Hash.slice(0, 24)}...</code>
              </p>
            )}

            {release.isEditable && (
              <div style={{ marginTop: '0.5rem' }}>
                {capabilities.canUploadLosslessWav ? (
                  <label className="wave-label">
                    Subir Audio Maestro .WAV (PCM 16/24-bit, ≥ 44.1 kHz, Estéreo)
                    <input
                      type="file"
                      accept=".wav,audio/wav"
                      disabled={isUploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const ok = await uploadFileInChunks({
                          releaseId: release.id,
                          trackId: track.id,
                          assetKind: 'TRACK_WAV',
                          file,
                        });
                        if (ok) await onReloadRelease();
                      }}
                      className="wave-input"
                    />
                  </label>
                ) : (
                  <span className="wave-pill-muted">
                    Subida de archivos .WAV pesados deshabilitada en modo Capacitor Android
                  </span>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {release.isEditable && (
        <div style={{ marginTop: '1.25rem' }}>
          <button
            type="button"
            disabled={isUploading}
            onClick={() => void onSubmitToForensics(release.id)}
            className="wave-btn-active"
          >
            Bloquear Metadatos y Enviar a Pipeline Forense (Fase 3)
          </button>
        </div>
      )}
    </article>
  );
}
