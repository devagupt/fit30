import { useRef, useState, type FormEvent } from 'react';
import { Bell, CalendarDays, Download, HardDrive, Smartphone } from 'lucide-react';
import { serializeBackup } from '../../data/backup';
import { createCalendarExport, downloadText, measurementsCsv, workoutsCsv } from '../../data/exports';
import type { DataUpdate } from '../../data/storage';
import { isProgramStartDate, localDate } from '../../domain/dates';
import { type Fit30Data, type Preferences, type ProgramRun, preferencesSchema } from '../../domain/model';
import { startProgram } from '../../domain/workout';
import { Dialog } from '../../ui/Dialog';
import type { OfflineStatus } from '../../ui/useConnection';
import { BackupRestore } from './BackupRestore';
import './settings.css';

interface SettingsScreenProps {
  data: Fit30Data;
  run: ProgramRun;
  offlineStatus: OfflineStatus;
  appInstalled: boolean;
  onInstall?: () => void;
  onRetryOffline?: () => void;
  onSave: (update: DataUpdate) => Promise<boolean>;
  busy: boolean;
}

type Feedback = { text: string; error?: boolean };

const suggestedTimezones = [...new Set([
  'Asia/Kolkata', 'UTC', 'America/New_York', 'America/Los_Angeles', 'Asia/Singapore', 'Australia/Sydney', 'Europe/London',
  ...(typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []),
])];

const offlineCopy: Record<OfflineStatus, string> = {
  ready: 'Ready for offline workouts',
  preparing: 'Preparing Fit30 for offline use…',
  setup_failed: 'Offline setup couldn’t finish. Connect to the preview and try again.',
  unavailable: 'Open the production preview through Android USB setup or at a trusted HTTPS address to prepare for offline use.',
};

function FeedbackLine({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) return null;
  return <p className={`settings-feedback${feedback.error ? ' settings-error' : ''}`} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>;
}

function hasRunRecords(data: Fit30Data, id: string): boolean {
  return data.sessions.some((session) => session.programRunId === id) || data.measurements.some((measurement) => measurement.programRunId === id);
}

function setPreferences(data: Fit30Data, runId: string, preferences: Preferences): Fit30Data {
  if (data.activeRunId !== runId) throw new Error('Your active program changed. Open Settings again and retry.');
  return {
    ...data,
    preferences,
    runs: data.runs.map((run) => run.id === runId && run.timezone !== preferences.timezone ? { ...run, timezone: preferences.timezone } : run),
  };
}

