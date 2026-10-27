'use client';

import React from 'react';
import type { RoyaltyDashboardSummary } from '@wave/contracts';

export function ImmutableLedgerHistoryTableView({
  dashboard,
}: {
  readonly dashboard: RoyaltyDashboardSummary | null;
}): React.JSX.Element {
  const entries = dashboard?.recentLedgerEntries ?? [];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-6 shadow-xl">
      <div className="mb-3">
        <span className="inline-block rounded bg-indigo-500/15 px-2.5 py-0.5 text-xs font-semibold text-indigo-300">
          Libro Mayor Inmutable (Append-Only Audit Trail)
        </span>
        <h3 className="mt-1 text-base font-bold text-slate-100">
          Movimientos Contables `DECIMAL(18, 10)` y Llaves de Idempotencia
        </h3>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400">
          No existen movimientos contables registrados aún.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-200">
            <thead className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
              <tr>
                <th className="py-2 pr-3">Tipo</th>
                <th className="py-2 pr-3">Monto (USD)</th>
                <th className="py-2 pr-3">Saldo Acumulado</th>
                <th className="py-2 pr-3">Idempotency-Key</th>
                <th className="py-2">Concepto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="py-2 pr-3 font-mono text-[11px] font-semibold text-indigo-300">
                    {entry.entryType}
                  </td>
                  <td
                    className={`py-2 pr-3 font-mono ${
                      entry.amountUsd.startsWith('-') ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {entry.amountUsd}
                  </td>
                  <td className="py-2 pr-3 font-mono font-bold text-slate-100">
                    ${entry.runningBalance}
                  </td>
                  <td className="py-2 pr-3 font-mono text-[10px] text-slate-400">
                    {entry.idempotencyKey}
                  </td>
                  <td className="py-2 text-slate-300">{entry.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
