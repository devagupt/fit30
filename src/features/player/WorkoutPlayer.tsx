import { Check, CirclePlay, FastForward, Pause, Play, ShieldCheck, X } from 'lucide-react';
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import type { Preferences, Session } from '../../domain/model';
import { categoryLabel, formatPrescription, getDay, getExercise } from '../../domain/program';
import { allowedSubstitutions, canFinish, completedExerciseSeconds, type WorkoutAction } from '../../domain/workout';
import { formatClock } from './formatClock';
import { PlayerDialog } from './PlayerDialog';
import { prepareTimerSound } from './timerAlert';
import { TutorialDialog } from './TutorialDialog';
import { ExerciseDetails, getSessionDetailsAction, SessionDetails } from './WorkoutLogs';
import { RestTimer, WorkoutTimer } from './WorkoutTimer';
import './player.css';

interface WorkoutPlayerProps {
  session: Session;
  preferences: Preferences;
  online: boolean;
  onAction: (action: WorkoutAction | WorkoutAction[], quiet?: boolean) => Promise<boolean>;
  onExit: () => void;
}

type Overlay = {
  type: 'tutorial' | 'skip' | 'exit' | 'discard';
  position: number;
  exerciseId: string | undefined;
};

export function WorkoutPlayer({ session, preferences, online, onAction, onExit }: WorkoutPlayerProps) {
  const { position, exercises } = session;
  const day = getDay(session.plannedDayNumber);
  const log = exercises[position];
  const plannedBlock = day?.exercise_blocks[position];
  const exercise = log ? getExercise(log.exerciseId) : null;
  const running = log?.startedAtMs != null;
  const last = position === exercises.length - 1;
  const review = log?.state === 'completed' || log?.state === 'skipped';
  const isWalk = day?.day_type === 'rest';
  const substitutionIds = log ? allowedSubstitutions(log) : [];
  const currentExerciseId = log?.exerciseId;
  const resting = session.restUntilMs !== null;
  const heading = useRef<HTMLHeadingElement>(null);
  const dialogTrigger = useRef<HTMLButtonElement | null>(null);
  const busy = useRef(false);
  const backgroundSave = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const visibleOverlay = overlay?.position === position && overlay.exerciseId === currentExerciseId
    ? overlay.type
    : null;

  const apply = useCallback(async (action: WorkoutAction | WorkoutAction[], quiet = false) => {
    if (busy.current || (quiet && backgroundSave.current)) return false;

    if (quiet) backgroundSave.current = true;
    else {
      busy.current = true;
      setSaving(true);
      setSaveFailed(false);
    }
    const guarded = Array.isArray(action)
      ? action.map((item) => ({ ...item, at: position }))
      : { ...action, at: position };

    try {
      const persisted = await onAction(guarded, quiet);
      if (!persisted && !quiet) setSaveFailed(true);
      return persisted;
    } catch {
      if (!quiet) setSaveFailed(true);
      return false;
    } finally {
      if (quiet) backgroundSave.current = false;
      else {
        busy.current = false;
        setSaving(false);
      }
    }
  }, [onAction, position]);

  const checkpoint = useEffectEvent(() => {
    void apply({ type: 'checkpoint' }, true);
  });

  useEffect(() => {
    if (!running) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') checkpoint();
    }, 15000);
    const checkpointOnHide = () => {
      if (document.visibilityState === 'hidden') checkpoint();
    };
    const checkpointOnPageHide = () => checkpoint();
    document.addEventListener('visibilitychange', checkpointOnHide);
    window.addEventListener('pagehide', checkpointOnPageHide);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', checkpointOnHide);
      window.removeEventListener('pagehide', checkpointOnPageHide);
    };
  }, [running, position, currentExerciseId]);

  useLayoutEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [position, currentExerciseId, resting]);

  function displayOverlay(type: Overlay['type']) {
    setOverlay({ type, position, exerciseId: currentExerciseId });
  }

  async function openOverlay(type: Overlay['type'], trigger: HTMLButtonElement) {
    dialogTrigger.current = trigger;
    setSaveFailed(false);
    if (running) {
      const persisted = await apply({ type: type === 'tutorial' ? 'openTutorial' : 'pause' });
      if (!persisted) return;
    }
    displayOverlay(type);
  }

  function clearOverlay() {
    setSaveFailed(false);
    setOverlay(null);
  }

  function closeOverlay() {
    const trigger = dialogTrigger.current;
    clearOverlay();
    window.requestAnimationFrame(() => {
      if (trigger?.isConnected) trigger.focus();
    });
  }

  function toggleTimer() {
    if (!running && preferences.sound) void prepareTimerSound();
    void apply({ type: running ? 'pause' : 'resume' });
  }

  function startNext() {
    if (preferences.sound) void prepareTimerSound();
    void apply({ type: 'startNext' });
  }

  async function saveAndExit(form: HTMLFormElement | null, type: 'savePartial' | 'finish' | 'abandon') {
    const details = form ? getSessionDetailsAction(form, session) : null;
    const persisted = await apply(details ? [details, { type }] : { type });
    if (persisted) onExit();
  }

  async function skip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim();
    if (await apply({ type: 'skip', reason })) clearOverlay();
  }

  async function substitute(exerciseId: string) {
    if (await apply({ type: 'substitute', exerciseId })) clearOverlay();
  }

  const saveError = saveFailed && (
    <p className="fit-player-error" role="alert">Your change couldn’t be saved. Please try again.</p>
  );
  const saveFeedback = saving ? <p className="fit-player-inline-note" role="status">Saving workout…</p> : saveError;
  const completedCount = exercises.filter((item) => item.state === 'completed').length;
  const skippedCount = exercises.filter((item) => item.state === 'skipped').length;
  const readyToFinish = canFinish(session);
  const loggedSeconds = exercises.reduce((sum, item) => sum + completedExerciseSeconds(item), 0);
  const displayBlock = plannedBlock && log && log.exerciseId !== log.sourceExerciseId
    ? {
      ...plannedBlock,
      sets: log.sets.length || null,
      reps: log.sets[0]?.plannedValue ?? null,
      reps_unit: log.sets[0]?.unit ?? null,
    }
    : plannedBlock;

  return (
    <section className="fit-player" aria-label="Workout player">
      <div className="fit-player-topbar">
        <div>
          <p className="eyebrow">{isWalk ? 'Optional walk' : session.isMakeUp ? 'Make-up workout' : 'Workout'} · Day {session.plannedDayNumber}</p>
          <span>{day?.session_name}</span>
        </div>
        <button type="button" className="button button-quiet" disabled={saving} onClick={(event) => void openOverlay('exit', event.currentTarget)}>
          <X size={19} aria-hidden="true" /> Exit workout
        </button>
      </div>

      <div className="fit-player-progress" aria-hidden="true">
        {exercises.map((item, index) => (
          <span key={item.order} data-state={index === position ? 'current' : item.state} />
        ))}
      </div>
      {session.restUntilMs !== null && exercise && displayBlock ? (
        <div key={`rest:${position}`}>
          <header className="fit-player-exercise-heading">
            <h1 ref={heading} tabIndex={-1}>Rest</h1>
            <p className="eyebrow">Up next</p>
            <p className="fit-player-prescription">{exercise.name}</p>
            <p className="fit-player-equipment">{formatPrescription(displayBlock)}</p>
          </header>
          <RestTimer deadline={session.restUntilMs} sound={preferences.sound} vibration={preferences.vibration} />
          <div className="fit-player-controls">
            {!visibleOverlay && saveFeedback}
            <div className="fit-player-controls__main">
              <button type="button" className="button button-primary" disabled={saving} onClick={startNext}>
                <Play size={20} aria-hidden="true" /> Start next now
              </button>
            </div>
          </div>
        </div>
      ) : log && exercise && displayBlock ? (
        <div key={`exercise:${position}:${log.exerciseId}`}>
          <header className="fit-player-exercise-heading">
            <p className="eyebrow">Exercise {position + 1} of {exercises.length} · {categoryLabel(exercise.category)}</p>
            <h1 ref={heading} tabIndex={-1}>{exercise.name}</h1>
            <p className="fit-player-prescription">{formatPrescription(displayBlock)}</p>
            {log.exerciseId !== log.sourceExerciseId && (
              <p className="fit-player-inline-note">Substitute for {getExercise(log.sourceExerciseId).name}</p>
            )}
            <p className="fit-player-equipment">{exercise.equipment === 'none' ? 'No equipment' : `Equipment · ${exercise.equipment}`}</p>
          </header>

          {review ? (
            <div className="fit-player-review panel">
              {log.state === 'completed'
                ? <p><Check size={20} aria-hidden="true" /> Exercise done</p>
                : <p><FastForward size={19} aria-hidden="true" /> Exercise skipped</p>}
              {log.skipReason && <span>{log.skipReason}</span>}
              {log.state === 'completed' && <span>{formatClock(completedExerciseSeconds(log))} logged</span>}
            </div>
          ) : (
            <WorkoutTimer log={log} sound={preferences.sound} vibration={preferences.vibration} />
          )}

          <div className="fit-player-guidance panel">
            <div className="fit-player-guidance__heading">
              <h2>Form cues</h2>
              <button
                type="button" className="button button-secondary" disabled={saving}
                onClick={(event) => void openOverlay('tutorial', event.currentTarget)}
              >
                <CirclePlay size={20} aria-hidden="true" /> Watch tutorial
              </button>
            </div>
            <p>{exercise.instructions}</p>
            <p className="fit-player-safety"><ShieldCheck size={19} aria-hidden="true" /> <span>{exercise.back_safety}</span></p>
          </div>

          {!review && (
            <ExerciseDetails
              log={log}
              strength={exercise.category === 'strength'}
              cardio={exercise.category === 'cardio' || isWalk}
              saving={saving}
              save={apply}
            />
          )}

          <div className="fit-player-controls">
            {!visibleOverlay && saveFeedback}
            <div className="fit-player-controls__main">
              {!review && (
                <button type="button" className="button button-secondary" disabled={saving} onClick={toggleTimer}>
                  {running ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
                  {running ? 'Pause timer' : log.state === 'pending' ? 'Start timer' : 'Resume timer'}
                </button>
              )}
              <button
                type="button" className="button button-primary" disabled={saving}
                onClick={() => void apply({ type: review ? 'next' : 'done' })}
              >
                {review ? 'Next' : last ? 'Mark done & review' : 'Mark done & next'}
              </button>
            </div>
            <div className="fit-player-controls__extra">
              {position > 0 && (
                <button
                  type="button" className="button button-quiet" disabled={saving}
                  onClick={() => void apply({ type: 'previous' })}
                >
                  Previous
                </button>
              )}
              {!review && (
                <button type="button" className="button button-quiet" disabled={saving} onClick={(event) => void openOverlay('skip', event.currentTarget)}>
                  Skip
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="fit-player-summary">
          <header className="fit-player-exercise-heading">
            <p className="eyebrow">Review</p>
            <h1 ref={heading} tabIndex={-1}>{isWalk ? 'Review your walk' : 'Review your workout'}</h1>
            <p>{formatClock(loggedSeconds)} logged time · {completedCount} done{skippedCount > 0 ? ` · ${skippedCount} skipped` : ''}</p>
          </header>
          <ul className="fit-player-summary__list panel">
            {exercises.map((item) => (
              <li key={item.order}>
                <span>{getExercise(item.exerciseId).name}</span>
                <strong data-state={item.state}>
                  {item.state === 'completed' ? 'Done' : item.state === 'skipped' ? 'Skipped' : 'Open'}
                </strong>
              </li>
            ))}
          </ul>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveAndExit(event.currentTarget, readyToFinish ? 'finish' : 'savePartial');
            }}
          >
            <SessionDetails session={session} />
            {!readyToFinish && (
              <p className="fit-player-inline-note">
                {skippedCount === exercises.length
                  ? 'Every exercise was skipped. You can save this attempt as partial.'
                  : 'Review any open exercises or save this attempt as partial.'}
              </p>
            )}
            <div className="fit-player-controls">
              {!visibleOverlay && saveFeedback}
              <div className="fit-player-controls__main">
                <button type="submit" className="button button-primary" disabled={saving}>
                  {readyToFinish ? isWalk ? 'Save walk' : 'Finish workout' : 'Save partial'}
                </button>
              </div>
              <div className="fit-player-controls__extra">
                <button
                  type="button" className="button button-quiet" disabled={saving}
                  onClick={() => void apply({ type: 'previous' })}
                >
                  Previous
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {visibleOverlay === 'tutorial' && log && (
        <TutorialDialog
          exerciseId={log.exerciseId}
          online={online}
          onClose={closeOverlay}
          timerPaused={!review}
          onOpenVideo={() => void apply({ type: 'watchTutorial' }, true)}
        />
      )}

      {visibleOverlay === 'skip' && exercise && (
        <PlayerDialog title="Skip this exercise?" onClose={closeOverlay} closeDisabled={saving}>
          <p className="fit-player-dialog__meta">{exercise.name}</p>
          <form className="fit-player-dialog__form" onSubmit={(event) => void skip(event)}>
            <label>
              Skip reason (optional)
              <input name="reason" type="text" maxLength={500} placeholder="Machine occupied" />
            </label>
            {saveFeedback}
            <div className="fit-player-dialog__actions">
              <button type="submit" className="button button-primary" disabled={saving}>
                {last ? 'Skip & review' : 'Skip & next'}
              </button>
              <button type="button" className="button button-secondary" onClick={closeOverlay} disabled={saving}>Keep exercise</button>
            </div>
          </form>
          {substitutionIds.map((id) => (
            <div key={id} className="fit-player-dialog__section">
              <h3>Machine looks different?</h3>
              <p>Choose a substitute for this workout.</p>
              <button type="button" className="button button-secondary" disabled={saving} onClick={() => void substitute(id)}>
                Use {getExercise(id).name.toLowerCase()}
              </button>
            </div>
          ))}
        </PlayerDialog>
      )}

      {visibleOverlay === 'exit' && (
        <PlayerDialog title="Leave this workout?" onClose={closeOverlay} closeDisabled={saving}>
          <p className="fit-player-dialog__meta">Save your progress to pick up where you left off.</p>
          <form className="fit-player-dialog__form" onSubmit={(event) => {
            event.preventDefault();
            void saveAndExit(event.currentTarget, 'savePartial');
          }}>
            <SessionDetails session={session} />
            {saveFeedback}
            <div className="fit-player-dialog__actions">
              <button type="submit" className="button button-primary" disabled={saving}>Save partial</button>
              <button type="button" className="button button-secondary" disabled={saving} onClick={closeOverlay}>Keep going</button>
              <button type="button" className="button button-quiet fit-player-danger-text" disabled={saving} onClick={() => displayOverlay('discard')}>Discard attempt</button>
            </div>
          </form>
        </PlayerDialog>
      )}

      {visibleOverlay === 'discard' && (
        <PlayerDialog title="Discard this attempt?" onClose={() => displayOverlay('exit')} closeDisabled={saving}>
          <p className="fit-player-dialog__meta">The exercise logs and notes from this attempt will be permanently removed.</p>
          {saveFeedback}
          <div className="fit-player-dialog__actions">
            <button type="button" className="button fit-player-danger" disabled={saving} onClick={() => void saveAndExit(null, 'abandon')}>Discard attempt</button>
            <button type="button" className="button button-secondary" disabled={saving} onClick={() => displayOverlay('exit')}>Go back</button>
          </div>
        </PlayerDialog>
      )}
    </section>
  );
}
