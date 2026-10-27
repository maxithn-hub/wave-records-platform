'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CatalogReleaseDetailDto, ReleaseType } from '@wave/contracts';
import { useWaveSession } from '../../../shared/session/SessionProvider.view';
import { useShowcaseMode } from '../../../shared/showcase/ShowcaseModeProvider.view';
import { SHOWCASE_CATALOG_RELEASES } from '../../../shared/showcase/showcase-demo.data';

export function useCatalogManager() {
  const { accessToken, refreshSession } = useWaveSession();
  const { isShowcaseMode } = useShowcaseMode();
  const [releases, setReleases] = useState<readonly CatalogReleaseDetailDto[]>([]);
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadReleases = useCallback(async (): Promise<void> => {
    let token = accessToken;
    if (!token) {
      token = await refreshSession();
    }

    if (!token) {
      if (isShowcaseMode) {
        setReleases(SHOWCASE_CATALOG_RELEASES);
        if (!selectedReleaseId && SHOWCASE_CATALOG_RELEASES[0]) {
          setSelectedReleaseId(SHOWCASE_CATALOG_RELEASES[0].id);
        }
      } else {
        setReleases([]);
      }
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/catalog/releases', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as {
        ok: boolean;
        value?: { releases: CatalogReleaseDetailDto[] };
        error?: { message: string };
      };

      if (!res.ok || !body.ok || !body.value) {
        if (isShowcaseMode) {
          setReleases(SHOWCASE_CATALOG_RELEASES);
          if (!selectedReleaseId && SHOWCASE_CATALOG_RELEASES[0]) {
            setSelectedReleaseId(SHOWCASE_CATALOG_RELEASES[0].id);
          }
        } else {
          setErrorMessage(body.error?.message ?? 'No se pudo cargar el catálogo.');
        }
        return;
      }

      setReleases(body.value.releases);
      if (!selectedReleaseId && body.value.releases[0]) {
        setSelectedReleaseId(body.value.releases[0].id);
      }
    } catch {
      if (isShowcaseMode) {
        setReleases(SHOWCASE_CATALOG_RELEASES);
      } else {
        setErrorMessage('Error de red al consultar catálogo.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, refreshSession, selectedReleaseId, isShowcaseMode]);

  useEffect(() => {
    void loadReleases();
  }, [loadReleases]);

  const createDraft = async (params: {
    title: string;
    primaryArtist: string;
    releaseType: ReleaseType;
    primaryGenre: string;
    upcCode?: string;
    pLineOwner: string;
    cLineOwner: string;
  }): Promise<boolean> => {
    if (!accessToken && isShowcaseMode) {
      const newMock: CatalogReleaseDetailDto = {
        id: 'c0000001-0000-4000-8000-000000000099',
        tenantId: 'a0000001-0000-4000-8000-000000000001',
        title: params.title,
        versionTitle: null,
        primaryArtist: params.primaryArtist,
        releaseType: params.releaseType,
        primaryGenre: params.primaryGenre,
        releaseDateIso: null,
        pLineYear: 2026,
        pLineOwner: params.pLineOwner,
        cLineYear: 2026,
        cLineOwner: params.cLineOwner,
        upcCode: params.upcCode ?? null,
        status: 'DRAFT',
        artworkQuarantineKey: null,
        artworkSha256Hash: null,
        artworkVerified: false,
        isEditable: true,
        createdAt: new Date().toISOString(),
        tracks: [],
      };
      setReleases((prev) => [newMock, ...prev]);
      setSelectedReleaseId(newMock.id);
      return true;
    }

    if (!accessToken) return false;
    setErrorMessage(null);

    const res = await fetch('/api/catalog/releases', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        ...params,
        pLineYear: 2026,
        cLineYear: 2026,
      }),
    });

    const body = (await res.json()) as {
      ok: boolean;
      value?: { releaseId: string };
      error?: { message: string };
    };

    if (!res.ok || !body.ok || !body.value) {
      setErrorMessage(body.error?.message ?? 'Error al crear borrador.');
      return false;
    }

    setSelectedReleaseId(body.value.releaseId);
    await loadReleases();
    return true;
  };

  const upsertTrack = async (params: {
    releaseId: string;
    trackNumber: number;
    title: string;
    primaryArtist: string;
    isrcCode: string;
    isExplicit: boolean;
    isInstrumental: boolean;
  }): Promise<boolean> => {
    if (!accessToken && isShowcaseMode) {
      setReleases((prev) =>
        prev.map((r) => {
          if (r.id !== params.releaseId) return r;
          const updatedTracks = [
            ...r.tracks,
            {
              id: 'd0000001-0000-4000-8000-000000000099',
              trackNumber: params.trackNumber,
              title: params.title,
              versionTitle: null,
              primaryArtist: params.primaryArtist,
              isExplicit: params.isExplicit,
              isInstrumental: params.isInstrumental,
              audioLanguage: 'es',
              isrcCode: params.isrcCode,
              sampleRateHz: 48000,
              bitDepth: 24,
              channels: 2,
              durationSeconds: 180,
              wavQuarantineKey: 'mock.wav',
              wavSha256Hash: 'mock-sha',
            },
          ];
          return { ...r, tracks: updatedTracks };
        }),
      );
      return true;
    }

    if (!accessToken) return false;
    setErrorMessage(null);

    const res = await fetch(`/api/catalog/releases/${params.releaseId}/tracks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        trackNumber: params.trackNumber,
        title: params.title,
        primaryArtist: params.primaryArtist,
        isrcCode: params.isrcCode,
        isExplicit: params.isExplicit,
        isInstrumental: params.isInstrumental,
        audioLanguage: params.isInstrumental ? 'zxx' : 'es',
      }),
    });

    const body = (await res.json()) as {
      ok: boolean;
      value?: { trackId: string };
      error?: { message: string };
    };

    if (!res.ok || !body.ok || !body.value) {
      setErrorMessage(body.error?.message ?? 'Error al actualizar track.');
      return false;
    }

    await loadReleases();
    return true;
  };

  const submitToForensics = async (releaseId: string): Promise<boolean> => {
    if (!accessToken && isShowcaseMode) {
      setReleases((prev) =>
        prev.map((r) =>
          r.id === releaseId ? { ...r, status: 'FORENSIC_PROCESSING' } : r,
        ),
      );
      return true;
    }

    if (!accessToken) return false;
    setErrorMessage(null);

    const res = await fetch(`/api/catalog/releases/${releaseId}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const body = (await res.json()) as {
      ok: boolean;
      error?: { message: string };
    };

    if (!res.ok || !body.ok) {
      setErrorMessage(body.error?.message ?? 'Error al congelar y enviar lanzamiento.');
      return false;
    }

    await loadReleases();
    return true;
  };

  const selectedRelease =
    releases.find((r) => r.id === selectedReleaseId) ?? releases[0] ?? null;

  return {
    releases,
    selectedRelease,
    setSelectedReleaseId,
    isLoading,
    errorMessage,
    loadReleases,
    createDraft,
    upsertTrack,
    submitToForensics,
  };
}
