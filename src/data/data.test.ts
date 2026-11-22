import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { appDataSchema, emptyData, type Fit30Data, type Session } from '../domain/model';
import { getDay } from '../domain/program';
import { scheduledDate } from '../domain/dates';
import { mergeBackup, parseBackup, serializeBackup } from './backup';
import { createCalendarExport, measurementsCsv, workoutsCsv } from './exports';
import { DataConflictError, readData, updateData } from './storage';

const runId = '1fe2947b-5209-4adf-9e67-b5228040fcec';
const oldRunId = '8d1ec216-c340-4ef5-b17b-cf4c67d39471';
const sessionId = '978f8825-0ba3-4363-9be2-b193a07636e5';
const doneId = '1c59465a-ac69-4944-be34-11988468089b';
const measurementId = '8215de38-87dd-400e-845e-caf4155f6a57';
const beforeProgram = Date.parse('2026-11-19T06:00:00.000Z');
const nextMonth = Date.parse('2026-12-03T12:00:00.000Z');

function configuredData(id = runId, startDate = '2026-11-20', timezone = 'Asia/Kolkata'): Fit30Data {
  return {
    ...structuredClone(emptyData),
    activeRunId: id,
    runs: [{ id, startDate, timezone, createdAt: '2026-02-20T06:00:00.000Z', archivedAt: null }],
    preferences: { ...emptyData.preferences, timezone, reminderTime: '18:30', remindOnRestDays: false },
  };
}

function draft(data: Fit30Data): Session {
  const plannedDayNumber = 3;
  const day = getDay(plannedDayNumber)!;
  const run = data.runs[0];
  const scheduledLocalDate = scheduledDate(run, plannedDayNumber);
  const performedAt = `${scheduledLocalDate}T05:00:00.000Z`;

  return {
    id: sessionId,
    programRunId: run.id,
    plannedDayNumber,
    scheduledLocalDate,
    performedAt,
    updatedAt: performedAt,
    finishedAt: null,
    isMakeUp: false,
    status: 'in_progress',
    position: 0,
    restUntilMs: null,
    exercises: day.exercise_blocks.map((block) => ({
      sourceExerciseId: block.exercise_id,
      exerciseId: block.exercise_id,
      order: block.order,
      targetDurationSeconds: block.duration_min * 60,
      state: block.order === 1 ? 'in_progress' : 'pending',
      elapsedMs: 0,
      startedAtMs: block.order === 1 ? Date.parse(performedAt) : null,
      completedAt: null,
      sets: Array.from({ length: block.sets ?? 0 }, (_, index) => ({
        index: index + 1,
        plannedValue: block.reps!,
        unit: block.reps_unit!,
        actualValue: null,
        weightKg: null,
        completedAt: null,
      })),
      actualMinutes: null,
      distanceKm: null,
      speedKmh: null,
      skipReason: null,
      tutorialWatchedAt: null,
    })),
    effort: null,
    backPain: null,
    notes: '',
  };
}

function completed(data: Fit30Data, performedAt = '2026-11-22T05:00:00.000Z'): Session {
  const original = draft(data);
  const finishedAt = new Date(Date.parse(performedAt) + 12 * 60_000).toISOString();
  return {
    ...original,
    id: doneId,
    performedAt,
    updatedAt: finishedAt,
    finishedAt,
    status: 'completed',
    position: original.exercises.length,
    exercises: original.exercises.map((exercise) => ({
      ...exercise,
      state: exercise.sourceExerciseId === 'low_row_machine' ? 'skipped' : 'completed',
      completedAt: exercise.sourceExerciseId === 'low_row_machine' ? null : finishedAt,
      skipReason: exercise.sourceExerciseId === 'low_row_machine' ? 'Machine occupied' : null,
      startedAtMs: null,
      elapsedMs: exercise.order === 1 ? 12 * 60_000 : 0,
    })),
    effort: 4,
    backPain: 0,
  };
}

