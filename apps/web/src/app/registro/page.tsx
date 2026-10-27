'use client';

import React from 'react';
import { IsolatedModuleBoundary } from '../../shared/error-isolation/IsolatedModuleBoundary.view';
import { RegisterFormView } from '../../features/auth-onboarding/components/RegisterForm.view';

export default function RegistroPage(): React.JSX.Element {
  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>
      <IsolatedModuleBoundary
        moduleId="mod-auth-register-page"
        moduleTitle="Onboarding Multi-Tenant (Launch / Growth)"
      >
        <RegisterFormView />
      </IsolatedModuleBoundary>
    </div>
  );
}
