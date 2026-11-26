import { useEffect, useState } from 'react';

export function SplashScreen() {
  const skipImmediate =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [fading, setFading] = useState(false);
  const [removed, setRemoved] = useState(skipImmediate);

  useEffect(() => {
    if (skipImmediate) return;
    const fadeTimer = window.setTimeout(() => setFading(true), 1700);
    const removeTimer = window.setTimeout(() => setRemoved(true), 2100);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, [skipImmediate]);

  if (removed) return null;

  return (
    <div id="splash-screen" className={fading ? 'fading' : ''}>
      <div className="zikcode-wrap">
        <span className="zik-part">Zik</span>
        <span className="code-part">Code</span>
      </div>
    </div>
  );
}
