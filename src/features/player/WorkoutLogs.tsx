import { Check, ClipboardList } from 'lucide-react';
import type { ExerciseLog, Session, SetLog } from '../../domain/model';
import type { WorkoutAction } from '../../domain/workout';

type SaveLog = (action: WorkoutAction) => Promise<boolean>;

interface ExerciseDetailsProps {
  log: ExerciseLog;
  strength: boolean;
  cardio: boolean;
  saving: boolean;
  save: SaveLog;
}

function numberFrom(form: FormData, key: string): number | null {
  const value = form.get(key);
  return typeof value === 'string' && value.trim() ? Number(value) : null;
}

const setUnits: Record<SetLog['unit'], string> = {
  repetitions: 'Reps',
  repetitions_per_side: 'Reps per side',
  seconds_hold: 'Hold (sec)',
};

export function ExerciseDetails({ log, strength, cardio, saving, save }: ExerciseDetailsProps) {
  if (log.sets.length) {
    const logged = log.sets.filter((set) => set.completedAt !== null).length;

    return (
      <details className="fit-player-details panel">
        <summary>
          <span><ClipboardList size={18} aria-hidden="true" /> Log sets</span>
          <small>{logged}/{log.sets.length} saved</small>
        </summary>
        {log.sets.map((set) => (
          <form
            key={`${set.index}-${set.completedAt ?? 'open'}`}
            className="fit-player-set"
            onSubmit={(event) => {
              event.preventDefault();
              const fields = new FormData(event.currentTarget);
              void save({
                type: 'set',
                index: set.index,
                actualValue: numberFrom(fields, 'value'),
                weightKg: strength ? numberFrom(fields, 'weight') : null,
                completed: true,
              });
            }}
          >
            <p className="fit-player-set__label">
              <strong>Set {set.index}</strong>
              {set.completedAt && <span><Check size={16} aria-hidden="true" /> Done</span>}
            </p>
            <div className="fit-player-fields">
              <label>
                {setUnits[set.unit]}
                <input
                  type="number" name="value" min="0" max="10000" step="1" inputMode="numeric"
                  placeholder={String(set.plannedValue)} defaultValue={set.actualValue ?? ''}
                />
              </label>
              {strength && (
                <label>
                  Weight (kg)
                  <input
                    type="number" name="weight" min="0" max="1000" step="any" inputMode="decimal"
                    defaultValue={set.weightKg ?? ''}
                  />
                </label>
              )}
            </div>
            <div className="fit-player-form-actions">
              <button
                type="submit" className="button button-secondary" disabled={saving}
                aria-label={set.completedAt ? `Update set ${set.index}` : `Mark set ${set.index} done`}
              >
                {set.completedAt ? 'Update set' : 'Mark set done'}
              </button>
              {set.completedAt && (
                <button
                  type="button" className="button button-quiet" disabled={saving}
                  aria-label={`Undo set ${set.index}`}
                  onClick={() => void save({ type: 'set', index: set.index, completed: false })}
                >
                  Undo
                </button>
              )}
            </div>
          </form>
        ))}
      </details>
    );
  }

  if (!cardio) return null;

  return (
    <details className="fit-player-details panel">
      <summary>
        <span><ClipboardList size={18} aria-hidden="true" /> Log cardio details</span>
        {[log.actualMinutes, log.distanceKm, log.speedKmh].some((value) => value !== null) && <small>Saved</small>}
      </summary>
      <form
        className="fit-player-set"
        onSubmit={(event) => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          void save({
            type: 'cardio',
            actualMinutes: numberFrom(fields, 'minutes'),
            distanceKm: numberFrom(fields, 'distance'),
            speedKmh: numberFrom(fields, 'speed'),
          });
        }}
      >
        <p>Leave minutes blank to use the timer.</p>
        <div className="fit-player-fields">
          <label>
            Actual minutes
            <input
              type="number" name="minutes" min="0" max="1440" step="any" inputMode="decimal"
              defaultValue={log.actualMinutes ?? ''}
            />
          </label>
          <label>
            Distance (km)
            <input
              type="number" name="distance" min="0" max="10000" step="any" inputMode="decimal"
              defaultValue={log.distanceKm ?? ''}
            />
          </label>
          <label>
            Speed (km/h)
            <input
              type="number" name="speed" min="0" max="1000" step="any" inputMode="decimal"
              defaultValue={log.speedKmh ?? ''}
            />
          </label>
        </div>
        <button type="submit" className="button button-secondary" disabled={saving}>Save cardio details</button>
      </form>
    </details>
  );
}

export function SessionDetails({ session }: { session: Session }) {
  return (
    <details className="fit-player-details panel" onInvalid={(event) => { event.currentTarget.open = true; }}>
      <summary><span><ClipboardList size={18} aria-hidden="true" /> Add workout notes</span></summary>
      <div className="fit-player-set">
        <div className="fit-player-fields">
          <label>
            Effort (1–10)
            <input type="number" name="effort" min="1" max="10" step="1" inputMode="numeric" defaultValue={session.effort ?? ''} />
          </label>
          <label>
            Back discomfort (0–10)
            <input type="number" name="discomfort" min="0" max="10" step="1" inputMode="numeric" defaultValue={session.backPain ?? ''} />
          </label>
        </div>
        <p>If back pain worsens or is significant, stop exercising and seek professional assessment.</p>
        <label>
          Notes
          <textarea name="notes" maxLength={2000} rows={3} defaultValue={session.notes} />
        </label>
      </div>
    </details>
  );
}

export function getSessionDetailsAction(form: HTMLFormElement, session: Session): WorkoutAction | null {
  const fields = new FormData(form);
  const effort = numberFrom(fields, 'effort');
  const backPain = numberFrom(fields, 'discomfort');
  const notes = String(fields.get('notes') ?? '').trim();
  if (effort === session.effort && backPain === session.backPain && notes === session.notes) return null;

  return { type: 'details', effort, backPain, notes };
}
