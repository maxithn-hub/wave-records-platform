'use client';

import React, { useState } from 'react';
import type {
  ModerationQueueItem,
  BeatLicenseInspectionSummary,
  ModerationDecisionAction,
} from '@wave/contracts';

export interface ReleaseModerationQueueCardProps {
  readonly items: readonly ModerationQueueItem[];
  readonly selectedItem: ModerationQueueItem | null;
  readonly inspectedPdf: BeatLicenseInspectionSummary | null;
  readonly loading: boolean;
  readonly errorMessage: string | null;
  readonly onSelectRelease: (releaseId: string) => void;
  readonly onInspectBeatLicense: (releaseId: string) => Promise<void>;
  readonly onSubmitDecision: (params: {
    releaseId: string;
    decision: ModerationDecisionAction;
    moderationNotes: string;
  }) => Promise<void>;
}

export function ReleaseModerationQueueCardView({
  items,
  selectedItem,
  inspectedPdf,
  loading,
  errorMessage,
  onSelectRelease,
  onInspectBeatLicense,
  onSubmitDecision,
}: ReleaseModerationQueueCardProps): React.ReactElement {
  const [moderationNotes, setModerationNotes] = useState(
    'Metadatos DDEX, audio PCM y derechos ACRCloud verificados. Aprobado para Revelator V2.',
  );

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-6 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <span className="inline-block rounded bg-indigo-500/15 px-2.5 py-0.5 text-xs font-semibold text-indigo-300">
            Fase 4 · Backoffice de Moderación DDEX & Copyright
          </span>
          <h2 className="mt-1 text-lg font-bold text-slate-100">
            Cola de Moderación de Lanzamientos ({items.length})
          </h2>
        </div>
      </div>

      {errorMessage ? (
        <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-950/50 p-3 text-xs text-rose-200">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-2 lg:col-span-5">
          {items.length === 0 ? (
            <p className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400">
              No hay lanzamientos pendientes en la cola de moderación.
            </p>
          ) : (
            items.map((item) => {
              const isSelected = selectedItem?.releaseId === item.releaseId;
              return (
                <button
                  key={item.releaseId}
                  type="button"
                  onClick={() => onSelectRelease(item.releaseId)}
                  className={`w-full rounded-lg border p-3.5 text-left transition ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-950/30'
                      : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-100">
                      {item.title}
                    </span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-cyan-300">
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {item.primaryArtist} · Tenant: {item.tenantDisplayName} ({item.tenantTier})
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.blockUgcMonetization ? (
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                        Zona Gris 45-79% · UGC Bloqueado
                      </span>
                    ) : (
                      <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        ACRCloud Clean (&lt;45%)
                      </span>
                    )}
                    {item.hasBeatLicensePdf ? (
                      <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                        PDF Licencia Adjunto (AES-256-GCM)
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="lg:col-span-7">
          {selectedItem ? (
            <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    {selectedItem.title} ({selectedItem.releaseType})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Artista: {selectedItem.primaryArtist} · Género: {selectedItem.primaryGenre} · UPC:{' '}
                    {selectedItem.upcCode ?? 'Auto-Asignado en Revelator'}
                  </p>
                </div>
                <span className="rounded-md bg-indigo-500/20 px-2.5 py-1 font-mono text-xs font-semibold text-indigo-300">
                  {selectedItem.status}
                </span>
              </div>

              {selectedItem.latestForensicReport ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2.5">
                    <span className="block text-[10px] uppercase text-slate-400">
                      Portada 3000x3000 RGB
                    </span>
                    <span className="font-mono text-xs font-bold text-emerald-400">
                      {selectedItem.latestForensicReport.artworkWidthPx}x
                      {selectedItem.latestForensicReport.artworkHeightPx} (
                      {selectedItem.latestForensicReport.artworkColorSpace})
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2.5">
                    <span className="block text-[10px] uppercase text-slate-400">
                      Silencio Máximo PCM
                    </span>
                    <span className="font-mono text-xs font-bold text-cyan-300">
                      {(selectedItem.latestForensicReport.audioSilenceMaxRatio * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2.5">
                    <span className="block text-[10px] uppercase text-slate-400">
                      Score ACRCloud
                    </span>
                    <span className="font-mono text-xs font-bold text-amber-300">
                      {selectedItem.latestForensicReport.maxAcrCloudScore}% (
                      {selectedItem.latestForensicReport.acrCloudVerdict})
                    </span>
                  </div>
                </div>
              ) : null}

              {selectedItem.hasBeatLicensePdf ? (
                <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/25 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-cyan-200">
                        Contrato de Licencia de Beat Cifrado (AES-256-GCM)
                      </p>
                      <p className="text-[11px] text-cyan-100/75">
                        Descifrado en memoria exclusivamente para auditoría de derechos antes del despacho.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void onInspectBeatLicense(selectedItem.releaseId)}
                      className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
                    >
                      Descifrar e Inspeccionar PDF
                    </button>
                  </div>

                  {inspectedPdf && inspectedPdf.releaseId === selectedItem.releaseId ? (
                    <div className="mt-2 rounded border border-cyan-500/30 bg-slate-950/90 p-2.5 font-mono text-[11px] text-cyan-200">
                      <div>Magic Bytes (%PDF-): {inspectedPdf.pdfMagicHeaderValid ? 'VÁLIDO' : 'INVÁLIDO'}</div>
                      <div>Tamaño Descifrado: {inspectedPdf.decryptedByteLength} bytes</div>
                      <div className="truncate">SHA-256: {inspectedPdf.sha256Hex}</div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Notas de Moderación y Auditoría DDEX
                </label>
                <textarea
                  rows={2}
                  value={moderationNotes}
                  onChange={(e) => setModerationNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                />
              </div>

              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  type="button"
                  disabled={loading || selectedItem.status === 'LIVE_ON_DSPS'}
                  onClick={() =>
                    void onSubmitDecision({
                      releaseId: selectedItem.releaseId,
                      decision: 'APPROVE_AND_DISPATCH',
                      moderationNotes,
                    })
                  }
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  {loading
                    ? 'Despachando a Revelator V1/V2...'
                    : 'Aprobar y Despachar a Revelator API V2'}
                </button>

                <button
                  type="button"
                  disabled={loading || selectedItem.status === 'LIVE_ON_DSPS'}
                  onClick={() =>
                    void onSubmitDecision({
                      releaseId: selectedItem.releaseId,
                      decision: 'REJECT',
                      moderationNotes,
                    })
                  }
                  className="rounded-lg border border-rose-500/50 bg-rose-950/40 px-4 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-900/50 disabled:opacity-50"
                >
                  Rechazar Lanzamiento
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
