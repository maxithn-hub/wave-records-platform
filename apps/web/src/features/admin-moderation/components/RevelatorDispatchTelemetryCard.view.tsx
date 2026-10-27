'use client';

import React from 'react';
import type { RevelatorDeliverySummary } from '@wave/contracts';

export interface RevelatorDispatchTelemetryCardProps {
  readonly deliveryJob: RevelatorDeliverySummary | null;
}

export function RevelatorDispatchTelemetryCardView({
  deliveryJob,
}: RevelatorDispatchTelemetryCardProps): React.ReactElement {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-6 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <span className="inline-block rounded bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
            Telemetría Headless · Revelator API V1 + V2
          </span>
          <h3 className="mt-1 text-base font-bold text-slate-100">
            Puente Anti-IDOR, Unprompted Auth (8h Cache) y Tiendas DSP
          </h3>
        </div>
      </div>

      {!deliveryJob ? (
        <p className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400">
          Selecciona un lanzamiento despachado o aprueba uno en la cola para inspeccionar la
          telemetría del puente Headless hacia Revelator V1/V2.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
              <span className="block text-[10px] uppercase text-slate-400">
                Child Enterprise ID (Server-Only)
              </span>
              <span className="font-mono text-sm font-bold text-cyan-300">
                #{deliveryJob.revelatorEnterpriseId} ({deliveryJob.revelatorPlanType})
              </span>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
              <span className="block text-[10px] uppercase text-slate-400">
                Revelator V2 Release ID
              </span>
              <span className="font-mono text-sm font-bold text-emerald-400">
                {deliveryJob.revelatorReleaseId ?? 'N/A'}
              </span>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
              <span className="block text-[10px] uppercase text-slate-400">
                Token V1 Unprompted (8h TTL)
              </span>
              <span className="font-mono text-xs font-semibold text-indigo-300">
                {deliveryJob.unpromptedTokenCached
                  ? 'CACHE HIT (7h50m TTL)'
                  : 'ISSUED FRESH (/partner/account/login)'}
              </span>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
              <span className="block text-[10px] uppercase text-slate-400">
                Política Monetización UGC
              </span>
              <span
                className={`font-mono text-xs font-bold ${
                  deliveryJob.ugcMonetizationBlocked ? 'text-amber-300' : 'text-emerald-300'
                }`}
              >
                {deliveryJob.ugcMonetizationPolicy}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
            <span className="mb-2 block text-xs font-semibold text-slate-300">
              Tiendas y DSPs Incluidos en `/v2/distribution/release/inspectanddistribute` (
              {deliveryJob.dspTargets.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {deliveryJob.dspTargets.map((dsp) => (
                <span
                  key={dsp}
                  className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-slate-200"
                >
                  {dsp}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
