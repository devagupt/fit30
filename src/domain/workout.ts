import { isProgramStartDate, isTimeZone, localDate, scheduledDate } from "./dates";
import { newId, prescriptionFor, substitutionIds, type ExerciseLog, type Fit30Data, type ProgramRun, type Session, type SetLog } from "./model";
import { getDay, getExercise, type ExerciseBlock } from "./program";

type PlayerControl = {
  type: "pause" | "resume" | "checkpoint" | "done" | "startNext" | "next" | "previous" | "openTutorial" | "watchTutorial" | "savePartial" | "finish" | "abandon";
};

export const exerciseRestMs = 30_000;

type SetChange = { type: "set"; index: number; actualValue?: number | null; weightKg?: number | null; completed?: boolean };
type CardioChange = { type: "cardio"; actualMinutes?: number | null; distanceKm?: number | null; speedKmh?: number | null };
type DetailsChange = { type: "details"; effort?: number | null; backPain?: number | null; notes?: string };

export type WorkoutAction = { at?: number } & (PlayerControl | SetChange | CardioChange | DetailsChange |
  { type: "skip"; reason?: string } | { type: "substitute"; exerciseId: string });

function planDay(dayNumber: number) {
  const day = getDay(dayNumber);
  if (!day) throw new RangeError("Invalid program day");
  return day;
}

function initialLog(block: ExerciseBlock, exerciseId = block.exercise_id): ExerciseLog {
  const { sets, reps, unit } = prescriptionFor(block, exerciseId);
  const setLogs: SetLog[] = sets !== null && reps !== null && unit !== null
    ? Array.from({ length: sets }, (_, index) => ({
      index: index + 1,
      plannedValue: reps,
      unit,
      actualValue: null,
      weightKg: null,
      completedAt: null,
    })) : [];
  return {
    sourceExerciseId: block.exercise_id,
    exerciseId,
    order: block.order,
    targetDurationSeconds: block.duration_min * 60,
    state: "pending",
    elapsedMs: 0,
    startedAtMs: null,
    completedAt: null,
    sets: setLogs,
    actualMinutes: null,
    distanceKm: null,
    speedKmh: null,
    skipReason: null,
    tutorialWatchedAt: null,
  };
}

export function exerciseElapsedMs(log: ExerciseLog, now = Date.now()): number {
  return log.elapsedMs + (log.startedAtMs === null ? 0 : Math.max(0, now - log.startedAtMs));
}

export function sessionActiveMs(session: Session, now = Date.now()): number {
  return session.exercises.reduce((sum, log) => sum + exerciseElapsedMs(log, now), 0);
}

export function completedExerciseSeconds(log: ExerciseLog): number {
  if (log.state !== "completed") return 0;
  return log.actualMinutes === null ? log.elapsedMs / 1_000 : log.actualMinutes * 60;
}

function editable(log: ExerciseLog | undefined): log is ExerciseLog {
  return log !== undefined && (log.state === "pending" || log.state === "in_progress");
}

function onCurrent(session: Session, edit: (log: ExerciseLog) => ExerciseLog): Session {
  const log = session.exercises[session.position];
  if (!log) return session;
  const changed = edit(log);
  if (changed === log) return session;
  const exercises = session.exercises.slice();
  exercises[session.position] = changed;
  return { ...session, exercises };
}

function startCurrent(session: Session, now: number): Session {
  if (session.restUntilMs !== null) return session;
  return onCurrent(session, (log) => editable(log) && log.startedAtMs === null
    ? { ...log, state: "in_progress", startedAtMs: now }
    : log);
}

function pauseCurrent(session: Session, now: number): Session {
  return onCurrent(session, (log) => log.startedAtMs === null
    ? log
    : { ...log, elapsedMs: exerciseElapsedMs(log, now), startedAtMs: null });
}

export function createSession(run: ProgramRun, dayNumber: number, now = Date.now(), id = newId()): Session {
  const day = planDay(dayNumber);
  const performedAt = new Date(now).toISOString();
  const scheduledLocalDate = scheduledDate(run, dayNumber);
  return startCurrent({
    id,
    programRunId: run.id,
    plannedDayNumber: dayNumber,
    scheduledLocalDate,
    performedAt,
    updatedAt: performedAt,
    finishedAt: null,
    isMakeUp: scheduledLocalDate < localDate(run.timezone, now),
    status: "in_progress",
    position: 0,
    restUntilMs: null,
    exercises: day.exercise_blocks.map((block) => initialLog(block)),
    effort: null,
    backPain: null,
    notes: "",
  }, Date.parse(performedAt));
}

