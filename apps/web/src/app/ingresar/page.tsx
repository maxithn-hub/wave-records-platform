'use client';

import React from 'react';
import { IsolatedModuleBoundary } from '../../shared/error-isolation/IsolatedModuleBoundary.view';
import { LoginFormView } from '../../features/auth-onboarding/components/LoginForm.view';

export default function IngresarPage(): React.JSX.Element {
  return (
    <div style={{ maxWidth: '580px', margin: '0 auto' }}>
      <IsolatedModuleBoundary
        moduleId="mod-auth-login-page"
        moduleTitle="Autenticación Segura Wave Records"
      >
        <LoginFormView />
      </IsolatedModuleBoundary>
    </div>
  );
}
