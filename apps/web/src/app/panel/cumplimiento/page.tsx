'use client';

import React from 'react';
import { IsolatedModuleBoundary } from '../../../shared/error-isolation/IsolatedModuleBoundary.view';
import { useWaveSession } from '../../../shared/session/SessionProvider.view';
import { useShowcaseMode } from '../../../shared/showcase/ShowcaseModeProvider.view';
import { useComplianceCenter } from '../../../features/kyc-tax/hooks/useComplianceCenter.hook';
import { ComplianceStatusBannerView } from '../../../features/kyc-tax/components/ComplianceStatusBanner.view';
import { KycUploadCardView } from '../../../features/kyc-tax/components/KycUploadCard.view';
import { TaxWizardSelectorView } from '../../../features/kyc-tax/components/TaxWizardSelector.view';

export default function CumplimientoPage(): React.JSX.Element {
  const { currentUser, isLoadingSession } = useWaveSession();
  const { isShowcaseMode } = useShowcaseMode();
  const { status, isLoading, errorMessage, reloadStatus } = useComplianceCenter();

  if (isLoadingSession || isLoading) {
    return <p className="wave-status-detail">Cargando centro de cumplimiento...</p>;
  }

  if (!currentUser && !isShowcaseMode) {
    return (
      <article className="wave-card">
        <h2 className="wave-card-title">Sesión Requerida</h2>
        <p className="wave-card-subtitle">
          Inicia sesión o registra un Tenant para completar la verificación KYC y el formulario
          fiscal IRS (W-9 / W-8BEN / W-8BEN-E).
        </p>
      </article>
    );
  }

  const effectiveCountry = currentUser?.tenant.countryCode ?? 'CO';

  return (
    <div className="wave-grid">
      {!currentUser && isShowcaseMode && (
        <div style={{ gridColumn: '1 / -1', background: 'rgba(245, 196, 62, 0.1)', border: '1px solid rgba(245, 196, 62, 0.3)', borderRadius: '10px', padding: '0.75rem 1.25rem', color: '#f5c43e', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <strong>★ VISTA DE DEMOSTRACIÓN PARA CLIENTE:</strong> Expediente de cumplimiento verificado (KYC Aprobado + Formulario Fiscal IRS W-8BEN Validado con Tratado de Doble Tributación 0%).
        </div>
      )}
      {errorMessage && <div className="wave-inline-error">{errorMessage}</div>}

      {status && (
        <div style={{ gridColumn: '1 / -1' }}>
          <IsolatedModuleBoundary
            moduleId="mod-compliance-status-banner"
            moduleTitle="Estado de Habilitación Financiera y Cumplimiento"
          >
            <ComplianceStatusBannerView status={status} />
          </IsolatedModuleBoundary>
        </div>
      )}

      <IsolatedModuleBoundary
        moduleId="mod-kyc-document-uploader"
        moduleTitle="Verificación de Identidad (KYC)"
      >
        <KycUploadCardView onSubmitted={reloadStatus} />
      </IsolatedModuleBoundary>

      {status && (
        <IsolatedModuleBoundary
          moduleId="mod-irs-tax-wizard"
          moduleTitle={`Declaración Fiscal IRS (${status.requiredTaxForm})`}
        >
          <TaxWizardSelectorView
            requiredForm={status.requiredTaxForm}
            countryCode={effectiveCountry}
            onSubmitted={reloadStatus}
          />
        </IsolatedModuleBoundary>
      )}
    </div>
  );
}
