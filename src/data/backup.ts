import { z } from 'zod';
import { appDataSchema, type Fit30Data, type Session } from '../domain/model';
import { program } from '../domain/program';
import { exerciseElapsedMs } from '../domain/workout';

const backupFormat = 'fit30-backup';
const backupVersion = 1;

const envelopeSchema = z.strictObject({
  format: z.literal(backupFormat),
  version: z.literal(backupVersion),
  programId: z.literal(program.program_id),
  programVersion: z.literal(program.schema_version),
  exportedAt: z.iso.datetime({ precision: 3 }),
  data: appDataSchema,
});

function pauseTimer(session: Session, now: number): Session {
  if (!session.exercises.some((exercise) => exercise.startedAtMs !== null)) return session;

  return {
    ...session,
    exercises: session.exercises.map((exercise) => exercise.startedAtMs === null ? exercise : {
      ...exercise,
      elapsedMs: exerciseElapsedMs(exercise, now),
      startedAtMs: null,
    }),
  };
}

export function serializeBackup(data: Fit30Data, now = Date.now()): string {
  const backup = {
    format: backupFormat,
    version: backupVersion,
    programId: program.program_id,
    programVersion: program.schema_version,
    exportedAt: new Date(now).toISOString(),
    data: { ...data, sessions: data.sessions.map((session) => pauseTimer(session, now)) },
  };

  return JSON.stringify(backup, null, 2);
}

export function parseBackup(text: string): Fit30Data {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('This file is unreadable. Choose a Fit30 JSON backup.');
  }

  if (typeof raw !== 'object' || raw === null || !('format' in raw) || raw.format !== backupFormat) {
    throw new Error('Choose a JSON backup exported by Fit30.');
  }

  if (!('version' in raw) || raw.version !== backupVersion ||
      !('programVersion' in raw) || raw.programVersion !== program.schema_version) {
    throw new Error('This backup uses a different Fit30 version. Choose a backup from this version of the app.');
  }

  const parsed = envelopeSchema.safeParse(raw);
  if (!parsed.success) throw new Error('This backup contains invalid Fit30 records. Choose another Fit30 backup.');

  const { data, exportedAt } = parsed.data;
  return { ...data, sessions: data.sessions.map((session) => pauseTimer(session, Date.parse(exportedAt))) };
}

export function mergeBackup(current: Fit30Data, incoming: Fit30Data, now = Date.now()): Fit30Data {
  const timestamp = new Date(now).toISOString();
  const activeRunId = incoming.activeRunId ?? current.activeRunId;
  const conflictingBackup = 'This backup conflicts with records on this device. Keep both backup files and restore them in separate browser profiles.';

  const runs = new Map(current.runs.map((run) => [run.id, run]));
  for (const run of incoming.runs) {
    const existing = runs.get(run.id);
    if (existing && existing.createdAt !== run.createdAt) throw new Error(conflictingBackup);
    if (!existing || run.id === incoming.activeRunId) runs.set(run.id, run);
  }

  const sessions = new Map(current.sessions.map((session) => [session.id, session]));
  for (const session of incoming.sessions) {
    const existing = sessions.get(session.id);
    if (existing && (existing.programRunId !== session.programRunId || existing.plannedDayNumber !== session.plannedDayNumber ||
      existing.performedAt !== session.performedAt)) throw new Error(conflictingBackup);
    if (!existing || session.updatedAt > existing.updatedAt) {
      sessions.set(session.id, pauseTimer(session, Date.parse(session.updatedAt)));
    }
  }

  const measurements = new Map(current.measurements.map((measurement) => [measurement.id, measurement]));
  for (const measurement of incoming.measurements) {
    const existing = measurements.get(measurement.id);
    if (existing && (existing.programRunId !== measurement.programRunId || existing.type !== measurement.type ||
      existing.localDate !== measurement.localDate || existing.createdAt !== measurement.createdAt)) throw new Error(conflictingBackup);
    if (!existing) measurements.set(measurement.id, measurement);
  }

  const merged: Fit30Data = {
    activeRunId,
    preferences: incoming.activeRunId ? incoming.preferences : current.preferences,
    runs: Array.from(runs.values(), (run) => ({
      ...run,
      archivedAt: run.id === activeRunId ? null : run.archivedAt ?? (timestamp > run.createdAt ? timestamp : run.createdAt),
    })),
    sessions: Array.from(sessions.values(), (session) => {
      if (session.programRunId === activeRunId || session.status !== 'in_progress') return session;
      const finishedAt = timestamp > session.updatedAt ? timestamp : session.updatedAt;
      return {
        ...pauseTimer(session, now),
        status: 'partial',
        updatedAt: finishedAt,
        finishedAt,
      };
    }),
    measurements: Array.from(measurements.values()),
  };

  const parsed = appDataSchema.safeParse(merged);
  if (!parsed.success) throw new Error(conflictingBackup);

  return parsed.data;
}
