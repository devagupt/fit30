import { useRef, useState } from 'react';
import type { Preferences } from '../../domain/model';
import {
  allowReminderNotifications, isAndroidApp, openExactReminderSettings, type DeviceReminderStatus,
} from './deviceReminders';

type ReminderPreferences = Pick<Preferences, 'remindersEnabled' | 'reminderTime' | 'remindOnRestDays'>;

interface Props {
  preferences: Preferences;
  status: DeviceReminderStatus;
  busy: boolean;
  onSave: (values: ReminderPreferences) => Promise<boolean>;
  refresh: () => void;
}

function reminderMessage(status: DeviceReminderStatus, timezone: string): string {
  switch (status.kind) {
    case 'checking': return 'Checking reminders…';
    case 'permission': return 'Allow Fit30 notifications in your phone settings to receive reminders.';
    case 'empty': return 'There are no upcoming reminders for this program.';
    case 'error': return 'Fit30 couldn’t update your reminders. Try again.';
    case 'off': return '';
    case 'scheduled': {
      const next = new Intl.DateTimeFormat('en-IN', {
        timeZone: timezone, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
      }).format(status.nextAt);
      return `Next reminder on ${next}.`;
    }
  }
}

export function ReminderSettings({ preferences, status, busy, onSave, refresh }: Props) {
  const [timeChange, setTimeChange] = useState<string | null>(null);
  const [recoveryChange, setRecoveryChange] = useState<boolean | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);
  const enabled = preferences.remindersEnabled;
  const time = timeChange ?? preferences.reminderTime ?? '';
  const includeRecovery = recoveryChange ?? preferences.remindOnRestDays;
  const changed = time !== (preferences.reminderTime ?? '') || includeRecovery !== preferences.remindOnRestDays;
  const blocked = status.kind === 'permission';
  const message = reminderMessage(status, preferences.timezone);

  async function save(turnOn: boolean) {
    if (busy || saving.current || (turnOn && !time)) return;
    saving.current = true;
    setWorking(true);
    setError('');
    try {
      if (turnOn && !(await allowReminderNotifications())) {
        setError('Allow Fit30 notifications in your phone settings, then try again.');
        return;
      }
      const saved = await onSave({
        remindersEnabled: turnOn,
        reminderTime: turnOn ? time : preferences.reminderTime,
        remindOnRestDays: turnOn ? includeRecovery : preferences.remindOnRestDays,
      });
      if (saved) {
        setTimeChange(null);
        setRecoveryChange(null);
        refresh();
      }
    } catch {
      setError('Fit30 couldn’t access your notification settings. Try again.');
    } finally {
      saving.current = false;
      setWorking(false);
    }
  }

  async function changePrecision() {
    setError('');
    try {
      await openExactReminderSettings();
      refresh();
    } catch {
      setError('Open your phone’s Alarms & reminders settings to allow precise timing for Fit30.');
    }
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); void save(true); }}>
      <h3>Daily reminders</h3>
      <p>Get a notification on scheduled workout days, even with Fit30 closed.</p>
      <label className="field">
        Daily reminder time
        <input type="time" value={time} disabled={busy || working} required onChange={(event) => {
          setError('');
          setTimeChange(event.target.value);
        }} />
      </label>
      <p className="settings-note">Times use {preferences.timezone}.</p>
      <label className="settings-check">
        <input type="checkbox" checked={includeRecovery} disabled={busy || working}
          onChange={(event) => setRecoveryChange(event.target.checked)} /> Include recovery days
      </label>
      <div className="settings-actions">
        <button type="submit" className="button button-primary" disabled={busy || working || !time || (enabled && !blocked && !changed)}>
          {blocked ? 'Allow notifications' : enabled ? 'Save reminder' : 'Enable reminders'}
        </button>
        {enabled && <button type="button" className="button button-secondary" disabled={busy || working} onClick={() => void save(false)}>Turn off reminders</button>}
      </div>
      {error ? <p className="settings-feedback settings-error" role="alert">{error}</p>
        : message && <p className="settings-feedback" role="status">{message}</p>}
      {status.kind === 'error' && <button type="button" className="button button-secondary" onClick={refresh}>Retry scheduling</button>}
      {isAndroidApp && status.kind === 'scheduled' && !status.exact && (
        <div className="settings-subsection">
          <p>Your phone may deliver reminders after the selected time.</p>
          <button type="button" className="button button-secondary" onClick={() => void changePrecision()}>Allow precise timing</button>
        </div>
      )}
    </form>
  );
}
