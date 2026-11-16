import { useCallback, useState } from 'react';
import { AppShell } from './app/AppShell';
import { LogoSplash } from './components/brand/LogoSplash';

/**
 * Composition root. The logo splash plays first on every full page
 * load (about 7 s, tap/click or Escape to skip, skipped for reduced
 * motion, never blocking), then the app underneath — landing page,
 * sign-in, dashboard, or the public student submission — takes over.
 */
export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashDone = useCallback(() => setSplashDone(true), []);

  return (
    <>
      {!splashDone ? <LogoSplash onDone={handleSplashDone} /> : null}
      <AppShell />
    </>
  );
}