describe('local Fit30 storage', () => {
  beforeEach(async () => {
    await updateData(() => structuredClone(emptyData));
  });

  it('loads saved history and draft timers from a new transaction', async () => {
    const data = configuredData();
    data.sessions = [draft(data), completed(data)];
    const written = await updateData(() => data);

    expect(await readData()).toEqual(written);
    const read = await readData();
    expect(read.data.sessions[0].exercises[0].startedAtMs).not.toBeNull();
    expect(read.data.sessions[1].exercises[2].state).toBe('skipped');
  });

  it('serializes concurrent transactions against the latest data', async () => {
    await Promise.all([
      updateData((data) => ({ ...data, preferences: { ...data.preferences, reminderTime: '07:15' } })),
      updateData((data) => ({ ...data, preferences: { ...data.preferences, remindOnRestDays: true } })),
    ]);

    expect((await readData()).data.preferences).toMatchObject({ reminderTime: '07:15', remindOnRestDays: true });
  });

  it('rejects stale UI writes even when they were started together', async () => {
    const original = await readData();
    const [first, second] = await Promise.allSettled([
      updateData((data) => ({ ...data, preferences: { ...data.preferences, reminderTime: '08:15' } }), original.revision),
      updateData((data) => ({ ...data, preferences: { ...data.preferences, reminderTime: '09:15' } }), original.revision),
    ]);

    expect(first.status).toBe('fulfilled');
    expect(second.status === 'rejected' && second.reason).toBeInstanceOf(DataConflictError);
    expect((await readData()).data.preferences.reminderTime).toBe('08:15');
  });

  it('leaves existing records available after corrupt or incompatible import attempts', async () => {
    const data = configuredData();
    data.sessions = [completed(data)];
    const before = await updateData(() => data);
    const backup = serializeBackup(before.data, nextMonth);

    await expect(updateData((current) => mergeBackup(current, parseBackup('brok{en')))).rejects.toThrow('unreadable');
    await expect(updateData((current) => mergeBackup(current, parseBackup(backup.replace('"version": 1', '"version": 50'))))).rejects.toThrow('different Fit30 version');
    await expect(updateData((current) => mergeBackup(current, parseBackup(backup.replace('low_row_machine', 'wrong_machine'))))).rejects.toThrow('invalid Fit30 records');
    expect(await readData()).toEqual(before);
  });

  it('guards against a backup reusing a workout attempt ID for a different run', async () => {
    const current = configuredData();
    current.sessions = [completed(current)];
    const incoming = configuredData(oldRunId);
    incoming.sessions = [completed(incoming)];
    const before = await updateData(() => current);

    await expect(updateData((data) => mergeBackup(data, incoming, nextMonth))).rejects.toThrow('backup conflicts');
    expect(await readData()).toEqual(before);
  });
});

describe('backup and CSV files', () => {
  it('round-trips measurements, settings and completed workout history', () => {
    const data = configuredData();
    data.sessions = [completed(data)];
    data.measurements = [{ id: measurementId, programRunId: runId, localDate: '2026-11-20', type: 'waist_cm', value: 95.6, createdAt: '2026-11-20T02:30:00.000Z' }];

    expect(parseBackup(serializeBackup(data, nextMonth))).toEqual(data);
    expect(measurementsCsv(data)).toContain('"waist_cm",95.6,');
  });

  it('restores a running exercise at its exported position with its timer paused', () => {
    const data = configuredData();
    const session = draft(data);
    data.sessions = [session];

    const parsed = parseBackup(serializeBackup(data, Date.parse(session.performedAt) + 18_000));

    expect(parsed.sessions[0].exercises[0]).toMatchObject({ elapsedMs: 18_000, startedAtMs: null, state: 'in_progress' });
    expect(data.sessions[0].exercises[0]).toMatchObject({ elapsedMs: 0, startedAtMs: Date.parse(session.performedAt) });
  });

  it('preserves old drafts as partial while switching to the restored program', () => {
    const current = configuredData(oldRunId);
    current.sessions = [draft(current)];
    const incoming = configuredData();
    incoming.sessions = [completed(incoming)];

    const merged = mergeBackup(current, parseBackup(serializeBackup(incoming, nextMonth)), nextMonth);

    expect(merged.activeRunId).toBe(runId);
    expect(merged.runs.find((run) => run.id === oldRunId)?.archivedAt).not.toBeNull();
    expect(merged.sessions).toEqual([expect.objectContaining({ id: sessionId, status: 'partial' }), expect.objectContaining({ id: doneId, status: 'completed' })]);
    expect(merged.sessions[0].exercises[0].startedAtMs).toBeNull();
    expect(appDataSchema.safeParse(merged).success).toBe(true);
  });

  it('deduplicates repeated imports and keeps the later saved attempt', () => {
    const data = configuredData();
    const updated = { ...completed(data), updatedAt: '2026-11-22T06:15:00.000Z', notes: 'Updated notes' };
    data.sessions = [updated];
    const incoming = { ...data, sessions: [completed(data)] };

    expect(mergeBackup(data, incoming, nextMonth).sessions).toEqual([updated]);
    expect(mergeBackup(incoming, data, nextMonth).sessions).toEqual([updated]);
  });

  it('exports actual exercise time, skip status, and safely escaped notes', () => {
    const data = configuredData();
    data.sessions = [{ ...completed(data), notes: '\t=SUM(1,2)\n"second line"' }];

    const output = workoutsCsv(data, nextMonth);

    expect(output).toContain('"completed_with_skips"');
    expect(output).toContain('"completed",600,720,');
    expect(output).toContain('"Low row machine (lower row)","skipped",300,0,');
    expect(output).toContain('"\'\t=SUM(1,2)\n""second line"""');
  });
});

