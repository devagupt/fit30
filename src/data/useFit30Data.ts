import { useCallback, useEffect, useRef, useState } from 'react';
import { recoverOpenWorkout } from '../domain/workout';
import { DataConflictError, readData, updateData, type DataSnapshot, type DataUpdate } from './storage';

interface CommitOptions {
  latest?: boolean;
  quiet?: boolean;
}

export function useFit30Data() {
  const [snapshot, setSnapshot] = useState<DataSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const mounted = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);

  const adoptSnapshot = useCallback((next: DataSnapshot) => {
    if (!mounted.current) return;

    setSnapshot((previous) => previous && previous.revision >= next.revision ? previous : next);
  }, []);

  const load = useCallback(async (showErrors: boolean, restoreWorkout = false) => {
    try {
      let recovered = false;
      const latest = restoreWorkout ? await updateData((current) => {
        const restored = recoverOpenWorkout(current);
        recovered = restored !== current;
        return restored;
      }) : await readData();
      adoptSnapshot(latest);
      if (recovered) channel.current?.postMessage('progress-changed');
      if (showErrors && mounted.current) setError(null);
    } catch (cause) {
      if (showErrors && mounted.current) {
        setError(cause instanceof Error ? cause.message : 'Fit30 couldn’t open your saved progress.');
      }
    }
  }, [adoptSnapshot]);

  useEffect(() => {
    mounted.current = true;
    let opening = true;
    void load(true, true).finally(() => { opening = false; });

    function handleFocus() {
      if (!opening && document.visibilityState === 'visible') void load(false);
    }

    try {
      channel.current = new BroadcastChannel('fit30:progress');
      channel.current.onmessage = () => { if (!opening) void load(false); };
    } catch {
      // Visibility changes and revision checks still synchronize saved progress.
    }

    document.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('focus', handleFocus);
    return () => {
      mounted.current = false;
      channel.current?.close();
      channel.current = null;
      document.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('focus', handleFocus);
    };
  }, [load]);

  const commit = useCallback(async (update: DataUpdate, options: CommitOptions = {}) => {
    if (!snapshot) return false;
    if (!options.quiet) {
      setPending((count) => count + 1);
      setError(null);
    }

    try {
      const latest = await updateData(update, options.latest ? undefined : snapshot.revision);
      adoptSnapshot(latest);
      if (latest.revision !== snapshot.revision) channel.current?.postMessage('progress-changed');
      return true;
    } catch (cause) {
      if (cause instanceof DataConflictError) adoptSnapshot(cause.snapshot);
      if (!options.quiet && mounted.current) {
        setError(cause instanceof Error ? cause.message : 'Fit30 couldn’t save your change. Try again.');
      }
      return false;
    } finally {
      if (!options.quiet && mounted.current) setPending((count) => count - 1);
    }
  }, [adoptSnapshot, snapshot]);

  const reload = useCallback(() => load(true, true), [load]);

  return {
    data: snapshot?.data ?? null,
    revision: snapshot?.revision ?? null,
    error,
    isSaving: pending > 0,
    commit,
    reload,
  };
}
