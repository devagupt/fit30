import { addDays, scheduledDate, weekdayOn, type Weekday } from './dates';
import type { ProgramRun, Session } from './model';
import { program } from './program';

const firstRecovery = program.days.find((day) => day.day_type === 'rest')!;

export function recoveryWeekday(run: ProgramRun): Weekday {
  return run.schedule?.closedWeekday ?? weekdayOn(scheduledDate(run, firstRecovery.day_number));
}

export function isGymClosed(run: ProgramRun, date: string): boolean {
  return !!run.schedule && date >= run.schedule.effectiveFrom && weekdayOn(date) === run.schedule.closedWeekday;
}

export function rescheduleRecovery(run: ProgramRun, sessions: Session[], today: string, closedWeekday: Weekday): ProgramRun {
  let effectiveFrom = today < run.startDate ? run.startDate : today;
  for (const session of sessions) {
    if (session.programRunId === run.id && session.scheduledLocalDate >= effectiveFrom) {
      effectiveFrom = addDays(session.scheduledLocalDate, 1);
    }
  }

  const dates = program.days.map((day) => scheduledDate(run, day.day_number));
  const gym: number[] = [];
  const recovery: number[] = [];
  program.days.forEach((day, index) => {
    if (dates[index] < effectiveFrom) return;
    (day.day_type === 'rest' ? recovery : gym).push(index);
  });

  let date = effectiveFrom;
  while (gym.length || recovery.length) {
    const next = (weekdayOn(date) === closedWeekday ? recovery : gym).shift();
    if (next !== undefined) dates[next] = date;
    if (gym.length || recovery.length) date = addDays(date, 1);
  }

  return { ...run, schedule: { closedWeekday, effectiveFrom, dates } };
}
