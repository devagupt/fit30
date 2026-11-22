import { describe, expect, it } from 'vitest';
import { dayNumberOn, programEndDate, scheduledDate, weekdayOn } from './dates';
import { appDataSchema, emptyData } from './model';
import { program } from './program';
import { workoutForToday } from './progress';
import { isGymClosed, recoveryWeekday, rescheduleRecovery } from './schedule';
import { createSession, startProgram } from './workout';

const now = Date.parse('2026-11-22T09:30:00Z');
const data = startProgram(emptyData, '2026-11-16', 'Asia/Kolkata', now, 'gym-calendar');
const run = data.runs[0];

describe('moving recovery to the gym closure weekday', () => {
  it('moves Sunday recovery to Tuesday and preserves older dates, workout order and saved attempts', () => {
    const attempt = createSession(run, 1, now, 'saved-attempt');
    expect(recoveryWeekday(run)).toBe('Sunday');
    const updated = rescheduleRecovery(run, [attempt], '2026-11-22', 'Tuesday');
    expect(updated.schedule?.dates.slice(0, 6)).toEqual(program.days.slice(0, 6).map((day) => scheduledDate(run, day.day_number)));
    expect(scheduledDate(updated, 7)).toBe('2026-11-24');
    expect(scheduledDate(updated, 8)).toBe('2026-11-22');
    expect(dayNumberOn(updated, '2026-11-24')).toBe(7);
    expect(workoutForToday(updated, [attempt], '2026-11-24')?.day.day_type).toBe('rest');
    expect(workoutForToday(updated, [attempt], '2026-11-25')?.session?.id).toBe(attempt.id);
    expect(updated.schedule?.dates).toHaveLength(30);
    expect(new Set(updated.schedule?.dates).size).toBe(30);
    expect(appDataSchema.parse({ ...data, runs: [updated], sessions: [attempt] }).sessions[0]).toEqual(attempt);
  });

  it('keeps a future date already attached to an ahead-of-schedule log and supports changing the weekday again', () => {
    const ahead = createSession(run, 12, now, 'ahead-attempt');
    const updated = rescheduleRecovery(run, [ahead], '2026-11-22', 'Tuesday');
    expect(scheduledDate(updated, 12)).toBe(ahead.scheduledLocalDate);
    expect(updated.schedule?.effectiveFrom).toBe('2026-11-28');
    const changed = rescheduleRecovery(updated, [ahead], '2026-12-02', 'Thursday');
    const nextRecovery = program.days.filter((day) => day.day_type === 'rest')
      .map((day) => scheduledDate(changed, day.day_number)).filter((date) => date >= '2026-12-02');
    expect(nextRecovery.map(weekdayOn)).toEqual(['Thursday', 'Thursday']);
    expect(appDataSchema.parse({ ...data, runs: [changed], sessions: [ahead] }).sessions[0]).toEqual(ahead);
  });

  it('defers a late workout around an extra closure without adding a workout or counting a missed day', () => {
    const updated = rescheduleRecovery(run, [], '2026-11-16', 'Monday');
    expect(programEndDate(updated)).toBe('2026-12-16');
    expect(dayNumberOn(updated, '2026-12-14')).toBeNull();
    expect(isGymClosed(updated, '2026-12-14')).toBe(true);
    expect(workoutForToday(updated, [], '2026-12-14')).toBeUndefined();
    expect(workoutForToday(updated, [], '2026-12-15')?.day.day_number).toBe(1);
  });

  it('rejects imported schedules with duplicate or inverted dates', () => {
    const updated = rescheduleRecovery(run, [], '2026-11-16', 'Tuesday');
    const dates = updated.schedule!.dates.slice();
    dates[1] = dates[0];
    expect(appDataSchema.safeParse({ ...data, runs: [{ ...updated, schedule: { ...updated.schedule, dates } }] }).success).toBe(false);
  });
});
