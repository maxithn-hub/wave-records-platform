import React, { type ReactNode } from 'react';
import './globals.css';
import { SessionProvider } from '../shared/session/SessionProvider.view';
import { ShowcaseModeProvider } from '../shared/showcase/ShowcaseModeProvider.view';
import { WaveTopNavView } from '../shared/navigation/WaveTopNav.view';
import { WaveSplashScreenView } from '../shared/splash/WaveSplashScreen.view';

export const metadata = {
  title: 'Wave Records LLC | Distribution & Royalty Operations Center',
  description:
    'B2B/B2C White-Label Music Distribution Platform with Fault-Isolated Modular Architecture',
};

export default function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}): React.JSX.Element {
  return (
    <html lang="es">
      <body>
        <WaveSplashScreenView />
        <SessionProvider>
          <ShowcaseModeProvider>
            <div className="wave-shell">
              <WaveTopNavView />
              {children}
            </div>
          </ShowcaseModeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
