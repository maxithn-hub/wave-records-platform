'use client';

import React from 'react';
import { IsolatedModuleBoundary } from '../../../shared/error-isolation/IsolatedModuleBoundary.view';
import { ComplianceQueueTableView } from '../../../features/admin-compliance/components/ComplianceQueueTable.view';

export default function AdminCumplimientoPage(): React.JSX.Element {
  return (
    <div>
      <IsolatedModuleBoundary
        moduleId="mod-admin-compliance-backoffice"
        moduleTitle="Backoffice de Cumplimiento Legal y Fiscal (Admin)"
      >
        <ComplianceQueueTableView />
      </IsolatedModuleBoundary>
    </div>
  );
}