export function SettingsScreen({ data, run, offlineStatus, appInstalled, onInstall, onRetryOffline, onSave, busy }: SettingsScreenProps) {
  const [preferenceChanges, setPreferenceChanges] = useState<Partial<Preferences>>({});
  const [startDateChange, setStartDateChange] = useState<string | null>(null);
  const [settingsFeedback, setSettingsFeedback] = useState<Feedback | null>(null);
  const [calendarFeedback, setCalendarFeedback] = useState<Feedback | null>(null);
  const [scheduleFeedback, setScheduleFeedback] = useState<Feedback | null>(null);
  const [exportFeedback, setExportFeedback] = useState<Feedback | null>(null);
  const [restartDate, setRestartDate] = useState<string | null>(null);
  const [restartError, setRestartError] = useState('');
  const saving = useRef(false);
  const fields = { ...data.preferences, ...preferenceChanges };
  const startDate = startDateChange ?? run.startDate;
  const lockedDate = hasRunRecords(data, run.id);
  const preferencesChanged = Object.keys(preferenceChanges).length > 0;

  function changePreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPreferenceChanges((changes) => ({ ...changes, [key]: value }));
    setSettingsFeedback(null);
    setCalendarFeedback(null);
  }

  function readPreferences(): Preferences | null {
    const result = preferencesSchema.safeParse({ ...fields, timezone: fields.timezone.trim() });
    return result.success ? result.data : null;
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || saving.current) return;
    const preferences = readPreferences();
    if (!preferences) {
      setSettingsFeedback({ text: 'Choose a valid time zone, such as Asia/Kolkata, and check your reminder time.', error: true });
      return;
    }

    saving.current = true;
    try {
      const saved = await onSave((latest) => setPreferences(latest, run.id, preferences));
      if (saved) {
        setPreferenceChanges({});
        setSettingsFeedback({ text: 'Settings saved.' });
      }
    } finally {
      saving.current = false;
    }
  }

  function exportCalendar() {
    const preferences = readPreferences();
    if (!preferences) {
      setCalendarFeedback({ text: 'Choose a valid time zone and reminder time to export the calendar.', error: true });
      return;
    }

    try {
      const exported = createCalendarExport(setPreferences(data, run.id, preferences));
      if (exported.eventCount === 0) {
        setCalendarFeedback({ text: 'There are no upcoming reminders for this program.' });
        return;
      }

      downloadText('fit30-reminders.ics', exported.text, 'text/calendar;charset=utf-8');
      setCalendarFeedback({ text: `${exported.eventCount} ${exported.eventCount === 1 ? 'reminder' : 'reminders'} exported. Open the file in your calendar app.` });
    } catch (cause) {
      setCalendarFeedback({ text: cause instanceof Error ? cause.message : 'The reminder calendar couldn’t be exported.', error: true });
    }
  }

  async function saveStartDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || saving.current || lockedDate) return;
    if (!isProgramStartDate(startDate)) {
      setScheduleFeedback({ text: 'Choose a valid start date.', error: true });
      return;
    }

    saving.current = true;
    try {
      const saved = await onSave((latest) => {
        if (latest.activeRunId !== run.id || hasRunRecords(latest, run.id)) {
          throw new Error('This program now has saved records. Start a new program to choose a new date.');
        }
        return { ...latest, runs: latest.runs.map((current) => current.id === run.id ? { ...current, startDate } : current) };
      });
      if (saved) {
        setStartDateChange(null);
        setScheduleFeedback({ text: 'Start date saved.' });
      }
    } finally {
      saving.current = false;
    }
  }

  async function restart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || saving.current || !restartDate) return;
    if (!isProgramStartDate(restartDate)) {
      setRestartError('Choose a valid start date for the new program.');
      return;
    }

    saving.current = true;
    try {
      const saved = await onSave((latest) => {
        if (latest.activeRunId !== run.id) throw new Error('A different program has already been started.');
        return startProgram(latest, restartDate, latest.preferences.timezone);
      });
      if (saved) {
        setRestartDate(null);
        setStartDateChange(null);
        setScheduleFeedback({ text: 'New program started. Your previous program is in Calendar.' });
      } else {
        setRestartError('Fit30 couldn’t start a new program. Close this dialog and review the save message.');
      }
    } finally {
      saving.current = false;
    }
  }

  function exportFile(format: 'backup' | 'workouts' | 'measurements') {
    try {
      if (format === 'backup') {
        downloadText(`fit30-backup-${localDate(run.timezone)}.json`, serializeBackup(data), 'application/json;charset=utf-8');
        setExportFeedback({ text: 'JSON backup downloaded.' });
      } else if (format === 'workouts') {
        downloadText('fit30-workouts.csv', workoutsCsv(data), 'text/csv;charset=utf-8');
        setExportFeedback({ text: 'Workout history downloaded.' });
      } else {
        downloadText('fit30-measurements.csv', measurementsCsv(data), 'text/csv;charset=utf-8');
        setExportFeedback({ text: 'Measurements downloaded.' });
      }
    } catch {
      setExportFeedback({ text: 'Fit30 couldn’t download the file. Try again.', error: true });
    }
  }

  return (
    <div className="fit-settings">
      <header className="page-heading"><h1>Settings</h1></header>
      <div className="settings-grid">
        <div className="settings-column">
          <section className="panel settings-panel" aria-labelledby="reminders-heading">
            <h2 id="reminders-heading"><Bell size={21} aria-hidden="true" /> Reminders and alerts</h2>
            <form onSubmit={(event) => void saveSettings(event)}>
              <div className="settings-fields">
                <label className="field">Daily reminder time<input type="time" value={fields.reminderTime ?? ''} disabled={busy} onChange={(event) => changePreference('reminderTime', event.target.value || null)} /></label>
                <label className="field">Time zone<input type="text" list="fit30-timezones" value={fields.timezone} disabled={busy} onChange={(event) => changePreference('timezone', event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} required /></label>
                <datalist id="fit30-timezones">{suggestedTimezones.map((timezone) => <option key={timezone} value={timezone} />)}</datalist>
              </div>
              <label className="settings-check"><input type="checkbox" checked={fields.remindOnRestDays} disabled={busy} onChange={(event) => changePreference('remindOnRestDays', event.target.checked)} /> Include recovery days</label>
              <div className="settings-subsection">
                <h3>In-workout timer</h3>
                <p>Fit30 can signal when your exercise block ends while the workout is open.</p>
                <label className="settings-check"><input type="checkbox" checked={fields.sound} disabled={busy} onChange={(event) => changePreference('sound', event.target.checked)} /> Play a sound</label>
                <label className="settings-check"><input type="checkbox" checked={fields.vibration} disabled={busy} onChange={(event) => changePreference('vibration', event.target.checked)} /> Vibrate when supported</label>
              </div>
              <button type="submit" className="button button-primary" disabled={busy || !preferencesChanged}>Save settings</button>
              <FeedbackLine feedback={settingsFeedback} />
            </form>
            <div className="settings-subsection">
              <h3>Calendar reminders</h3>
              <p>Use your calendar for alerts when Fit30 is closed. Download upcoming dates with the reminder time and time zone above.</p>
              <button type="button" className="button button-secondary" onClick={exportCalendar} disabled={busy}><Download size={17} aria-hidden="true" /> Export calendar reminders</button>
              <FeedbackLine feedback={calendarFeedback} />
              <p className="settings-note">Import the file into a separate calendar so you can replace the reminders when your schedule changes. Alerts follow your calendar settings.</p>
            </div>
          </section>
          <section className="panel settings-panel" aria-labelledby="program-settings-heading">
            <h2 id="program-settings-heading"><CalendarDays size={21} aria-hidden="true" /> Program schedule</h2>
            <form onSubmit={(event) => void saveStartDate(event)}>
              <label className="field">Start date<input type="date" value={startDate} onChange={(event) => { setStartDateChange(event.target.value); setScheduleFeedback(null); }} disabled={lockedDate || busy} aria-describedby={lockedDate ? 'locked-date-hint' : undefined} required max="9999-12-02" /></label>
              {lockedDate
                ? <p id="locked-date-hint" className="settings-note">This program has saved records. Start a new program to choose a different date and keep this history.</p>
                : <button type="submit" className="button button-secondary" disabled={busy || startDate === run.startDate}>Save start date</button>}
            </form>
            <button type="button" className="button button-quiet" disabled={busy} onClick={() => { setRestartError(''); setRestartDate(localDate(run.timezone)); }}>Restart program</button>
            <FeedbackLine feedback={scheduleFeedback} />
          </section>
        </div>
        <div className="settings-column">
          <section className="panel settings-panel" aria-labelledby="backups-heading">
            <h2 id="backups-heading"><HardDrive size={21} aria-hidden="true" /> Backup and export</h2>
            <p>Your progress is saved in this browser. Download a JSON backup before clearing browser data or moving to another device.</p>
            <div className="settings-export-actions">
              <button type="button" className="button button-secondary" disabled={busy} onClick={() => exportFile('backup')}><Download size={17} aria-hidden="true" /> Download JSON backup</button>
              <BackupRestore busy={busy} onSave={onSave} onRestored={() => { setPreferenceChanges({}); setStartDateChange(null); }} />
            </div>
            <div className="settings-subsection settings-export-actions">
              <button type="button" className="button button-secondary" disabled={busy} onClick={() => exportFile('workouts')}><Download size={17} aria-hidden="true" /> Download workout CSV</button>
              <button type="button" className="button button-secondary" disabled={busy} onClick={() => exportFile('measurements')}><Download size={17} aria-hidden="true" /> Download measurement CSV</button>
            </div>
            <FeedbackLine feedback={exportFeedback} />
          </section>
          <section className="panel settings-panel" aria-labelledby="install-heading">
            <h2 id="install-heading"><Smartphone size={21} aria-hidden="true" /> Install Fit30</h2>
            <p role="status" className={`settings-install-status${offlineStatus === 'ready' ? ' settings-install-ready' : ''}`}>{offlineCopy[offlineStatus]}</p>
            {onRetryOffline && <button type="button" className="button button-secondary" onClick={onRetryOffline}>Retry offline setup</button>}
            {onInstall && <button type="button" className="button button-primary" onClick={onInstall}>Install on this device</button>}
            {offlineStatus === 'ready' && !appInstalled && !onInstall && (
              <p>On Android, use Chrome’s menu to install. On iPhone, use Add to Home Screen in Safari.</p>
            )}
            {offlineStatus === 'ready' && (
              <p className="settings-note">Once installed, open Fit30 from your Home Screen. Workouts, logging, and form cues work without your Mac. Videos use your phone’s internet connection.</p>
            )}
          </section>
        </div>
      </div>
      {restartDate !== null && (
        <Dialog title="Start a new Fit30 program?" onClose={() => setRestartDate(null)} busy={busy}>
          <p>Fit30 will archive this program and keep your original workouts and measurements in Calendar.</p>
          <form onSubmit={(event) => void restart(event)}>
            <label className="field">New program start date<input type="date" value={restartDate} disabled={busy} onChange={(event) => { setRestartDate(event.target.value); setRestartError(''); }} required max="9999-12-02" /></label>
            {restartError && <p className="settings-feedback settings-error" role="alert">{restartError}</p>}
            <div className="settings-actions">
              <button type="submit" className="button button-primary" disabled={busy}>Start new program</button>
              <button type="button" className="button button-secondary" disabled={busy} onClick={() => setRestartDate(null)}>Keep current program</button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
