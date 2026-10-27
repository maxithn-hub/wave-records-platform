'use client';

import React from 'react';
import { IsolatedModuleBoundary } from '../../../shared/error-isolation/IsolatedModuleBoundary.view';
import { useWaveSession } from '../../../shared/session/SessionProvider.view';
import { useShowcaseMode } from '../../../shared/showcase/ShowcaseModeProvider.view';
import { usePlatformCapabilities } from '../../../shared/platform/usePlatformCapabilities.hook';
import { useCatalogManager } from '../../../features/catalog-ingest/hooks/useCatalogManager.hook';
import { CreateReleaseDraftCardView } from '../../../features/catalog-ingest/components/CreateReleaseDraftCard.view';
import { ReleaseTracklistAndUploaderCardView } from '../../../features/catalog-ingest/components/ReleaseTracklistAndUploaderCard.view';
import { ForensicPipelineCardView } from '../../../features/forensic-inspector/components/ForensicPipelineCard.view';

export default function CatalogoPage(): React.JSX.Element {
  const { currentUser, isLoadingSession } = useWaveSession();
  const { isShowcaseMode } = useShowcaseMode();
  const { capabilities } = usePlatformCapabilities('WEB_DESKTOP');
  const {
    releases,
    selectedRelease,
    setSelectedReleaseId,
    isLoading,
    errorMessage,
    loadReleases,
    createDraft,
    upsertTrack,
    submitToForensics,
  } = useCatalogManager();

  if (isLoadingSession || isLoading) {
    return <p className="wave-status-detail">Cargando motor de catálogo e ingesta...</p>;
  }

  if (!currentUser && !isShowcaseMode) {
    return (
      <article className="wave-card">
        <h2 className="wave-card-title">Sesión Requerida</h2>
        <p className="wave-card-subtitle">
          Inicia sesión para gestionar lanzamientos DDEX, códigos ISRC/UPC y subidas Multipart de
          archivos maestros .WAV.
        </p>
      </article>
    );
  }

  const effectiveOwner = currentUser?.tenant.displayName ?? 'Wave Lab Studios';

  return (
    <div className="wave-grid">
      {!currentUser && isShowcaseMode && (
        <div style={{ gridColumn: '1 / -1', background: 'rgba(245, 196, 62, 0.1)', border: '1px solid rgba(245, 196, 62, 0.3)', borderRadius: '10px', padding: '0.75rem 1.25rem', color: '#f5c43e', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <strong>★ VISTA DE DEMOSTRACIÓN PARA CLIENTE:</strong> Mostrando catálogo de muestra con archivos WAV 24-bit, portadas 3000x3000 y metadatos DDEX.
        </div>
      )}

      {errorMessage && (
        <div className="wave-inline-error" style={{ gridColumn: '1 / -1' }}>
          {errorMessage}
        </div>
      )}

      <IsolatedModuleBoundary
        moduleId="mod-catalog-create-draft"
        moduleTitle="Creador de Borradores de Lanzamiento (UPC / DDEX)"
      >
        <CreateReleaseDraftCardView
          defaultOwnerName={effectiveOwner}
          onCreateDraft={createDraft}
        />
      </IsolatedModuleBoundary>

      {selectedRelease ? (
        <IsolatedModuleBoundary
          moduleId="mod-catalog-multipart-uploader"
          moduleTitle="Ingesta Multipart SHA-256 & Validación WAV PCM"
        >
          <div>
            {releases.length > 1 && (
              <div className="wave-btn-group" style={{ marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                {releases.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedReleaseId(r.id)}
                    className={
                      r.id === selectedRelease.id ? 'wave-btn-active' : 'wave-btn-secondary'
                    }
                  >
                    {r.title} ({r.status})
                  </button>
                ))}
              </div>
            )}

            <ReleaseTracklistAndUploaderCardView
              release={selectedRelease}
              capabilities={capabilities}
              onUpsertTrack={upsertTrack}
              onSubmitToForensics={submitToForensics}
              onReloadRelease={loadReleases}
            />
          </div>
        </IsolatedModuleBoundary>
      ) : (
        <article className="wave-card">
          <h2 className="wave-card-title">Sin Lanzamientos Aún</h2>
          <p className="wave-card-subtitle">
            Crea tu primer lanzamiento en el formulario izquierdo para habilitar la subida por
            fragmentos de portadas y archivos .WAV PCM.
          </p>
        </article>
      )}

      {selectedRelease && (
        <div style={{ gridColumn: '1 / -1' }}>
          <IsolatedModuleBoundary
            moduleId="mod-forensic-acrcloud-inspector"
            moduleTitle="Pipeline Forense Pre-Revelator (FFmpeg / Sharp / ACRCloud)"
          >
            <ForensicPipelineCardView
              release={selectedRelease}
              onReleaseStateChanged={loadReleases}
            />
          </IsolatedModuleBoundary>
        </div>
      )}
    </div>
  );
}
