'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ComplianceStatusDto } from '@wave/contracts';
import { useWaveSession } from '../../../shared/session/SessionProvider.view';
import { useShowcaseMode } from '../../../shared/showcase/ShowcaseModeProvider.view';
import { SHOWCASE_COMPLIANCE_STATUS } from '../../../shared/showcase/showcase-demo.data';

export function useComplianceCenter() {
  const { accessToken, refreshSession } = useWaveSession();
  const { isShowcaseMode } = useShowcaseMode();
  const [status, setStatus] = useState<ComplianceStatusDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reloadStatus = useCallback(async (): Promise<void> => {
    let token = accessToken;
    if (!token) {
      token = await refreshSession();
    }

    if (!token) {
      if (isShowcaseMode) {
        setStatus(SHOWCASE_COMPLIANCE_STATUS);
      } else {
        setStatus(null);
      }
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/compliance/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as {
        ok: boolean;
        value?: ComplianceStatusDto;
        error?: { message: string };
      };

      if (!res.ok || !body.ok || !body.value) {
        if (isShowcaseMode) {
          setStatus(SHOWCASE_COMPLIANCE_STATUS);
        } else {
          setErrorMessage(body.error?.message ?? 'No se pudo cargar el estado de cumplimiento.');
        }
        return;
      }

      setStatus(body.value);
    } catch {
      if (isShowcaseMode) {
        setStatus(SHOWCASE_COMPLIANCE_STATUS);
      } else {
        setErrorMessage('Error de red al consultar estado KYC/Fiscal.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, refreshSession, isShowcaseMode]);

  useEffect(() => {
    void reloadStatus();
  }, [reloadStatus]);

  return {
    status,
    isLoading,
    errorMessage,
    reloadStatus,
  };
}
