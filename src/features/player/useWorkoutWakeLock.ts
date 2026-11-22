import { useEffect } from 'react';

export function useWorkoutWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !navigator.wakeLock) return;

    let disposed = false;
    let requesting = false;
    let lock: WakeLockSentinel | undefined;

    const release = () => {
      const held = lock;
      lock = undefined;
      if (held && !held.released) void held.release().catch(() => {});
    };

    const sync = async () => {
      if (document.visibilityState !== 'visible') {
        release();
        return;
      }
      if (requesting || (lock && !lock.released)) return;

      requesting = true;
      try {
        const requested = await navigator.wakeLock.request('screen');
        if (disposed || document.visibilityState !== 'visible') await requested.release();
        else lock = requested;
      } catch {
        // The OS may decline a wake lock, for example in battery saver mode.
      } finally {
        requesting = false;
      }
    };

    const onVisibility = () => { void sync(); };
    document.addEventListener('visibilitychange', onVisibility);
    void sync();

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      release();
    };
  }, [active]);
}
