'use client';

import React, { useState } from 'react';
import type { CatalogReleaseDetailDto } from '@wave/contracts';
import { useForensicInspector } from '../hooks/useForensicInspector.hook';

export function ForensicPipelineCardView({
  release,
  onReleaseStateChanged,
}: {
  readonly release: CatalogReleaseDetailDto;
  readonly onReleaseStateChanged: () => Promise<void>;
}): React.JSX.Element {
  const {
    report,
    isScanning,
    isUploadingLicense,
    errorMessage,
    executeForensicScan,
    uploadBeatLicensePdf,
  } = useForensicInspector(release.id, onReleaseStateChanged);

  const [simulatedScore, setSimulatedScore] = useState<number>(12);
  const [licensePdfFile, setLicensePdfFile] = useState<File | null>(null);

  return (
    <article className="wave-card">
      <div className="wave-card-header">
        <span className="wave-badge-warn">FASE 3 • FORENSICS & ACRCLOUD</span>
        <span className="wave-code-tag">module: forensic-pipeline</span>
      </div>

      <h2 className="wave-card-title">
        Inspector Forense Pre-Revelator ({release.title})
      </h2>
      <p className="wave-card-subtitle">
        Verifica dimensiones <code>3000x3000 px RGB</code> en portada, ausencia de silencio/ruido
        estático (<code>silencedetect</code>) y huella acústica <code>HMAC-SHA1</code> en ACRCloud.
      </p>

      {release.status === 'FORENSIC_PROCESSING' && (
        <div className="wave-ledger-box" style={{ marginBottom: '1rem' }}>
          <label className="wave-label">
            Escenario de Escaneo Acústico ACRCloud (Simulador Sandbox / Producción)
            <select
              value={simulatedScore}
              onChange={(e) => setSimulatedScore(Number(e.target.value))}
              className="wave-input"
            >
              <option value={12}>
                Score 12% (&lt; 45% Clean Pass → Pasa directo a MODERATION_QUEUE)
              </option>
              <option value={64}>
                Score 64% (45% - 79% Type Beat / Sample → Pausa en MANUAL_COPYRIGHT_REVIEW + Bloquea
                UGC)
              </option>
              <option value={92}>
                Score 92% (≥ 80% Infracción Copyright → Rechazo Automático REJECTED)
              </option>
            </select>
          </label>

          <button
            type="button"
            disabled={isScanning}
            onClick={() => void executeForensicScan(simulatedScore)}
            className="wave-btn-active"
            style={{ marginTop: '0.5rem' }}
          >
            {isScanning
              ? 'Analizando muestras PCM, Portada 3000x3000 y ACRCloud...'
              : 'Ejecutar Pipeline Forense sobre Archivos en Cuarentena'}
          </button>
        </div>
      )}

      {errorMessage && <div className="wave-inline-error">{errorMessage}</div>}

      {report && (
        <ul className="wave-status-list" style={{ marginTop: '0.75rem' }}>
          <li className="wave-status-item">
            <div className="wave-status-row">
              <strong>Portada Cuadrada 3000x3000 RGB:</strong>
              <span className={report.artworkPassed ? 'wave-pill-green' : 'wave-pill-muted'}>
                {report.artworkWidthPx}x{report.artworkHeightPx} px ({report.artworkColorSpace})
              </span>
            </div>
          </li>

          <li className="wave-status-item">
            <div className="wave-status-row">
              <strong>Análisis de Señal PCM (silencedetect):</strong>
              <span className="wave-pill-green">
                Silencio Máx: {(report.audioSilenceMaxRatio * 100).toFixed(1)}% (Aprobado)
              </span>
            </div>
          </li>

          <li className="wave-status-item">
            <div className="wave-status-row">
              <strong>Veredicto Copyright ACRCloud (Score {report.maxAcrCloudScore}%):</strong>
              <span
                className={
                  report.acrCloudVerdict === 'CLEAN_PASS'
                    ? 'wave-pill-green'
                    : 'wave-badge-warn'
                }
              >
                {report.acrCloudVerdict}
              </span>
            </div>
            <p className="wave-status-detail">{report.summaryReason}</p>
            {report.blockUgcMonetization && (
              <p className="wave-inline-error" style={{ marginTop: '0.35rem' }}>
                Bloqueo UGC Activo: No se entregará a YouTube Content ID, TikTok ni Meta Rights
                Manager.
              </p>
            )}
          </li>
        </ul>
      )}

      {/* Si cayó en Zona Gris (45% - 79%), exigir Licencia PDF para destrabar hacia MODERATION_QUEUE */}
      {release.status === 'MANUAL_COPYRIGHT_REVIEW' && (
        <div className="wave-fault-card" style={{ marginTop: '1rem' }}>
          <h3 className="wave-fault-title">
            Acción Requerida: Subir Licencia PDF de Type Beat / Sample
          </h3>
          <p className="wave-fault-desc">
            ACRCloud detectó una coincidencia parcial (45%–79%). Para liberar este lanzamiento hacia
            la cola de moderación (manteniendo bloqueados los sistemas UGC), adjunta tu contrato de
            licencia en PDF:
          </p>
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => setLicensePdfFile(e.target.files?.[0] ?? null)}
            className="wave-input"
            style={{ width: '100%', marginBottom: '0.75rem' }}
          />
          <button
            type="button"
            disabled={!licensePdfFile || isUploadingLicense}
            onClick={() => {
              if (licensePdfFile) void uploadBeatLicensePdf(licensePdfFile);
            }}
            className="wave-btn-recover"
          >
            {isUploadingLicense
              ? 'Cifrando y adjuntando licencia PDF...'
              : 'Adjuntar Licencia PDF y Pasar a Moderación'}
          </button>
        </div>
      )}
    </article>
  );
}
