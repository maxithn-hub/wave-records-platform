'use client';

import React from 'react';
import type { RoyaltyDashboardSummary } from '@wave/contracts';

export function EscrowSplitsAndDspAnalyticsCardView({
  dashboard,
}: {
  readonly dashboard: RoyaltyDashboardSummary | null;
}): React.JSX.Element {
  const dspRows = dashboard?.dspBreakdown ?? [];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-6 shadow-xl">
      <div className="mb-3">
        <span className="inline-block rounded bg-cyan-500/15 px-2.5 py-0.5 text-xs font-semibold text-cyan-300">
          Analíticas de Streaming & Liquidación por DSP
        </span>
        <h3 className="mt-1 text-base font-bold text-slate-100">
          Desglose de Regalías Brutas vs. Distribuibles (Post-Comisión Wave Records LLC)
        </h3>
      </div>

      {dspRows.length === 0 ? (
        <p className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400">
          Aún no hay liquidaciones de DSP registradas para este Tenant.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-200">
            <thead className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
              <tr>
                <th className="py-2 pr-4">Tienda DSP</th>
                <th className="py-2 pr-4">Streams Verificados</th>
                <th className="py-2 pr-4">Ingreso Bruto (USD)</th>
                <th className="py-2">Neto Distribuible a Splits (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 font-mono">
              {dspRows.map((row) => (
                <tr key={row.dspStore}>
                  <td className="py-2.5 pr-4 font-bold text-cyan-300">{row.dspStore}</td>
                  <td className="py-2.5 pr-4">{row.streamsCount.toLocaleString('en-US')}</td>
                  <td className="py-2.5 pr-4">${row.grossRevenueUsd}</td>
                  <td className="py-2.5 text-emerald-400">${row.netDistributableUsd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
