import { useEffect } from 'react';

/**
 * Keeps the screen on while a halaqa is open. A phone that dims in the middle
 * of a page is the commonest interruption of reading from one.
 *
 * The browser releases the lock whenever the page is hidden, so it is taken
 * again each time the page comes back. Where the API is missing or refused
 * (an older Safari, a battery saver) the screen simply behaves as usual.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let live = true;
    const take = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          if (live) lock = l;
          else l.release().catch(() => {});
        })
        .catch(() => {});
    };
    take();
    document.addEventListener('visibilitychange', take);
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', take);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
