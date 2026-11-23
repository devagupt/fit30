import { useEffect, useEffectEvent, useState } from 'react';
import type { Fit30Data } from '../../domain/model';
import { reminderScheduleKey } from '../../domain/reminders';
import { isPhoneApp, syncDeviceReminders, type DeviceReminderStatus } from './deviceReminders';

export function useDeviceReminders(data: Fit30Data | null) {
  const [status, setStatus] = useState<DeviceReminderStatus>({ kind: 'checking' });
  const [attempt, setAttempt] = useState(0);
  const readData = useEffectEvent(() => data);
  const key = isPhoneApp && data ? reminderScheduleKey(data) : null;

  useEffect(() => {
    if (key === null) return;
    let active = true;

    function refresh() {
      if (document.visibilityState !== 'visible') return;
      const snapshot = readData();
      if (!snapshot) return;
      setStatus({ kind: 'checking' });
      void syncDeviceReminders(snapshot).then(
        (next) => { if (active) setStatus(next); },
        () => { if (active) setStatus({ kind: 'error' }); },
      );
    }

    refresh();
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [attempt, key]);

  return { status, refresh: () => setAttempt((previous) => previous + 1) };
}
