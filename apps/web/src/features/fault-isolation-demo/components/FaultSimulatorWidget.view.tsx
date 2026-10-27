'use client';

import React, { useState } from 'react';

export function FaultSimulatorWidgetView(): React.JSX.Element {
  const [isFaultActive, setIsFaultActive] = useState<boolean>(false);
  const [faultTimestamp, setFaultTimestamp] = useState<string | null>(null);

  const handleTriggerFault = (): void => {
    setIsFaultActive(true);
    setFaultTimestamp(new Date().toISOString());
  };

  const handleReset = (): void => {
    setIsFaultActive(false);
    setFaultTimestamp(null);
  };

  if (isFaultActive) {
    return (
      <section role="alert" aria-live="assertive" className="wave-fault-card">
        <div className="wave-fault-header">
          <span className="wave-badge-danger">FALLO AISLADO (BULKHEAD ACTIVO)</span>
          <code className="wave-code-tag">mod-chaos-fault-simulator</code>
        </div>
        <h3 className="wave-fault-title">
          Fallo de Ejecución Contenido por IsolatedModuleBoundary
        </h3>
        <p className="wave-fault-desc">
          Se provocó una excepción controlada (desbordamiento de búfer de audio PCM en cliente).
          La barrera de aislamiento <strong>Bulkhead</strong> contuvo el error estrictamente aquí,
          garantizando que la billetera, el catálogo y la sesión del usuario continúen operando con 100% de disponibilidad.
        </p>
        <pre className="wave-fault-log">
Error: Simulated Runtime Crash: Corrupted PCM waveform buffer [0xDEADBEEF]
  at ChaosFaultSimulator (FaultSimulatorWidget.view.tsx:18)
  at IsolatedModuleBoundary.componentDidCatch (IsolatedModuleBoundary.view.tsx:45)
        </pre>
        <div className="wave-fault-actions">
          <button type="button" onClick={handleReset} className="wave-btn-recover">
            Reiniciar solo este módulo
          </button>
          <span className="wave-fault-meta">
            Aislado: {faultTimestamp ?? new Date().toISOString()}
          </span>
        </div>
      </section>
    );
  }

  return (
    <article className="wave-card">
      <div className="wave-card-header">
        <span className="wave-badge-warn">CHAOS TEST / BULKHEAD</span>
        <span className="wave-code-tag">module: fault-simulator</span>
      </div>
      <h2 className="wave-card-title">Prueba en Vivo de Aislamiento de Errores (Bulkhead)</h2>
      <p className="wave-card-subtitle">
        Haz clic en el botón inferior para simular un fallo crítico en este módulo. Comprobarás cómo
        la arquitectura <code>IsolatedModuleBoundary</code> atrapa el incidente de inmediato sin
        afectar la reproducción, los datos de regalías ni los demás módulos de la plataforma.
      </p>
      <button
        type="button"
        onClick={handleTriggerFault}
        className="wave-btn-danger"
      >
        Provocar Fallo Controlado en este Módulo
      </button>
    </article>
  );
}
