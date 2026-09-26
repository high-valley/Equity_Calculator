import { useCallback, useEffect, useRef, useState } from 'react';

export const APP_VERSION = __APP_VERSION__;
export const APP_COMMIT = __APP_COMMIT__;

const CHECK_THROTTLE_MS = 60_000;

/*
 * A merge doesn't reach a device right away: GitHub Pages lets browsers cache index.html
 * for up to 10 minutes, and iOS Safari resumes the old page from memory instead of
 * reloading it. So we fetch version.json past every cache and, if the site has a newer
 * build than the one running, offer an update button.
 */

// The update button opens "?v=<new>", a different URL from the plain one the home-screen
// icon opens. Re-fetch the plain URL with cache:"reload" so it doesn't stay stale.
function refreshStartCache(): void {
  const dir = location.pathname.replace(/[^/]*$/, '');
  for (const url of [dir, `${dir}index.html`]) {
    fetch(url, { cache: 'reload' }).catch(() => undefined);
  }
}

function readVersion(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('version' in data)) return null;
  return typeof data.version === 'string' ? data.version : null;
}

export function useUpdateCheck(): { newVersion: string | null; applyUpdate: () => void } {
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const lastCheckRef = useRef(0);

  const check = useCallback(async () => {
    if (import.meta.env.DEV || Date.now() - lastCheckRef.current < CHECK_THROTTLE_MS) return;
    lastCheckRef.current = Date.now();
    try {
      const res = await fetch(`./version.json?check=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const latest = readVersion(await res.json());
      if (latest && latest > APP_VERSION) {
        setNewVersion(latest);
        refreshStartCache();
      }
    } catch {
      // Offline or a transient network error: try again on the next check.
    }
  }, []);

  useEffect(() => {
    if (/[?&]v=/.test(location.search)) {
      history.replaceState(null, '', location.pathname);
      refreshStartCache();
    }
    const timer = setTimeout(() => void check(), 3000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [check]);

  const applyUpdate = useCallback(() => {
    if (newVersion) location.replace(`${location.pathname}?v=${encodeURIComponent(newVersion)}`);
  }, [newVersion]);

  return { newVersion, applyUpdate };
}
