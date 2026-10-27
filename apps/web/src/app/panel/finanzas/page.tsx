'use client';

import React from 'react';
import { IsolatedModuleBoundary } from '../../../shared/error-isolation/IsolatedModuleBoundary.view';
import { useWaveSession } from '../../../shared/session/SessionProvider.view';
import { useShowcaseMode } from '../../../shared/showcase/ShowcaseModeProvider.view';
import { useRoyaltyLedger } from '../../../features/royalties-ledger/hooks/useRoyaltyLedger.hook';
import { RoyaltyBalanceAndPayoutCardView } from '../../../features/royalties-ledger/components/RoyaltyBalanceAndPayoutCard.view';
import { EscrowSplitsAndDspAnalyticsCardView } from '../../../features/royalties-ledger/components/EscrowSplitsAndDspAnalyticsCard.view';
import { ImmutableLedgerHistoryTableView } from '../../../features/royalties-ledger/components/ImmutableLedgerHistoryTable.view';

export default function PanelFinanzasPage(): React.JSX.Element {
  const { currentUser } = useWaveSession();
  const { isShowcaseMode } = useShowcaseMode();
  const {
    dashboard,
    loading,
    errorMessage,
    statusMessage,
    claimPendingEscrowSplits,
    requestPayout,
  } = useRoyaltyLedger();

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 text-slate-100">
      <header className="border-b border-slate-800 pb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
          Wave Records LLC · Billetera & Regalías de Precisión
        </span>
        <h1 className="text-2xl font-bold text-white">
          Motor Financiero DECIMAL(18, 10), Splits en Escrow y Analíticas DSP
        </h1>
      </header>

      {!currentUser && isShowcaseMode && (
        <div style={{ background: 'rgba(245, 196, 62, 0.1)', border: '1px solid rgba(245, 196, 62, 0.3)', borderRadius: '10px', padding: '0.75rem 1.25rem', color: '#f5c43e', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <strong>★ VISTA DE DEMOSTRACIÓN PARA CLIENTE:</strong> Mostrando balance en vivo ($14,850.4500000000 USD), fondos retenidos en Escrow, desglose de Spotify/Apple Music/TikTok y libro mayor auditado.
        </div>
      )}

      <IsolatedModuleBoundary
        moduleId="mod-royalty-balance-and-payout"
        moduleTitle="Billetera DECIMAL(18, 10), Reclamo de Escrow y Solicitud de Retiro"
      >
        <RoyaltyBalanceAndPayoutCardView
          dashboard={dashboard}
          loading={loading}
          errorMessage={errorMessage}
          statusMessage={statusMessage}
          onRequestPayout={requestPayout}
          onClaimEscrow={claimPendingEscrowSplits}
        />
      </IsolatedModuleBoundary>

      <IsolatedModuleBoundary
        moduleId="mod-dsp-streaming-analytics"
        moduleTitle="Analíticas de Streaming y Liquidación por Tienda DSP"
      >
        <EscrowSplitsAndDspAnalyticsCardView dashboard={dashboard} />
      </IsolatedModuleBoundary>

      <IsolatedModuleBoundary
        moduleId="mod-immutable-royalty-ledger-table"
        moduleTitle="Libro Mayor Inmutable (Royalty Ledger Audit Trail)"
      >
        <ImmutableLedgerHistoryTableView dashboard={dashboard} />
      </IsolatedModuleBoundary>
    </main>
  );
}
