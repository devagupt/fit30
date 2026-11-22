import { addDays, dayNumberOn, localDate, scheduledDate } from "./dates";
import type { ExerciseLog, ProgramRun, Session } from "./model";
import { getDay, getExercise, program, type ProgramDay } from "./program";
import { isGymClosed } from "./schedule";
import { completedExerciseSeconds } from "./workout";

export type DayStatus = "scheduled" | "in_progress" | "partial" | "completed" | "completed_with_skips" | "missed" | "rest";
export type ActivityPeriod = "all" | "last7";

export type DaySummary = {
  status: DayStatus;
  session: Session | undefined;
  scheduledLocalDate: string;
};

function hasSkips(session: Session): boolean {
  return session.exercises.some((log) => log.state === "skipped");
}

function rank(session: Session): number {
  if (session.status === "completed") return hasSkips(session) ? 3 : 4;
  return session.status === "in_progress" ? 2 : 1;
}

export function daySummary(day: ProgramDay, run: ProgramRun, sessions: Session[], today: string): DaySummary {
  const scheduledLocalDate = scheduledDate(run, day.day_number);
  const session = sessions.filter((attempt) => attempt.programRunId === run.id &&
    attempt.plannedDayNumber === day.day_number && attempt.status !== "abandoned")
    .sort((left, right) => rank(right) - rank(left) || right.updatedAt.localeCompare(left.updatedAt))[0];

  if (day.day_type === "rest") return { scheduledLocalDate, session, status: "rest" };
  if (session?.status === "completed") return { scheduledLocalDate, session, status: hasSkips(session) ? "completed_with_skips" : "completed" };
  if (session?.status === "in_progress" || session?.status === "partial") return { scheduledLocalDate, session, status: session.status };
  return { scheduledLocalDate, session: undefined, status: scheduledLocalDate < today ? "missed" : "scheduled" };
}

function isResumable(session: Session): boolean {
  return session.status === "in_progress" ||
    (session.status === "partial" && session.exercises.some((log) => log.state !== "skipped"));
}

export function workoutForToday(run: ProgramRun, sessions: Session[], today: string): { day: ProgramDay; session?: Session } | undefined {
  if (today < run.startDate) return undefined;

  const dayNumber = dayNumberOn(run, today);
  const scheduled = dayNumber === null ? undefined : getDay(dayNumber);
  const runSessions = sessions.filter((session) => session.programRunId === run.id);
  if (scheduled?.day_type === "rest") {
    const eligibleWalks = runSessions.filter((session) => session.status === "completed" || isResumable(session));
    return { day: scheduled, session: daySummary(scheduled, run, eligibleWalks, today).session };
  }
  if (isGymClosed(run, today)) return undefined;

  const attempts = runSessions.flatMap((session) => {
    const day = getDay(session.plannedDayNumber);
    return day?.day_type === "gym" ? [{ day, session }] : [];
  }).sort((left, right) => right.session.updatedAt.localeCompare(left.session.updatedAt));
  const completed = attempts.filter(({ session }) => session.status === "completed");
  const finishedToday = completed.find(({ session }) =>
    session.finishedAt && localDate(run.timezone, Date.parse(session.finishedAt)) === today);
  if (finishedToday) return finishedToday;

  const completedDays = new Set(completed.map(({ day }) => day.day_number));
  const resumable = attempts.find(({ day, session }) => !completedDays.has(day.day_number) && isResumable(session));
  if (resumable) return resumable;

  const next = program.days.find((day) => day.day_type === "gym" && !completedDays.has(day.day_number) &&
    scheduledDate(run, day.day_number) <= today);
  return next ? { day: next } : undefined;
}

function isCompleted(day: DaySummary): boolean {
  return day.status === "completed" || day.status === "completed_with_skips";
}

function completedStreak(days: DaySummary[], today: string): number {
  let count = 0;
  for (const day of days.slice().reverse()) {
    if (day.scheduledLocalDate === today && !isCompleted(day)) continue;
    if (!isCompleted(day)) break;
    count++;
  }
  return count;
}

export type CompletedExercise = {
  sessionId: string;
  date: string;
  completedAt: string;
  seconds: number;
  log: ExerciseLog;
};

function completedExercises(run: ProgramRun, sessions: Session[], today: string, period: ActivityPeriod): CompletedExercise[] {
  const firstDate = period === "last7" ? addDays(today, -6) : null;
  const exercises: CompletedExercise[] = [];
  for (const session of sessions) {
    if (session.programRunId !== run.id || session.status !== "completed") continue;
    for (const log of session.exercises) {
      if (!log.completedAt || log.state !== "completed") continue;
      const date = localDate(run.timezone, Date.parse(log.completedAt));
      if (date > today || (firstDate && date < firstDate)) continue;
      exercises.push({ sessionId: session.id, date, completedAt: log.completedAt, seconds: completedExerciseSeconds(log), log });
    }
  }
  return exercises;
}

function activityTotals(exercises: CompletedExercise[]) {
  const buckets = { cardio: 0, strength: 0, core: 0, core_glutes: 0, recovery: 0 };
  for (const { log, seconds } of exercises) buckets[getExercise(log.exerciseId).category] += seconds;
  const coreSeconds = buckets.core + buckets.core_glutes;
  const strengthCoreSeconds = buckets.strength + coreSeconds;
  return {
    cardioSeconds: buckets.cardio,
    strengthSeconds: buckets.strength,
    coreSeconds,
    strengthCoreSeconds,
    recoverySeconds: buckets.recovery,
    actualSeconds: buckets.cardio + strengthCoreSeconds + buckets.recovery,
  };
}

export function progressSummary(run: ProgramRun, sessions: Session[], today: string, period: ActivityPeriod = "all") {
  const gymDays = program.days.filter((day) => day.day_type === "gym").map((day) => daySummary(day, run, sessions, today));
  const throughToday = gymDays.filter((day) => day.scheduledLocalDate <= today);
  const exercises = completedExercises(run, sessions, today, period);
  return {
    scheduledToDate: throughToday.length,
    completedToDate: throughToday.filter(isCompleted).length,
    completedOverall: gymDays.filter(isCompleted).length,
    totalGymDays: gymDays.length,
    streak: completedStreak(throughToday, today),
    completedWithSkips: gymDays.filter((day) => day.status === "completed_with_skips").length,
    exercises,
    ...activityTotals(exercises),
  };
}
