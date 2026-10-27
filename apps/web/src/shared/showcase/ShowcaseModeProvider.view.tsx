'use client';

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface ShowcaseModeContextValue {
  readonly isShowcaseMode: boolean;
  readonly toggleShowcaseMode: () => void;
  readonly setShowcaseMode: (enabled: boolean) => void;
}

const ShowcaseModeContext = createContext<ShowcaseModeContextValue>({
  isShowcaseMode: true,
  toggleShowcaseMode: () => {},
  setShowcaseMode: () => {},
});

export function ShowcaseModeProvider({
  children,
}: {
  readonly children: ReactNode;
}): React.JSX.Element {
  const [isShowcaseMode, setIsShowcaseMode] = useState<boolean>(true);

  // Initialize from localStorage if present
  useEffect(() => {
    try {
      const stored = localStorage.getItem('wave_showcase_mode');
      if (stored !== null) {
        setIsShowcaseMode(stored === 'true');
      }
    } catch {
      // Local storage unavailable
    }
  }, []);

  const setShowcaseMode = (enabled: boolean) => {
    setIsShowcaseMode(enabled);
    try {
      localStorage.setItem('wave_showcase_mode', String(enabled));
    } catch {
      // Ignore
    }
  };

  const toggleShowcaseMode = () => {
    setShowcaseMode(!isShowcaseMode);
  };

  return (
    <ShowcaseModeContext.Provider
      value={{
        isShowcaseMode,
        toggleShowcaseMode,
        setShowcaseMode,
      }}
    >
      {children}
    </ShowcaseModeContext.Provider>
  );
}

export function useShowcaseMode(): ShowcaseModeContextValue {
  return useContext(ShowcaseModeContext);
}
