'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ComplianceQueueItem } from '@wave/contracts';
import { useWaveSession } from '../../../shared/session/SessionProvider.view';

export function useAdminComplianceQueue() {
  const { accessToken, refreshSession } = useWaveSession();
  const [items, setItems] = useState<readonly ComplianceQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadQueue = useCallback(async (): Promise<void> => {
    let token = accessToken;
    if (!token) {
      token = await refreshSession();
    }
    if (!token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/admin/compliance/queue', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as {
        ok: boolean;
        value?: { items: ComplianceQueueItem[] };
        error?: { message: string };
      };

      if (!res.ok || !body.ok || !body.value) {
        setErrorMsg(body.error?.message ?? 'Error al cargar la cola de cumplimiento.');
        return;
      }

      setItems(body.value.items);
    } catch {
      setErrorMsg('Error de red al consultar cola de moderación KYC/Fiscal.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, refreshSession]);

  const submitDecision = async (params: {
    kind: 'KYC' | 'TAX';
    id: string;
    decision: 'APPROVE' | 'REJECT';
    reason?: string;
  }): Promise<void> => {
    if (!accessToken) return;
    const endpoint =
      params.kind === 'KYC'
        ? `/api/admin/compliance/kyc/${params.id}/decision`
        : `/api/admin/compliance/tax/${params.id}/decision`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        decision: params.decision,
        ...(params.reason ? { reason: params.reason } : {}),
      }),
    });

    if (res.ok) {
      await loadQueue();
    } else {
      const body = (await res.json()) as { error?: { message: string } };
      setErrorMsg(body.error?.message ?? 'No se pudo procesar la decisión.');
    }
  };

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  return {
    items,
    isLoading,
    errorMsg,
    loadQueue,
    submitDecision,
  };
}
