import { useEffect, useState } from 'react';

export function SplashScreen() {
  const [phase, setPhase] = useState<'visible' | 'fading' | 'gone'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return 'gone';
      }
    }
    return 'visible';
  });

  useEffect(() => {
    if (phase === 'gone') return;
    const fadeTimer = window.setTimeout(() => setPhase('fading'), 1700);
    const removeTimer = window.setTimeout(() => setPhase('gone'), 2100);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, [phase]);

  if (phase === 'gone') return null;

  return (
    <div
      id="splash-screen"
      aria-hidden="true"
      style={{ opacity: phase === 'fading' ? 0 : 1 }}
    >
      <div className="zikcode-wrap">
        <span className="zik-part">Zik</span>
        <span className="code-part">Code</span>
      </div>
    </div>
  );
}
