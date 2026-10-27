'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWaveSession } from '../../../shared/session/SessionProvider.view';

export function useLogin() {
  const router = useRouter();
  const { setActiveAccessToken } = useWaveSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submitLogin = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const body = (await res.json()) as {
        ok: boolean;
        value?: { accessToken: string };
        error?: { message: string };
      };

      if (!res.ok || !body.ok || !body.value) {
        setErrorMessage(body.error?.message ?? 'Error de autenticación.');
        return;
      }

      await setActiveAccessToken(body.value.accessToken);
      router.push('/panel/cumplimiento');
    } catch {
      setErrorMessage('Error de red al iniciar sesión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    isSubmitting,
    errorMessage,
    submitLogin,
  };
}
