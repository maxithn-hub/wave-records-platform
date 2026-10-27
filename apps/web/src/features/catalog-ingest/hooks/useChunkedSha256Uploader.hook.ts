'use client';

import { useState, useCallback } from 'react';
import type { QuarantineAssetKind } from '@wave/contracts';
import { useWaveSession } from '../../../shared/session/SessionProvider.view';

const CHUNK_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB chunks

async function computeBrowserSha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const byteArray = Array.from(new Uint8Array(digest));
  return byteArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function useChunkedSha256Uploader() {
  const { accessToken } = useWaveSession();
  const [isUploading, setIsUploading] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const uploadFileInChunks = useCallback(
    async (params: {
      releaseId: string;
      trackId?: string;
      assetKind: QuarantineAssetKind;
      file: File;
    }): Promise<boolean> => {
      if (!accessToken) {
        setErrorMessage('Sesión expirada. Inicia sesión nuevamente.');
        return false;
      }

      setIsUploading(true);
      setProgressPercent(0);
      setErrorMessage(null);

      try {
        setStatusText('Calculando huella criptográfica SHA-256 local...');
        const expectedSha256Hex = await computeBrowserSha256Hex(params.file);
        const totalParts = Math.max(1, Math.ceil(params.file.size / CHUNK_SIZE_BYTES));

        setStatusText(`Inicializando sesión Multipart (${totalParts} fragmento[s])...`);
        const initRes = await fetch('/api/catalog/uploads/init', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            releaseId: params.releaseId,
            ...(params.trackId ? { trackId: params.trackId } : {}),
            assetKind: params.assetKind,
            fileName: params.file.name,
            expectedByteSize: params.file.size,
            expectedSha256Hex,
            totalParts,
          }),
        });

        const initBody = (await initRes.json()) as {
          ok: boolean;
          value?: { uploadSessionId: string };
          error?: { message: string };
        };

        if (!initRes.ok || !initBody.ok || !initBody.value) {
          setErrorMessage(
            initBody.error?.message ?? 'No se pudo inicializar la subida Multipart.',
          );
          return false;
        }

        const { uploadSessionId } = initBody.value;

        for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
          const start = (partNumber - 1) * CHUNK_SIZE_BYTES;
          const end = Math.min(params.file.size, start + CHUNK_SIZE_BYTES);
          const chunkBlob = params.file.slice(start, end);
          const chunkBuffer = await chunkBlob.arrayBuffer();

          setStatusText(`Subiendo fragmento #${partNumber} de ${totalParts}...`);

          let partUploaded = false;
          for (let attempt = 1; attempt <= 3; attempt++) {
            const partRes = await fetch(
              `/api/catalog/uploads/${uploadSessionId}/part/${partNumber}`,
              {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/octet-stream',
                  Authorization: `Bearer ${accessToken}`,
                },
                body: chunkBuffer,
              },
            );

            if (partRes.ok) {
              partUploaded = true;
              break;
            }
          }

          if (!partUploaded) {
            setErrorMessage(
              `Fallo tras 3 reintentos al subir el fragmento #${partNumber}.`,
            );
            return false;
          }

          setProgressPercent(Math.round((partNumber / totalParts) * 90));
        }

        setStatusText('Verificando integridad SHA-256 y encabezados RIFF/WAVE PCM en servidor...');
        const completeRes = await fetch(
          `/api/catalog/uploads/${uploadSessionId}/complete`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );

        const completeBody = (await completeRes.json()) as {
          ok: boolean;
          value?: { verifiedSha256Hex: string };
          error?: { message: string };
        };

        if (!completeRes.ok || !completeBody.ok) {
          setErrorMessage(
            completeBody.error?.message ??
              'El archivo fue rechazado por la validación técnica en cuarentena.',
          );
          return false;
        }

        setProgressPercent(100);
        setStatusText(
          `Verificado en cuarentena (SHA-256: ${completeBody.value?.verifiedSha256Hex.slice(0, 16)}...)`,
        );
        return true;
      } catch {
        setErrorMessage('Error de red durante la subida por fragmentos.');
        return false;
      } finally {
        setIsUploading(false);
      }
    },
    [accessToken],
  );

  return {
    isUploading,
    progressPercent,
    statusText,
    errorMessage,
    uploadFileInChunks,
  };
}
