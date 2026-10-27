'use client';

import { useState, useCallback, useEffect } from 'react';
import type {
  RoyaltyDashboardSummary,
  PayoutRequestDto,
} from '@wave/contracts';
import { useWaveSession } from '../../../shared/session/SessionProvider.view';
import { useShowcaseMode } from '../../../shared/showcase/ShowcaseModeProvider.view';
import { SHOWCASE_ROYALTY_DASHBOARD } from '../../../shared/showcase/showcase-demo.data';

export function useRoyaltyLedger() {
  const { accessToken } = useWaveSession();
  const { isShowcaseMode } = useShowcaseMode();
  const [dashboard, setDashboard] = useState<RoyaltyDashboardSummary | null>(null);
  const [lastPayout, setLastPayout] = useState<PayoutRequestDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadDashboard = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      if (isShowcaseMode) {
        setDashboard(SHOWCASE_ROYALTY_DASHBOARD);
      } else {
        setDashboard(null);
      }
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/royalties/dashboard', {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = (await res.json()) as {
        ok: boolean;
        value?: RoyaltyDashboardSummary;
        error?: { message: string };
      };
      setLoading(false);
      if (!res.ok || !body.ok || !body.value) {
        if (isShowcaseMode) {
          setDashboard(SHOWCASE_ROYALTY_DASHBOARD);
        } else {
          setErrorMessage(body.error?.message ?? 'Error al cargar el Libro Mayor.');
        }
        return;
      }
      setDashboard(body.value);
    } catch {
      setLoading(false);
      if (isShowcaseMode) {
        setDashboard(SHOWCASE_ROYALTY_DASHBOARD);
      } else {
        setErrorMessage('Error de red al consultar el Libro Mayor.');
      }
    }
  }, [accessToken, isShowcaseMode]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const claimPendingEscrowSplits = useCallback(async (): Promise<void> => {
    if (!accessToken && isShowcaseMode) {
      setLoading(true);
      setStatusMessage('Splits activados: 1 · Fondos liberados de Escrow: $750.0000000000 USD (Demostración Cliente)');
      setDashboard((prev) => {
        if (!prev) return prev;
        const currentBal = parseFloat(prev.availableBalanceUsd) + 750;
        return {
          ...prev,
          availableBalanceUsd: currentBal.toFixed(10),
          claimableEscrowByMyEmailUsd: '0.0000000000',
        };
      });
      setLoading(false);
      return;
    }

    if (!accessToken) return;
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/royalties/splits/claim-escrow', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = (await res.json()) as {
        ok: boolean;
        value?: {
          activatedSplitsCount: number;
          releasedEscrowHoldsCount: number;
          totalReleasedUsd: string;
        };
        error?: { message: string };
      };
      setLoading(false);
      if (!res.ok || !body.ok || !body.value) {
        setErrorMessage(body.error?.message ?? 'Error al reclamar fondos en Escrow.');
        return;
      }
      setStatusMessage(
        `Splits activados: ${body.value.activatedSplitsCount} · Fondos liberados de Escrow: $${body.value.totalReleasedUsd} USD`,
      );
      await loadDashboard();
    } catch {
      setLoading(false);
      setErrorMessage('Error de red al reclamar fondos en Escrow.');
    }
  }, [accessToken, isShowcaseMode, loadDashboard]);

  const requestPayout = useCallback(
    async (params: {
      requestedAmountUsd: string;
      idempotencyKey: string;
    }): Promise<void> => {
      if (!accessToken && isShowcaseMode) {
        setLoading(true);
        const reqAmt = parseFloat(params.requestedAmountUsd);
        setDashboard((prev) => {
          if (!prev) return prev;
          const remaining = Math.max(0, parseFloat(prev.availableBalanceUsd) - reqAmt);
          return {
            ...prev,
            availableBalanceUsd: remaining.toFixed(10),
            recentLedgerEntries: [
              {
                id: `led-mock-${Date.now()}`,
                entryType: 'PAYOUT_WITHDRAWAL_DEBIT',
                amountUsd: `-${params.requestedAmountUsd}`,
                runningBalance: remaining.toFixed(10),
                idempotencyKey: params.idempotencyKey,
                description: `Retiro de regalías aprobado en demostración (${params.requestedAmountUsd} USD)`,
                createdAt: new Date().toISOString(),
              },
              ...prev.recentLedgerEntries,
            ],
          };
        });
        setStatusMessage(`Retiro de $${params.requestedAmountUsd} USD simulado con éxito con Idempotency-Key.`);
        setLoading(false);
        return;
      }

      if (!accessToken) return;
      setLoading(true);
      setErrorMessage(null);
      setStatusMessage(null);

      try {
        const res = await fetch('/api/royalties/payouts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            'Idempotency-Key': params.idempotencyKey,
          },
          body: JSON.stringify({
            idempotencyKey: params.idempotencyKey,
            requestedAmountUsd: params.requestedAmountUsd,
          }),
        });
        const body = (await res.json()) as {
          ok: boolean;
          value?: PayoutRequestDto;
          error?: { message: string };
        };
        setLoading(false);
        if (!res.ok || !body.ok || !body.value) {
          setErrorMessage(
            body.error?.message ?? 'Retiro bloqueado o fondos insuficientes.',
          );
          return;
        }
        setLastPayout(body.value);
        setStatusMessage(
          body.value.idempotentReplay
            ? `Replay Idempotente detectado (${body.value.idempotencyKey}): no se duplicó el débito.`
            : `Retiro de $${body.value.requestedAmount} USD aprobado. Saldo restante: $${body.value.remainingBalanceUsd} USD.`,
        );
        await loadDashboard();
      } catch {
        setLoading(false);
        setErrorMessage('Error de red al procesar el retiro de regalías.');
      }
    },
    [accessToken, isShowcaseMode, loadDashboard],
  );

  return {
    dashboard,
    lastPayout,
    loading,
    errorMessage,
    statusMessage,
    loadDashboard,
    claimPendingEscrowSplits,
    requestPayout,
  };
}
