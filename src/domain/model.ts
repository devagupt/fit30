import { z } from "zod";
import { isLocalDate, isProgramStartDate, isTimeZone, scheduledDate, weekdayOn, weekdays } from "./dates";
import { getDay, getExercise, program, type ExerciseBlock } from "./program";

const id = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const timestamp = z.iso.datetime({ precision: 3 });
const date = z.string().refine(isLocalDate, "Invalid local calendar date");
const timezone = z.string().refine(isTimeZone, "Invalid time zone");
const position = z.number().int().nonnegative();
const milliseconds = z.number().int().nonnegative();
const positiveInt = z.number().int().positive();

export const preferencesSchema = z.object({
  timezone,
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected a local time in HH:mm format").nullable(),
  remindOnRestDays: z.boolean(),
  remindersEnabled: z.boolean().default(false),
  sound: z.boolean(),
  vibration: z.boolean(),
}).strict();

const runSchema = z.object({
  id,
  startDate: z.string().refine(isProgramStartDate, "Invalid program start date"),
  timezone,
  createdAt: timestamp,
  archivedAt: timestamp.nullable(),
  schedule: z.object({
    closedWeekday: z.enum(weekdays),
    effectiveFrom: date,
    dates: z.array(date).length(program.program_duration_days),
  }).strict().optional(),
}).strict().superRefine((run, context) => {
  const { schedule } = run;
  if (!schedule || schedule.dates.length !== program.program_duration_days || !schedule.dates.every(isLocalDate)) return;
  const { dates, closedWeekday, effectiveFrom } = schedule;
  const last = { gym: '', rest: '' };
  const consistent = program.days.every((day, index) => {
    const value = dates[index];
    const ordered = value > last[day.day_type];
    last[day.day_type] = value;
    return ordered && value >= run.startDate && (value < effectiveFrom ||
      (weekdayOn(value) === closedWeekday) === (day.day_type === 'rest'));
  });
  if (effectiveFrom < run.startDate || new Set(dates).size !== dates.length || !consistent) {
    context.addIssue({ code: 'custom', message: 'Program dates must be unique and follow the chosen recovery schedule', path: ['schedule'] });
  }
});

const setSchema = z.object({
  index: positiveInt,
  plannedValue: positiveInt,
  unit: z.enum(["repetitions", "repetitions_per_side", "seconds_hold"]),
  actualValue: z.number().int().min(0).max(10_000).nullable(),
  weightKg: z.number().min(0).max(1_000).nullable(),
  completedAt: timestamp.nullable(),
}).strict();

const exerciseLogSchema = z.object({
  sourceExerciseId: id,
  exerciseId: id,
  order: positiveInt,
  targetDurationSeconds: positiveInt,
  state: z.enum(["pending", "in_progress", "completed", "skipped"]),
  elapsedMs: milliseconds,
  startedAtMs: milliseconds.nullable(),
  completedAt: timestamp.nullable(),
  sets: z.array(setSchema),
  actualMinutes: z.number().min(0).max(1_440).nullable(),
  distanceKm: z.number().min(0).max(10_000).nullable(),
  speedKmh: z.number().min(0).max(1_000).nullable(),
  skipReason: z.string().max(500).nullable(),
  tutorialWatchedAt: timestamp.nullable(),
}).strict();

const sessionSchema = z.object({
  id,
  programRunId: id,
  plannedDayNumber: z.number().int().min(1).max(program.program_duration_days),
  scheduledLocalDate: date,
  performedAt: timestamp,
  updatedAt: timestamp,
  finishedAt: timestamp.nullable(),
  isMakeUp: z.boolean(),
  status: z.enum(["in_progress", "partial", "completed", "abandoned"]),
  position,
  restUntilMs: milliseconds.nullable().default(null),
  exercises: z.array(exerciseLogSchema).min(1).max(5),
  effort: z.number().int().min(1).max(10).nullable(),
  backPain: z.number().int().min(0).max(10).nullable(),
  notes: z.string().max(2_000),
}).strict();

const measurementSchema = z.object({
  id,
  programRunId: id,
  localDate: date,
  type: z.enum(["waist_cm", "weight_kg"]),
  value: z.number().positive().max(1_000),
  createdAt: timestamp,
}).strict();

export type Preferences = z.infer<typeof preferencesSchema>;
export type ProgramRun = z.infer<typeof runSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type ExerciseLog = z.infer<typeof exerciseLogSchema>;
export type SetLog = z.infer<typeof setSchema>;
export type Measurement = z.infer<typeof measurementSchema>;

export function substitutionIds(sourceExerciseId: string): string[] {
  return sourceExerciseId === "low_row_machine" ? ["lat_pulldown"] : [];
}

export function prescriptionFor(block: ExerciseBlock, exerciseId: string) {
  if (exerciseId === block.exercise_id) {
    return { sets: block.sets, reps: block.reps, unit: block.reps_unit };
  }
  return getExercise(exerciseId).default_prescription;
}

const dataRecord = z.object({
  activeRunId: id.nullable(),
  runs: z.array(runSchema),
  sessions: z.array(sessionSchema),
  measurements: z.array(measurementSchema),
  preferences: preferencesSchema,
}).strict();

export type Fit30Data = z.infer<typeof dataRecord>;

