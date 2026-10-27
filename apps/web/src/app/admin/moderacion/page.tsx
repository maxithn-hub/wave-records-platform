'use client';

import React from 'react';
import { IsolatedModuleBoundary } from '../../../shared/error-isolation/IsolatedModuleBoundary.view';
import { useWaveSession } from '../../../shared/session/SessionProvider.view';
import { useShowcaseMode } from '../../../shared/showcase/ShowcaseModeProvider.view';
import { useAdminModerationQueue } from '../../../features/admin-moderation/hooks/useAdminModerationQueue.hook';
import { ReleaseModerationQueueCardView } from '../../../features/admin-moderation/components/ReleaseModerationQueueCard.view';
import { RevelatorDispatchTelemetryCardView } from '../../../features/admin-moderation/components/RevelatorDispatchTelemetryCard.view';

export default function AdminModerationPage(): React.JSX.Element {
  const { currentUser } = useWaveSession();
  const { isShowcaseMode } = useShowcaseMode();
  const {
    items,
    selectedItem,
    setSelectedReleaseId,
    inspectedPdf,
    lastDispatchResult,
    loading,
    errorMessage,
    inspectBeatLicense,
    submitModerationDecision,
  } = useAdminModerationQueue();

  const activeTelemetry =
    lastDispatchResult ?? selectedItem?.latestDeliveryJob ?? null;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
            Wave Records LLC · Backoffice de Operaciones
          </span>
          <h1 className="text-2xl font-bold text-white">
            Moderación de Catálogo y Despacho Headless a Revelator V1/V2
          </h1>
        </div>
      </header>

      {!currentUser && isShowcaseMode && (
        <div style={{ background: 'rgba(245, 196, 62, 0.1)', border: '1px solid rgba(245, 196, 62, 0.3)', borderRadius: '10px', padding: '0.75rem 1.25rem', color: '#f5c43e', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <strong>★ VISTA DE DEMOSTRACIÓN PARA CLIENTE:</strong> Backoffice con cola de moderación, descifrado AES-256-GCM de contratos PDF de BeatStars y telemetría de distribución Revelator V1/V2.
        </div>
      )}

      <IsolatedModuleBoundary
        moduleId="mod-admin-release-moderation-queue"
        moduleTitle="Cola de Moderación DDEX & Copyright (Admin)"
      >
        <ReleaseModerationQueueCardView
          items={items}
          selectedItem={selectedItem}
          inspectedPdf={inspectedPdf}
          loading={loading}
          errorMessage={errorMessage}
          onSelectRelease={setSelectedReleaseId}
          onInspectBeatLicense={inspectBeatLicense}
          onSubmitDecision={submitModerationDecision}
        />
      </IsolatedModuleBoundary>

      <IsolatedModuleBoundary
        moduleId="mod-revelator-headless-telemetry"
        moduleTitle="Telemetría Headless Revelator V1/V2 y Unprompted Auth"
      >
        <RevelatorDispatchTelemetryCardView deliveryJob={activeTelemetry} />
      </IsolatedModuleBoundary>
    </main>
  );
}
