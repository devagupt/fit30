import { Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ExerciseLog, Preferences } from '../../domain/model';
import { exerciseElapsedMs } from '../../domain/workout';
import { formatClock } from './formatClock';
import { signalTimerEnd } from './timerAlert';

interface WorkoutTimerProps {
  log: ExerciseLog;
  sound: Preferences['sound'];
  vibration: Preferences['vibration'];
}

export function WorkoutTimer({ log, sound, vibration }: WorkoutTimerProps) {
  const budget = log.targetDurationSeconds * 1000;
  const deadline = log.startedAtMs === null ? null : log.startedAtMs + budget - log.elapsedMs;
  const [now, setNow] = useState(Date.now);
  const elapsed = exerciseElapsedMs(log, now);
  const timeUp = elapsed >= budget;
  const seconds = timeUp ? (elapsed - budget) / 1000 : Math.ceil((budget - elapsed) / 1000);

  useEffect(() => {
    if (deadline === null) return;

    let lastSample = Date.now();
    let alerted = lastSample >= deadline;

    const tick = () => {
      if (document.visibilityState !== 'visible') return;

      const time = Date.now();
      if (!alerted && time >= deadline) {
        alerted = true;
        if (time - lastSample < 1500) signalTimerEnd(sound, vibration);
      }
      lastSample = time;
      setNow(time);
    };

    const syncVisibility = () => {
      lastSample = Date.now();
      if (lastSample >= deadline) alerted = true;
      setNow(lastSample);
    };

    const interval = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', syncVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', syncVisibility);
    };
  }, [deadline, log.order, log.exerciseId, sound, vibration]);

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
