'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { MeDto } from '@wave/contracts';

export interface SessionContextValue {
  readonly accessToken: string | null;
  readonly currentUser: MeDto | null;
  readonly isLoadingSession: boolean;
  readonly setActiveAccessToken: (token: string | null) => Promise<void>;
  readonly refreshSession: () => Promise<string | null>;
  readonly logoutSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  children,
}: {
  readonly children: ReactNode;
}): React.JSX.Element {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<MeDto | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);

  const fetchMeProfile = useCallback(async (token: string): Promise<MeDto | null> => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { ok: boolean; value?: MeDto };
      return body.ok && body.value ? body.value : null;
    } catch {
      return null;
    }
  }, []);

  const setActiveAccessToken = useCallback(
    async (token: string | null): Promise<void> => {
      setAccessToken(token);
      if (!token) {
        setCurrentUser(null);
        return;
      }
      const profile = await fetchMeProfile(token);
      setCurrentUser(profile);
    },
    [fetchMeProfile],
  );

  const refreshSession = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        setAccessToken(null);
        setCurrentUser(null);
        return null;
      }
      const body = (await res.json()) as {
        ok: boolean;
        value?: { accessToken: string };
      };
      if (body.ok && body.value?.accessToken) {
        await setActiveAccessToken(body.value.accessToken);
        return body.value.accessToken;
      }
      return null;
    } catch {
      return null;
    }
  }, [setActiveAccessToken]);

  const logoutSession = useCallback(async (): Promise<void> => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => null);
    setAccessToken(null);
    setCurrentUser(null);
  }, []);

  useEffect(() => {
    let active = true;
    refreshSession().finally(() => {
      if (active) setIsLoadingSession(false);
    });
    return () => {
      active = false;
    };
  }, [refreshSession]);

  return (
    <SessionContext.Provider
      value={{
        accessToken,
        currentUser,
        isLoadingSession,
        setActiveAccessToken,
        refreshSession,
        logoutSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useWaveSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useWaveSession debe usarse dentro de <SessionProvider>');
  }
  return ctx;
}
