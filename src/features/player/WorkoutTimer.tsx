import { Timer } from 'lucide-react';
import { useEffect, useEffectEvent, useState } from 'react';
import type { ExerciseLog, Preferences } from '../../domain/model';
import { exerciseElapsedMs } from '../../domain/workout';
import { formatClock } from './formatClock';
import { signalTimerEnd } from './timerAlert';
import { useWorkoutWakeLock } from './useWorkoutWakeLock';

interface Alerts {
  sound: Preferences['sound'];
  vibration: Preferences['vibration'];
}

function useTimerClock(deadline: number | null, stopAtEnd: boolean, { sound, vibration }: Alerts) {
  const [now, setNow] = useState(Date.now);
  const notify = useEffectEvent((signal: AbortSignal) => { void signalTimerEnd(sound, vibration, signal); });

  useEffect(() => {
    if (deadline === null) return;

    const alert = new AbortController();
    let alerted = Date.now() >= deadline;

    const update = (fromVisibilityChange: boolean) => {
      if (document.visibilityState !== 'visible') return;

      const time = Date.now();
      if (!alerted && time >= deadline) {
        alerted = true;
        if (!fromVisibilityChange) notify(alert.signal);
      }
      setNow(time);
      if (stopAtEnd && time >= deadline) window.clearInterval(interval);
    };

    const syncVisibility = () => update(true);
    const interval = window.setInterval(() => update(false), 250);
    document.addEventListener('visibilitychange', syncVisibility);

    return () => {
      alert.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', syncVisibility);
    };
  }, [deadline, stopAtEnd]);

  return now;
}

export function WorkoutTimer({ log, sound, vibration }: { log: ExerciseLog } & Alerts) {
  const budget = log.targetDurationSeconds * 1000;
  const deadline = log.startedAtMs === null ? null : log.startedAtMs + budget - log.elapsedMs;
  const now = useTimerClock(deadline, false, { sound, vibration });
  useWorkoutWakeLock(deadline !== null);
  const elapsed = exerciseElapsedMs(log, now);
  const timeUp = elapsed >= budget;
  const seconds = timeUp ? (elapsed - budget) / 1000 : Math.ceil((budget - elapsed) / 1000);

  return (
    <div className="fit-player-timer">
      <p className="fit-player-timer__label">
        <Timer size={18} aria-hidden="true" />
        {deadline === null ? 'Timer paused' : timeUp ? 'Overtime' : 'Time remaining'}
      </p>
      <div className="fit-player-timer__value" role="timer" aria-label={timeUp ? 'Overtime' : 'Time remaining'}>
        {timeUp && seconds >= 1 ? '+' : ''}{formatClock(seconds)}
      </div>
      <progress max={budget} value={Math.min(budget, elapsed)} aria-label="Exercise time used" />
      <p className="fit-player-timer__message" aria-live="polite">
        {timeUp ? 'Time is up. Continue at a comfortable pace or move on.' : ''}
      </p>
    </div>
  );
}

export function RestTimer({ deadline, sound, vibration }: { deadline: number } & Alerts) {
  const now = useTimerClock(deadline, true, { sound, vibration });
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  useWorkoutWakeLock(seconds > 0);

  return (
    <div className="fit-player-timer">
      <p className="fit-player-timer__label">
        <Timer size={18} aria-hidden="true" />
        {seconds > 0 ? 'Rest remaining' : 'Rest complete'}
      </p>
      <div className="fit-player-timer__value" role="timer" aria-label="Rest remaining">{formatClock(seconds)}</div>
      <p className="fit-player-timer__message" aria-live="polite">
        {seconds === 0 ? 'Start the next exercise when you’re ready.' : ''}
      </p>
    </div>
  );
}
