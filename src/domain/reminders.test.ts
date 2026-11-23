import { describe, expect, it } from 'vitest';
import { appDataSchema, emptyData } from './model';
import { workoutReminders } from './reminders';
import { rescheduleRecovery } from './schedule';
import { createSession, startProgram, updateSession } from './workout';

const now = Date.parse('2026-11-19T06:00:00Z');

function programData(start = '2026-11-20', timezone = 'Asia/Kolkata', time = '18:30') {
  const data = startProgram(emptyData, start, timezone, now, 'reminder-program');
  return { ...data, preferences: { ...data.preferences, reminderTime: time, remindersEnabled: true } };
}

describe('workout reminder schedule', () => {
  it('uses the saved timezone and only includes recovery days when selected', () => {
    const data = programData();
    const gym = workoutReminders(data, now);
    expect(gym).toHaveLength(26);
    expect(gym[0].at).toBe(Date.parse('2026-11-20T13:00:00Z'));
    expect(gym.map(({ id }) => id)).not.toContain(3007);
    data.preferences.remindOnRestDays = true;
    const all = workoutReminders(data, now);
    expect(all).toHaveLength(30);
    expect(all.find(({ id }) => id === 3007)).toMatchObject({ body: 'Time for your optional recovery walk.' });
  });

  it('skips finished days and moves reminders when the recovery weekday changes', () => {
    const data = programData('2026-11-16');
    const saved = createSession(data.runs[0], 4, now, 'completed-workout');
    const finished = { ...updateSession(saved, { type: 'savePartial' }, now), status: 'completed' } as const;
    const adjusted = rescheduleRecovery(data.runs[0], [finished], '2026-11-22', 'Tuesday');
    const planned = workoutReminders({ ...data, runs: [adjusted], sessions: [finished] }, now);
    expect(planned.map(({ id }) => id)).not.toContain(3004);
    expect(planned.find(({ id }) => id === 3008)?.at).toBe(Date.parse('2026-11-22T13:00:00Z'));
    expect(planned.map(({ at }) => at)).not.toContain(Date.parse('2026-11-24T13:00:00Z'));
  });

  it('handles both daylight-saving transitions and excludes elapsed reminder times', () => {
    const spring = programData('2026-03-08', 'America/New_York', '02:30');
    const fall = programData('2026-11-01', 'America/New_York', '01:30');
    expect(workoutReminders(spring, Date.parse('2026-03-07T00:00:00Z'))[0].at).toBe(Date.parse('2026-03-08T07:30:00Z'));
    expect(workoutReminders(fall, Date.parse('2026-10-31T00:00:00Z'))[0].at).toBe(Date.parse('2026-11-01T05:30:00Z'));
    expect(workoutReminders(fall, Date.parse('2026-11-01T05:30:00Z'))[0].id).toBe(3002);
  });

  it('preserves an older backup’s time without enabling device notifications', () => {
    const data = programData();
    const legacy = { ...data.preferences, remindersEnabled: undefined };
    const restored = appDataSchema.parse({ ...data, preferences: legacy });
    expect(restored.preferences.reminderTime).toBe('18:30');
    expect(workoutReminders(restored, now)).toEqual([]);
  });
});
