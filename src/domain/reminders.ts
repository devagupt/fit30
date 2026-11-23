import { scheduledDate } from './dates';
import type { Fit30Data } from './model';
import { program } from './program';

const reminderIdBase = 3000;

export interface WorkoutReminder {
  id: number;
  at: number;
  body: string;
}

export function isWorkoutReminderId(id: number): boolean {
  return Number.isInteger(id) && id > reminderIdBase && id <= reminderIdBase + program.program_duration_days;
}

function localTimeConverter(timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });

  function localAsUtc(instant: number): number {
    const fields = Object.fromEntries(formatter.formatToParts(instant).map(({ type, value }) => [type, value]));
    return Date.parse(`${fields.year.padStart(4, '0')}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}:${fields.second}Z`);
  }

  return (date: string, time: string) => {
    const wanted = Date.parse(`${date}T${time}:00Z`);
    const horizon = 36 * 60 * 60 * 1000;
    const probes = [wanted - horizon, wanted, wanted + horizon];
    const candidates = probes.map((instant) => wanted - (localAsUtc(instant) - instant));
    const matches = candidates.filter((instant) => localAsUtc(instant) === wanted);
    // During a fall-back fold use the first occurrence. During a spring-forward gap use the pre-gap offset.
    return matches.length > 0 ? Math.min(...matches) : candidates[0];
  };
}

function completedDays(data: Fit30Data): Set<number> {
  return new Set(data.sessions.filter((session) =>
    session.programRunId === data.activeRunId && session.status === 'completed',
  ).map((session) => session.plannedDayNumber));
}

// Unrelated workout checkpoints and preference edits leave the reminder schedule alone.
export function reminderScheduleKey(data: Fit30Data): string {
  if (!data.preferences.remindersEnabled) return 'disabled';
  const run = data.runs.find((entry) => entry.id === data.activeRunId);
  return JSON.stringify([
    run, data.preferences.reminderTime, data.preferences.remindOnRestDays,
    [...completedDays(data)].sort((left, right) => left - right),
  ]);
}

export function workoutReminders(data: Fit30Data, now = Date.now()): WorkoutReminder[] {
  const run = data.runs.find((entry) => entry.id === data.activeRunId);
  const { reminderTime, remindersEnabled, remindOnRestDays } = data.preferences;
  if (!run || !remindersEnabled || !reminderTime) return [];

  const toUtc = localTimeConverter(run.timezone);
  const completed = completedDays(data);
  return program.days.flatMap((day) => {
    const rest = day.day_type === 'rest';
    if (completed.has(day.day_number) || (rest && !remindOnRestDays)) return [];
    const at = toUtc(scheduledDate(run, day.day_number), reminderTime);
    if (at <= now) return [];
    return [{
      id: reminderIdBase + day.day_number,
      at,
      body: rest ? 'Time for your optional recovery walk.' : 'Your Fit30 workout is ready.',
    }];
  }).sort((left, right) => left.at - right.at);
}
