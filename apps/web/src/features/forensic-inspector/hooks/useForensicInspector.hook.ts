'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ForensicScanReportDto } from '@wave/contracts';
import { useWaveSession } from '../../../shared/session/SessionProvider.view';

export function useForensicInspector(
  releaseId: string | null,
  onReleaseStateChanged: () => Promise<void>,
) {
  const { accessToken } = useWaveSession();
  const [report, setReport] = useState<ForensicScanReportDto | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isUploadingLicense, setIsUploadingLicense] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadLatestReport = useCallback(async (): Promise<void> => {
    if (!releaseId || !accessToken) {
      setReport(null);
      return;
    }

    try {
      const res = await fetch(`/api/forensics/releases/${releaseId}/report`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = (await res.json()) as {
        ok: boolean;
        value?: ForensicScanReportDto | null;
      };
      if (res.ok && body.ok) {
        setReport(body.value ?? null);
      }
    } catch {
      // Non-fatal
    }
  }, [releaseId, accessToken]);

  const executeForensicScan = async (simulatedAcrCloudScore: number): Promise<void> => {
    if (!releaseId || !accessToken) return;
    setIsScanning(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/forensics/releases/${releaseId}/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ simulatedAcrCloudScore }),
      });

      const body = (await res.json()) as {
        ok: boolean;
        value?: ForensicScanReportDto;
        error?: { message: string };
      };

      if (!res.ok || !body.ok || !body.value) {
        setErrorMessage(
          body.error?.message ?? 'El lanzamiento fue rechazado por el análisis forense.',
        );
        await onReleaseStateChanged();
        return;
      }

      setReport(body.value);
      await onReleaseStateChanged();
    } catch {
      setErrorMessage('Error de red al ejecutar el pipeline forense.');
    } finally {
      setIsScanning(false);
    }
  };

  const uploadBeatLicensePdf = async (pdfFile: File): Promise<void> => {
    if (!releaseId || !accessToken) return;
    setIsUploadingLicense(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', pdfFile);

      const res = await fetch(`/api/forensics/releases/${releaseId}/license-pdf`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });

      const body = (await res.json()) as {
        ok: boolean;
        error?: { message: string };
      };

      if (!res.ok || !body.ok) {
        setErrorMessage(
          body.error?.message ?? 'No se pudo validar el archivo PDF de licencia.',
        );
        return;
      }

      await loadLatestReport();
      await onReleaseStateChanged();
    } catch {
      setErrorMessage('Error de red al subir licencia PDF.');
    } finally {
      setIsUploadingLicense(false);
    }
  };

  useEffect(() => {
    void loadLatestReport();
  }, [loadLatestReport]);

  return {
    report,
    isScanning,
    isUploadingLicense,
    errorMessage,
    executeForensicScan,
    uploadBeatLicensePdf,
  };
}