function checkLog(log: ExerciseLog, block: ExerciseBlock): string | null {
  if (log.sourceExerciseId !== block.exercise_id || log.order !== block.order || log.targetDurationSeconds !== block.duration_min * 60) {
    return "Logged block must match the prescribed exercise, order, and budget";
  }
  if (log.exerciseId !== block.exercise_id && !substitutionIds(block.exercise_id).includes(log.exerciseId)) {
    return "Unknown or unsupported replacement exercise";
  }
  const target = prescriptionFor(block, log.exerciseId);
  if (log.sets.length !== (target.sets ?? 0) || log.sets.some((set, index) =>
    set.index !== index + 1 || set.plannedValue !== target.reps || set.unit !== target.unit ||
    (set.completedAt !== null && set.actualValue === null))) {
    return "Logged sets must match the prescribed targets and units";
  }
  if ((log.state === "completed") !== (log.completedAt !== null) || (log.state !== "skipped" && log.skipReason !== null)) {
    return "Exercise status does not match recorded completion or skip details";
  }
  return null;
}

export const appDataSchema = dataRecord.superRefine((data, context) => {
  const issue = (message: string, path: (string | number)[]) => context.addIssue({ code: "custom", message, path });
  const runById = new Map(data.runs.map((run) => [run.id, run]));
  const activeRuns = data.runs.filter((run) => run.archivedAt === null);
  if (runById.size !== data.runs.length || data.runs.some((run) => run.archivedAt !== null && run.archivedAt < run.createdAt)) {
    issue("Program runs must have unique IDs and valid archive dates", ["runs"]);
  }
  if (activeRuns.length > 1 || data.activeRunId !== (activeRuns[0]?.id ?? null)) {
    issue("Active run reference must match the single unarchived run", ["activeRunId"]);
  }

  let runningTimers = 0;
  const sessionIds = new Set<string>();
  data.sessions.forEach((session, index) => {
    const path = ["sessions", index];
    const run = runById.get(session.programRunId);
    const day = getDay(session.plannedDayNumber);
    if (sessionIds.has(session.id)) issue("Duplicate workout attempt ID", [...path, "id"]);
    sessionIds.add(session.id);
    if (!run || !day || !isProgramStartDate(run.startDate) || session.scheduledLocalDate !== scheduledDate(run, session.plannedDayNumber)) {
      issue("Workout attempt must reference its original scheduled program date", path);
      return;
    }
    if (session.updatedAt < session.performedAt || (session.finishedAt &&
      (session.finishedAt < session.performedAt || session.finishedAt > session.updatedAt)) ||
      (session.status === "in_progress") !== (session.finishedAt === null) ||
      (run.archivedAt !== null && session.status === "in_progress")) {
      issue("Workout attempt status and timestamps are inconsistent", path);
    }
    if (session.exercises.length !== day.exercise_blocks.length || session.position > session.exercises.length) {
      issue("Workout attempt must contain the full set of planned blocks and a valid current position", [...path, "exercises"]);
    }
    if (session.restUntilMs !== null) {
      const previous = session.exercises[session.position - 1];
      const next = session.exercises[session.position];
      if ((session.status !== "in_progress" && session.status !== "partial") ||
        previous?.state !== "completed" || !next || (next.state !== "pending" && next.state !== "in_progress") ||
        next.startedAtMs !== null || session.restUntilMs < Date.parse(session.performedAt)) {
        issue("A rest break must lead from a completed exercise to an open exercise with its timer stopped", [...path, "restUntilMs"]);
      }
    }
    session.exercises.forEach((log, logIndex) => {
      const logPath = [...path, "exercises", logIndex];
      const block = day.exercise_blocks[logIndex];
      const invalid = block ? checkLog(log, block) : "Unexpected exercise block";
      if (invalid) issue(invalid, logPath);
      if (log.startedAtMs !== null) {
        runningTimers++;
        if (session.status !== "in_progress" || log.state !== "in_progress" || session.position !== logIndex ||
          log.startedAtMs < Date.parse(session.performedAt) || log.startedAtMs > Date.parse(session.updatedAt)) {
          issue("Running timer must belong to the current exercise of an active attempt", [...logPath, "startedAtMs"]);
        }
      }
    });
    if (session.status === "completed" &&
      (!session.exercises.some((log) => log.state === "completed") ||
        session.exercises.some((log) => log.state !== "completed" && log.state !== "skipped"))) {
      issue("Completed workout attempts require resolved blocks and at least one completed exercise", [...path, "status"]);
    }
  });
  if (runningTimers > 1) issue("Only one workout timer can be running", ["sessions"]);

  const measurementIds = new Set<string>();
  data.measurements.forEach((measurement, index) => {
    if (measurementIds.has(measurement.id) || !runById.has(measurement.programRunId)) {
      issue("Measurement must have a unique ID and reference an existing run", ["measurements", index]);
    }
    measurementIds.add(measurement.id);
  });
});

export const emptyData: Fit30Data = {
  activeRunId: null,
  runs: [],
  sessions: [],
  measurements: [],
  preferences: {
    timezone: program.timezone,
    reminderTime: null,
    remindOnRestDays: false,
    remindersEnabled: false,
    sound: false,
    vibration: false,
  },
};

export function newId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