export function allowedSubstitutions(log: ExerciseLog): string[] {
  if (!editable(log) || log.sourceExerciseId !== log.exerciseId || log.sets.some((set) =>
    set.completedAt !== null || set.actualValue !== null || set.weightKg !== null)) return [];
  return substitutionIds(log.sourceExerciseId);
}

function validNumber(value: number | null | undefined, min: number, max: number, whole = false): boolean {
  return value == null || (Number.isFinite(value) && value >= min && value <= max && (!whole || Number.isInteger(value)));
}

function updateSet(log: ExerciseLog, action: SetChange, timestamp: string): ExerciseLog {
  if (!validNumber(action.actualValue, 0, 10_000, true) || !validNumber(action.weightKg, 0, 1_000)) return log;
  const set = log.sets[action.index - 1];
  if (!set) return log;
  let actualValue = action.actualValue === undefined ? set.actualValue : action.actualValue;
  let completedAt = set.completedAt;
  if (action.completed === true) {
    actualValue ??= set.plannedValue;
    completedAt ??= timestamp;
  } else if (action.completed === false || actualValue === null) {
    completedAt = null;
  }
  const weightKg = action.weightKg === undefined ? set.weightKg : action.weightKg;
  if (set.actualValue === actualValue && set.weightKg === weightKg && set.completedAt === completedAt) return log;
  const sets = log.sets.slice();
  sets[action.index - 1] = { ...set, actualValue, weightKg, completedAt };
  return { ...log, sets };
}

function updateCardio(log: ExerciseLog, action: CardioChange): ExerciseLog {
  if (getExercise(log.exerciseId).category !== "cardio" && log.exerciseId !== "optional_walk") return log;
  if (!validNumber(action.actualMinutes, 0, 1_440) || !validNumber(action.distanceKm, 0, 10_000) ||
    !validNumber(action.speedKmh, 0, 1_000)) return log;
  const actualMinutes = action.actualMinutes === undefined ? log.actualMinutes : action.actualMinutes;
  const distanceKm = action.distanceKm === undefined ? log.distanceKm : action.distanceKm;
  const speedKmh = action.speedKmh === undefined ? log.speedKmh : action.speedKmh;
  if (actualMinutes === log.actualMinutes && distanceKm === log.distanceKm && speedKmh === log.speedKmh) return log;
  return { ...log, actualMinutes, distanceKm, speedKmh };
}

function updateDetails(session: Session, action: DetailsChange): Session {
  if (!validNumber(action.effort, 1, 10, true) || !validNumber(action.backPain, 0, 10, true) ||
    (action.notes?.length ?? 0) > 2_000) return session;
  const effort = action.effort === undefined ? session.effort : action.effort;
  const backPain = action.backPain === undefined ? session.backPain : action.backPain;
  const notes = action.notes ?? session.notes;
  if (effort === session.effort && backPain === session.backPain && notes === session.notes) return session;
  return { ...session, effort, backPain, notes };
}

function visit(session: Session, position: number, now: number, start: boolean): Session {
  if (position === session.position || position < 0 || position > session.exercises.length) return session;
  const moved = { ...pauseCurrent(session, now), position, restUntilMs: null };
  return start ? startCurrent(moved, now) : moved;
}

export function canFinish(session: Session): boolean {
  return session.exercises.some((log) => log.state === "completed") && session.exercises.every((log) => !editable(log));
}

function discardAttempt(session: Session, timestamp: string): Session {
  return {
    ...session,
    status: "abandoned",
    finishedAt: timestamp,
    exercises: planDay(session.plannedDayNumber).exercise_blocks.map((block) => initialLog(block)),
    position: 0,
    restUntilMs: null,
    effort: null,
    backPain: null,
    notes: "",
  };
}

