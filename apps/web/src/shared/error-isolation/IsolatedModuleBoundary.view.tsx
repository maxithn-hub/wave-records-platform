'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

export interface IsolatedModuleBoundaryProps {
  readonly moduleId: string;
  readonly moduleTitle: string;
  readonly children: ReactNode;
}

interface IsolatedModuleBoundaryState {
  readonly hasFault: boolean;
  readonly errorMessage: string | null;
  readonly faultTimestamp: string | null;
  readonly resetCount: number;
}

/**
 * Bulkhead Fault-Isolation Boundary for UI Modules.
 * Guarantees that if any child hook, chart, uploader, or form throws a runtime
 * error, the crash is trapped strictly within this module box without taking down
 * the global application shell or sibling modules.
 */
export class IsolatedModuleBoundary extends Component<
  IsolatedModuleBoundaryProps,
  IsolatedModuleBoundaryState
> {
  public override state: IsolatedModuleBoundaryState = {
    hasFault: false,
    errorMessage: null,
    faultTimestamp: null,
    resetCount: 0,
  };

  public static getDerivedStateFromError(error: unknown): Partial<IsolatedModuleBoundaryState> {
    return {
      hasFault: true,
      errorMessage:
        error instanceof Error ? error.message : 'Excepción desconocida en módulo de interfaz',
      faultTimestamp: new Date().toISOString(),
    };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      `[WAVE-FAULT-ISOLATION] Módulo "${this.props.moduleId}" contenido exitosamente:`,
      error.message,
      errorInfo.componentStack,
    );
  }

  private readonly handleRecoverModule = (): void => {
    this.setState((prev) => ({
      hasFault: false,
      errorMessage: null,
      faultTimestamp: null,
      resetCount: prev.resetCount + 1,
    }));
  };

  public override render(): ReactNode {
    if (this.state.hasFault) {
      return (
        <section
          role="alert"
          aria-live="assertive"
          className="wave-fault-card"
        >
          <div className="wave-fault-header">
            <span className="wave-badge-danger">FALLO AISLADO (BULKHEAD ACTIVO)</span>
            <code className="wave-code-tag">{this.props.moduleId}</code>
          </div>
          <h3 className="wave-fault-title">
            El módulo «{this.props.moduleTitle}» fue contenido
          </h3>
          <p className="wave-fault-desc">
            Se detectó una excepción interna en este componente y fue bloqueada antes de afectar el
            resto de la plataforma Wave Records.
          </p>
          <pre className="wave-fault-log">{this.state.errorMessage}</pre>
          <div className="wave-fault-actions">
            <button
              type="button"
              onClick={this.handleRecoverModule}
              className="wave-btn-recover"
            >
              Reiniciar solo este módulo
            </button>
            <span className="wave-fault-meta">
              Aislado: {this.state.faultTimestamp}
            </span>
          </div>
        </section>
      );
    }

    return (
      <div key={this.state.resetCount} className="wave-module-wrapper">
        {this.props.children}
      </div>
    );
  }
}
