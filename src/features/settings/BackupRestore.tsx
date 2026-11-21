import { useRef, useState, type ChangeEvent } from 'react';
import { Upload } from 'lucide-react';
import { mergeBackup, parseBackup } from '../../data/backup';
import type { DataUpdate } from '../../data/storage';
import type { Fit30Data } from '../../domain/model';
import { Dialog } from '../../ui/Dialog';
import './settings.css';

interface BackupRestoreProps {
  busy: boolean;
  onSave: (update: DataUpdate) => Promise<boolean>;
  onRestored?: () => void;
  className?: string;
}

export function BackupRestore({ busy, onSave, onRestored, className = 'button button-secondary' }: BackupRestoreProps) {
  const input = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  const [backup, setBackup] = useState<Fit30Data | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  async function chooseBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    setError('');
    setFeedback('');
    setReading(true);
    try {
      setBackup(parseBackup(await file.text()));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Choose a readable Fit30 JSON backup.');
    } finally {
      setReading(false);
    }
  }

  async function restore() {
    if (!backup || busy || saving.current) return;
    saving.current = true;
    setError('');
    try {
      let conflict = '';
      const saved = await onSave((current) => {
        try {
          return mergeBackup(current, backup);
        } catch (cause) {
          if (cause instanceof Error) conflict = cause.message;
          throw cause;
        }
      });
      if (saved) {
        setBackup(null);
        setFeedback('Backup restored.');
        onRestored?.();
      } else {
        setError(conflict || 'Fit30 couldn’t save the backup. Try again.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Fit30 couldn’t restore the backup. Try again.');
    } finally {
      saving.current = false;
    }
  }

  return (
    <div className="backup-restore">
      <input ref={input} type="file" accept=".json,application/json" aria-label="Fit30 backup file" hidden onChange={(event) => void chooseBackup(event)} />
      <button type="button" className={className} disabled={busy || reading} onClick={() => input.current?.click()}>
        <Upload size={17} aria-hidden="true" /> {reading ? 'Reading backup…' : 'Restore backup'}
      </button>
      {error && !backup && <p className="settings-feedback settings-error" role="alert">{error}</p>}
      {feedback && <p className="settings-feedback" role="status">{feedback}</p>}
      {backup && (
        <Dialog title="Restore Fit30 backup?" onClose={() => { setBackup(null); setError(''); }} busy={busy}>
          <p>This backup contains {backup.sessions.length} workout {backup.sessions.length === 1 ? 'attempt' : 'attempts'} and {backup.measurements.length} {backup.measurements.length === 1 ? 'measurement' : 'measurements'}.</p>
          <p>{backup.activeRunId
            ? 'Take up the program and settings from this backup. Fit30 will keep workout and measurement history from both copies.'
            : 'Add the workout and measurement history from this backup to this device.'}</p>
          {error && <p className="settings-feedback settings-error" role="alert">{error}</p>}
          <div className="settings-actions">
            <button type="button" className="button button-primary" disabled={busy} onClick={() => void restore()}>Restore backup</button>
            <button className="button button-secondary" type="button" disabled={busy} onClick={() => { setBackup(null); setError(''); }}>Cancel</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