function applyAction(session: Session, action: WorkoutAction, now: number, timestamp: string): Session {
  if (session.status === "completed" || session.status === "abandoned") return session;
  if (action.type === "abandon") return discardAttempt(session, timestamp);
  if (session.status === "partial") {
    return action.type === "resume" ? startCurrent({ ...session, status: "in_progress", finishedAt: null }, now) : session;
  }
  if (session.restUntilMs !== null && ["done", "skip", "substitute", "set", "cardio", "next"].includes(action.type)) {
    return session;
  }

  const current = session.exercises[session.position];
  switch (action.type) {
    case "pause":
    case "openTutorial":
      return pauseCurrent(session, now);
    case "watchTutorial":
      return onCurrent(session, (log) => ({ ...log, tutorialWatchedAt: timestamp }));
    case "resume":
      return startCurrent(session, now);
    case "startNext":
      return session.restUntilMs === null ? session : startCurrent({ ...session, restUntilMs: null }, now);
    case "checkpoint":
      return onCurrent(session, (log) => log.startedAtMs !== null && now > log.startedAtMs
        ? { ...log, elapsedMs: exerciseElapsedMs(log, now), startedAtMs: now }
        : log);
    case "previous":
      return visit(session, session.position - 1, now, false);
    case "next":
      return visit(session, session.position + 1, now, true);
    case "done":
    case "skip": {
      if (!editable(current)) return session;
      const done = action.type === "done";
      const marked = onCurrent(pauseCurrent(session, now), (log) => ({
        ...log,
        state: done ? "completed" : "skipped",
        completedAt: done ? timestamp : null,
        skipReason: action.type === "skip" ? action.reason?.trim().slice(0, 500) || null : null,
      }));
      const next = visit(marked, session.position + 1, now, false);
      return done && editable(next.exercises[next.position])
        ? { ...next, restUntilMs: now + exerciseRestMs }
        : startCurrent(next, now);
    }
    case "substitute": {
      const block = planDay(session.plannedDayNumber).exercise_blocks[session.position];
      if (!current || !block || !allowedSubstitutions(current).includes(action.exerciseId)) return session;
      const edited = onCurrent(session, () => initialLog(block, action.exerciseId));
      return current.startedAtMs === null ? edited : startCurrent(edited, now);
    }
    case "set":
      return editable(current) ? onCurrent(session, (log) => updateSet(log, action, timestamp)) : session;
    case "cardio":
      return editable(current) ? onCurrent(session, (log) => updateCardio(log, action)) : session;
    case "details":
      return updateDetails(session, action);
    case "savePartial":
      return { ...pauseCurrent(session, now), status: "partial", finishedAt: timestamp };
    case "finish":
      return canFinish(session) ? { ...pauseCurrent(session, now), status: "completed", finishedAt: timestamp } : session;
  }
}

export function updateSession(session: Session, action: WorkoutAction, now = Date.now()): Session {
  if (action.at !== undefined && action.at !== session.position) return session;
  const eventTime = Math.max(Math.trunc(now), Date.parse(session.updatedAt));
  const updatedAt = new Date(eventTime).toISOString();
  const changed = applyAction(session, action, eventTime, updatedAt);
  return changed === session ? session : { ...changed, updatedAt };
}

export function activeWorkout(data: Fit30Data): Session | undefined {
  return data.sessions.reduce<Session | undefined>((selected, session) => {
    if (session.programRunId !== data.activeRunId || session.status !== "in_progress") return selected;
    return !selected || session.updatedAt >= selected.updatedAt ? session : selected;
  }, undefined);
}

export function recoverOpenWorkout(data: Fit30Data): Fit30Data {
  const selected = activeWorkout(data);
  if (!selected) return data;
  let changed = false;
  const sessions = data.sessions.map((session) => {
    if (session.status !== "in_progress") return session;
    const action = session.id === selected.id ? "pause" : "savePartial";
    const restored = updateSession(session, { type: action }, Date.parse(session.updatedAt));
    changed ||= restored !== session;
    return restored;
  });
  return changed ? { ...data, sessions } : data;
}

export function startProgram(data: Fit30Data, startDate: string, timezone: string, now = Date.now(), id = newId()): Fit30Data {
  if (!isProgramStartDate(startDate) || !isTimeZone(timezone)) throw new RangeError("Choose a valid start date and time zone");
  if (data.runs.some((run) => run.id === id)) throw new Error("Program run ID already exists");
  const createdAt = new Date(now).toISOString();
  const run: ProgramRun = { id, startDate, timezone, createdAt, archivedAt: null };
  return {
    ...data,
    activeRunId: id,
    runs: [...data.runs.map((entry) => entry.archivedAt === null
      ? { ...entry, archivedAt: entry.createdAt > createdAt ? entry.createdAt : createdAt }
      : entry), run],
    sessions: data.sessions.map((session) => session.status === "in_progress"
      ? updateSession(session, { type: "savePartial" }, now) : session),
    preferences: { ...data.preferences, timezone },
  };
}
