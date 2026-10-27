'use client';

import { useState, useCallback, useEffect } from 'react';
import type {
  ModerationQueueItem,
  BeatLicenseInspectionSummary,
  RevelatorDeliverySummary,
  ModerationDecisionAction,
} from '@wave/contracts';
import { useWaveSession } from '../../../shared/session/SessionProvider.view';
import { useShowcaseMode } from '../../../shared/showcase/ShowcaseModeProvider.view';
import {
  SHOWCASE_MODERATION_QUEUE,
  SHOWCASE_BEAT_LICENSE_INSPECTION,
} from '../../../shared/showcase/showcase-demo.data';

export function useAdminModerationQueue() {
  const { accessToken } = useWaveSession();
  const { isShowcaseMode } = useShowcaseMode();
  const [items, setItems] = useState<ModerationQueueItem[]>([]);
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null);
  const [inspectedPdf, setInspectedPdf] =
    useState<BeatLicenseInspectionSummary | null>(null);
  const [lastDispatchResult, setLastDispatchResult] =
    useState<RevelatorDeliverySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadQueue = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      if (isShowcaseMode) {
        setItems(SHOWCASE_MODERATION_QUEUE);
        if (!selectedReleaseId && SHOWCASE_MODERATION_QUEUE[0]) {
          setSelectedReleaseId(SHOWCASE_MODERATION_QUEUE[0].releaseId);
        }
      } else {
        setItems([]);
      }
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/admin/moderation/queue', {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = (await res.json()) as {
        ok: boolean;
        value?: ModerationQueueItem[];
        error?: { message: string };
      };

      setLoading(false);
      if (!res.ok || !body.ok || !body.value) {
        if (isShowcaseMode) {
          setItems(SHOWCASE_MODERATION_QUEUE);
          if (!selectedReleaseId && SHOWCASE_MODERATION_QUEUE[0]) {
            setSelectedReleaseId(SHOWCASE_MODERATION_QUEUE[0].releaseId);
          }
        } else {
          setErrorMessage(body.error?.message ?? 'Error al cargar la cola de moderación.');
        }
        return;
      }

      setItems(body.value);
      if (body.value.length > 0 && !selectedReleaseId) {
        const first = body.value[0];
        if (first) setSelectedReleaseId(first.releaseId);
      }
    } catch {
      setLoading(false);
      if (isShowcaseMode) {
        setItems(SHOWCASE_MODERATION_QUEUE);
      } else {
        setErrorMessage('Error de red al consultar la cola de moderación.');
      }
    }
  }, [accessToken, selectedReleaseId, isShowcaseMode]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const inspectBeatLicense = useCallback(
    async (releaseId: string): Promise<void> => {
      if (!accessToken && isShowcaseMode) {
        setLoading(true);
        setTimeout(() => {
          setInspectedPdf(SHOWCASE_BEAT_LICENSE_INSPECTION);
          setLoading(false);
        }, 150);
        return;
      }

      if (!accessToken) {
        setErrorMessage('Inicia sesión como Administrador para descifrar licencias.');
        return;
      }

      setLoading(true);
      setErrorMessage(null);

      try {
        const res = await fetch(
          `/api/admin/moderation/releases/${releaseId}/beat-license`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
        const body = (await res.json()) as {
          ok: boolean;
          value?: BeatLicenseInspectionSummary;
          error?: { message: string };
        };

        setLoading(false);
        if (!res.ok || !body.ok || !body.value) {
          setErrorMessage(
            body.error?.message ?? 'No se pudo descifrar el contrato PDF de licencia.',
          );
          return;
        }

        setInspectedPdf(body.value);
      } catch {
        setLoading(false);
        setErrorMessage('Error de red al descifrar la licencia de Beat.');
      }
    },
    [accessToken, isShowcaseMode],
  );

  const submitModerationDecision = useCallback(
    async (params: {
      releaseId: string;
      decision: ModerationDecisionAction;
      moderationNotes: string;
    }): Promise<void> => {
      if (!accessToken && isShowcaseMode) {
        setLoading(true);
        const simulatedSummary: RevelatorDeliverySummary = {
          deliveryJobId: `job-mock-${Date.now()}`,
          releaseId: params.releaseId,
          releaseStatus: params.decision === 'APPROVE_AND_DISPATCH' ? 'LIVE_ON_DSPS' : 'REJECTED',
          revelatorEnterpriseId: 142981,
          revelatorUserId: 'rev_usr_9a8b7c6d5e4f',
          revelatorPlanType: 'Growth',
          revelatorReleaseId: 782415,
          unpromptedTokenCached: true,
          ugcMonetizationBlocked: true,
          ugcMonetizationPolicy: 'BLOCKED_BEAT_LEASE_GREY_AREA',
          dspTargets: [
            'SPOTIFY',
            'APPLE_MUSIC',
            'AMAZON_MUSIC',
            'DEEZER',
            'TIDAL',
            'YOUTUBE_MUSIC',
            'TIKTOK_MUSIC',
            'META_AUDIO_LIBRARY',
          ],
          deliveryStatus: 'PASSED_QUEUED_FOR_DSPS',
          attemptCount: 1,
          dispatchedAt: new Date().toISOString(),
        };

        setLastDispatchResult(simulatedSummary);
        setItems((prev) =>
          prev.map((item) =>
            item.releaseId === params.releaseId
              ? {
                  ...item,
                  status: params.decision === 'APPROVE_AND_DISPATCH' ? 'LIVE_ON_DSPS' : 'REJECTED',
                  latestDeliveryJob: simulatedSummary,
                }
              : item,
          ),
        );
        setLoading(false);
        return;
      }

      if (!accessToken) {
        setErrorMessage('Inicia sesión como Administrador para moderar lanzamientos.');
        return;
      }

      setLoading(true);
      setErrorMessage(null);

      try {
        const res = await fetch(
          `/api/admin/moderation/releases/${params.releaseId}/decision`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              decision: params.decision,
              moderationNotes: params.moderationNotes,
            }),
          },
        );

        const body = (await res.json()) as {
          ok: boolean;
          value?: RevelatorDeliverySummary;
          error?: { message: string };
        };

        setLoading(false);
        if (!res.ok || !body.ok || !body.value) {
          setErrorMessage(
            body.error?.message ?? 'Error al procesar decisión de moderación.',
          );
          await loadQueue();
          return;
        }

        setLastDispatchResult(body.value);
        await loadQueue();
      } catch {
        setLoading(false);
        setErrorMessage('Error de red al despachar decisión a Revelator.');
      }
    },
    [accessToken, isShowcaseMode, loadQueue],
  );

  const selectedItem =
    items.find((item) => item.releaseId === selectedReleaseId) ?? items[0] ?? null;

  return {
    items,
    selectedItem,
    setSelectedReleaseId,
    inspectedPdf,
    lastDispatchResult,
    loading,
    errorMessage,
    loadQueue,
    inspectBeatLicense,
    submitModerationDecision,
  };
}
