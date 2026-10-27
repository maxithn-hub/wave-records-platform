'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TenantTier } from '@wave/contracts';
import { useWaveSession } from '../../../shared/session/SessionProvider.view';

export function useRegisterTenant() {
  const router = useRouter();
  const { setActiveAccessToken } = useWaveSession();

  const [tier, setTier] = useState<TenantTier>('INDIVIDUAL_LAUNCH');
  const [legalName, setLegalName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [countryCode, setCountryCode] = useState('US');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submitRegistration = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tier,
          legalName,
          displayName,
          countryCode: countryCode.toUpperCase(),
          email,
          password,
          acceptTerms,
        }),
      });

      const body = (await res.json()) as {
        ok: boolean;
        value?: { accessToken: string };
        error?: { message: string };
      };

      if (!res.ok || !body.ok || !body.value) {
        setErrorMessage(body.error?.message ?? 'No se pudo completar el registro.');
        return;
      }

      await setActiveAccessToken(body.value.accessToken);
      router.push('/panel/cumplimiento');
    } catch {
      setErrorMessage('Error de conexión al registrar la cuenta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    tier,
    setTier,
    legalName,
    setLegalName,
    displayName,
    setDisplayName,
    countryCode,
    setCountryCode,
    email,
    setEmail,
    password,
    setPassword,
    acceptTerms,
    setAcceptTerms,
    isSubmitting,
    errorMessage,
    submitRegistration,
  };
}
