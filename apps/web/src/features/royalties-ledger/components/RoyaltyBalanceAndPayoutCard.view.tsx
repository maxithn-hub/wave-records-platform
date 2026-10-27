'use client';

import React, { useState } from 'react';
import type { RoyaltyDashboardSummary } from '@wave/contracts';

export interface RoyaltyBalanceAndPayoutCardProps {
  readonly dashboard: RoyaltyDashboardSummary | null;
  readonly loading: boolean;
  readonly errorMessage: string | null;
  readonly statusMessage: string | null;
  readonly onRequestPayout: (params: {
    requestedAmountUsd: string;
    idempotencyKey: string;
  }) => Promise<void>;
  readonly onClaimEscrow: () => Promise<void>;
}

export function RoyaltyBalanceAndPayoutCardView({
  dashboard,
  loading,
  errorMessage,
  statusMessage,
  onRequestPayout,
  onClaimEscrow,
}: RoyaltyBalanceAndPayoutCardProps): React.JSX.Element {
  const [amountInput, setAmountInput] = useState('100.0000000000');
  const [idempotencyKey, setIdempotencyKey] = useState('payout-wave-2026-001');

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-6 shadow-xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="inline-block rounded bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
            Fase 5 · Motor Financiero DECIMAL(18, 10) & Retiros Idempotentes
          </span>
          <h2 className="mt-1 text-lg font-bold text-slate-100">
            Saldo Disponible, Escrow de Colaboradores y Solicitud de Retiro
          </h2>
        </div>
      </div>

      {errorMessage ? (
        <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-950/50 p-3 text-xs text-rose-200">
          {errorMessage}
        </div>
      ) : null}

      {statusMessage ? (
        <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-950/50 p-3 text-xs text-emerald-200">
          {statusMessage}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-4">
          <span className="block text-[11px] uppercase tracking-wider text-slate-400">
            Saldo Disponible (DECIMAL 18,10)
          </span>
          <span className="mt-1 block font-mono text-lg font-bold text-emerald-400">
            ${dashboard?.availableBalanceUsd ?? '0.0000000000'} USD
          </span>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-4">
          <span className="block text-[11px] uppercase tracking-wider text-slate-400">
            Retenido en Escrow (Cuentas Fantasma)
          </span>
          <span className="mt-1 block font-mono text-lg font-bold text-amber-300">
            ${dashboard?.totalEscrowHeldByMyTracksUsd ?? '0.0000000000'} USD
          </span>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-4">
          <span className="block text-[11px] uppercase tracking-wider text-slate-400">
            Escrow Reclamable por Mi Email
          </span>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="font-mono text-lg font-bold text-cyan-300">
              ${dashboard?.claimableEscrowByMyEmailUsd ?? '0.0000000000'} USD
            </span>
            <button
              type="button"
              disabled={loading}
              onClick={() => void onClaimEscrow()}
              className="rounded bg-cyan-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
            >
              Reclamar Escrow
            </button>
          </div>
        </div>
      </div>

      {dashboard && !dashboard.payoutEligible ? (
        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-200">
          <strong>Candado Fiscal/KYC Activo:</strong> Los retiros están bloqueados hasta que tu
          identidad (KYC) y formulario IRS (W-9 / W-8BEN / W-8BEN-E) estén validados:{' '}
          {dashboard.payoutBlockers.join(' · ')}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 border-t border-slate-800 pt-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-slate-300">
            Monto a Retirar (USD DECIMAL 18,10)
          </label>
          <input
            type="text"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-300">
            Idempotency-Key (Anti-Doble Débito)
          </label>
          <input
            type="text"
            value={idempotencyKey}
            onChange={(e) => setIdempotencyKey(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100"
          />
        </div>

        <div className="flex items-end">
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              void onRequestPayout({
                requestedAmountUsd: amountInput,
                idempotencyKey,
              })
            }
            className="w-full rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {loading ? 'Procesando...' : 'Solicitar Retiro con Idempotency-Key'}
          </button>
        </div>
      </div>
    </div>
  );
}
