import { useCallback, useEffect, useRef, useState } from 'react';
import { DataConflictError, readData, updateData, type DataSnapshot, type DataUpdate } from './storage';

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

  const load = useCallback(async (showErrors: boolean) => {
    try {
      const latest = await readData();
      adoptSnapshot(latest);
      if (showErrors && mounted.current) setError(null);
    } catch (cause) {
      if (showErrors && mounted.current) {
        setError(cause instanceof Error ? cause.message : 'Fit30 couldn’t open your saved progress.');
      }
    }
  }, [adoptSnapshot]);

  useEffect(() => {
    mounted.current = true;
    void load(true);

    function handleFocus() {
      if (document.visibilityState === 'visible') void load(false);
    }

    try {
      channel.current = new BroadcastChannel('fit30:progress');
      channel.current.onmessage = () => { void load(false); };
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

  const commit = useCallback(async (update: DataUpdate, expectedRevision = snapshot?.revision) => {
    if (expectedRevision === undefined) return false;
    setPending((count) => count + 1);
    setError(null);

    try {
      const latest = await updateData(update, expectedRevision);
      adoptSnapshot(latest);
      if (latest.revision !== expectedRevision) channel.current?.postMessage('progress-changed');
      return true;
    } catch (cause) {
      if (cause instanceof DataConflictError) adoptSnapshot(cause.snapshot);
      if (mounted.current) {
        setError(cause instanceof Error ? cause.message : 'Fit30 couldn’t save your change. Try again.');
      }
      return false;
    } finally {
      if (mounted.current) setPending((count) => count - 1);
    }
  }, [adoptSnapshot, snapshot?.revision]);

  const reload = useCallback(() => load(true), [load]);

  return {
    data: snapshot?.data ?? null,
    revision: snapshot?.revision ?? null,
    error,
    isSaving: pending > 0,
    commit,
    reload,
  };
}