describe('calendar reminders', () => {
  it('exports the canonical gym schedule at the selected Asia/Kolkata time with one alert per event', () => {
    const exported = createCalendarExport(configuredData(), beforeProgram);
    const unfold = exported.text.replaceAll('\r\n ', '');

    expect(exported.eventCount).toBe(26);
    expect(unfold).toContain('DTSTART:20261120T130000Z');
    expect(unfold).toContain('DTSTART:20261219T130000Z');
    expect(unfold).not.toContain('DTSTART:20261126T130000Z');
    expect(unfold).toContain('5 min Low row machine (lower row)');
    expect(unfold.match(/BEGIN:VALARM/g)).toHaveLength(26);
    expect(exported.text.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
  });

  it('skips past reminder times and already completed days', () => {
    const data = configuredData();
    data.sessions = [completed(data, '2026-11-21T06:00:00.000Z')];
    const { eventCount, text } = createCalendarExport(data, Date.parse('2026-11-21T18:00:00.000Z'));

    expect(eventCount).toBe(23);
    expect(text).not.toContain('DTSTART:20261122T130000Z');
    expect(text).toContain('DTSTART:20261123T130000Z');
  });

  it('updates time without changing event IDs and supports opt-in recovery reminders', () => {
    const data = configuredData();
    const first = createCalendarExport(data, beforeProgram);
    const second = createCalendarExport({ ...data, preferences: { ...data.preferences, reminderTime: '20:15' } }, beforeProgram);
    const recovery = createCalendarExport({ ...data, preferences: { ...data.preferences, remindOnRestDays: true } }, beforeProgram);

    expect(second.text).toContain('DTSTART:20261120T144500Z');
    expect(second.text.match(/UID:.+/g)).toEqual(first.text.match(/UID:.+/g));
    expect(recovery.eventCount).toBe(30);
    expect(recovery.text).toContain('Day 7: Recovery day');
  });

  it('resolves daylight-saving folds and gaps in the scheduled timezone', () => {
    const fall = configuredData(runId, '2026-11-01', 'America/New_York');
    fall.preferences.reminderTime = '01:30';
    const spring = configuredData(runId, '2026-03-08', 'America/New_York');
    spring.preferences.reminderTime = '02:30';

    expect(createCalendarExport(fall, Date.parse('2026-10-31T00:00:00Z')).text).toContain('DTSTART:20261101T053000Z');
    expect(createCalendarExport(spring, Date.parse('2026-03-07T00:00:00Z')).text).toContain('DTSTART:20260308T073000Z');
  });

  it('handles a finished schedule and asks for a time before exporting an unset reminder', () => {
    const data = configuredData();
    expect(createCalendarExport(data, Date.parse('2026-12-20T00:00:00Z')).eventCount).toBe(0);
    data.preferences.reminderTime = null;
    expect(() => createCalendarExport(data, beforeProgram)).toThrow('Choose a reminder time');
  });
});
