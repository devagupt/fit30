import { describe, expect, it } from "vitest";
import { exerciseProgress } from "./exerciseProgress";
import { type ProgramRun, type Session } from "./model";
import { daySummary, progressSummary, workoutForToday } from "./progress";
import { getDay } from "./program";
import { createSession, updateSession } from "./workout";

const run: ProgramRun = {
  id: "run",
  startDate: "2026-11-20",
  timezone: "Asia/Kolkata",
  createdAt: "2026-11-20T07:00:00.000Z",
  archivedAt: null,
};

function history(day: number, sessions: Session[], today: string) {
  const planned = getDay(day);
  if (!planned) throw new Error("Fixture day is missing");
  return daySummary(planned, run, sessions, today);
}

function finish(day: number, performedDate: string, id: string, skipAt?: number) {
  const startedAt = Date.parse(`${performedDate}T10:00:00Z`);
  let session = createSession(run, day, startedAt, id);
  for (let index = 0; index < session.exercises.length; index++) {
    const time = startedAt + (index + 1) * 30_000;
    session = updateSession(session, { type: skipAt === index ? "skip" : "done" }, time);
    session = updateSession(session, { type: "startNext" }, time);
  }
  return updateSession(session, { type: "finish" }, startedAt + session.exercises.length * 30_000);
}

describe("history and progress", () => {
  it("links a make-up to its original day and keeps future dates fixed", () => {
    const makeUp = finish(3, "2026-11-24", "make-up", 2);
    expect(makeUp.isMakeUp).toBe(true);
    expect(makeUp.performedAt).toContain("2026-11-24");
    expect(history(3, [makeUp], "2026-11-24")).toMatchObject({
      status: "completed_with_skips", scheduledLocalDate: "2026-11-22", session: makeUp,
    });
    expect(history(4, [makeUp], "2026-11-24")).toMatchObject({ status: "missed", scheduledLocalDate: "2026-11-23" });
    expect(history(6, [makeUp], "2026-11-24")).toMatchObject({ status: "scheduled", scheduledLocalDate: "2026-11-25" });
  });

  it("counts a day once across attempts, labels skips, and separates future completion", () => {
    const attempts = [
      finish(3, "2026-11-22", "first-attempt", 2),
      finish(3, "2026-11-23", "complete-repeat"),
      finish(5, "2026-11-22", "ahead"),
    ];
    expect(history(3, attempts, "2026-11-23").status).toBe("completed");
    expect(progressSummary(run, attempts, "2026-11-23")).toMatchObject({
      completedToDate: 1, scheduledToDate: 4, completedOverall: 2, totalGymDays: 26,
      completedWithSkips: 0, actualSeconds: 420, cardioSeconds: 180, strengthCoreSeconds: 150, recoverySeconds: 90,
    });
  });

  it("keeps Day 7 a rest day, including a completed optional walk", () => {
    const walk = finish(7, "2026-11-26", "walk");
    expect(history(7, [], "2026-11-30").status).toBe("rest");
    expect(history(7, [walk], "2026-11-30")).toMatchObject({ status: "rest", session: walk });
    expect(progressSummary(run, [walk], "2026-11-26")).toMatchObject({
      scheduledToDate: 6, completedToDate: 0, completedOverall: 0, actualSeconds: 30, recoverySeconds: 30,
    });
  });

  it("shows partial workouts distinctly and totals only finished, logged activity", () => {
    const start = Date.parse("2026-11-21T10:00:00Z");
    let partial = createSession(run, 2, start, "partial");
    partial = updateSession(partial, { type: "done" }, start + 90_000);
    partial = updateSession(partial, { type: "savePartial" }, start + 100_000);
    const attempts = [finish(1, "2026-11-20", "old"), partial, finish(3, "2026-11-27", "make-up", 2)];
    expect(history(2, attempts, "2026-11-27").status).toBe("partial");
    expect(progressSummary(run, attempts, "2026-11-27")).toMatchObject({ completedOverall: 2, actualSeconds: 270 });
    expect(progressSummary(run, attempts, "2026-11-27", "last7")).toMatchObject({ actualSeconds: 120, cardioSeconds: 60 });
  });

  it("does not break a scheduled gym streak on rest or before today's workout is due", () => {
    const sessions = [finish(5, "2026-11-24", "day-five"), finish(6, "2026-11-25", "day-six")];
    expect(progressSummary(run, sessions, "2026-11-26").streak).toBe(2);
    expect(progressSummary(run, sessions, "2026-11-27").streak).toBe(2);
    expect(progressSummary(run, sessions, "2026-11-28").streak).toBe(0);
  });
});

describe("today's workout continuation", () => {
  it("offers the missed workout, keeps it on Today once finished, then advances at local midnight", () => {
    const sessions = [finish(1, "2026-11-20", "day-one"), finish(2, "2026-11-21", "day-two")];
    expect(workoutForToday(run, sessions, "2026-11-23")?.day.day_number).toBe(3);
    const makeUp = finish(3, "2026-11-23", "made-up", 2);
    sessions.push(makeUp);
    expect(workoutForToday(run, sessions, "2026-11-23")).toMatchObject({ day: { day_number: 3 }, session: makeUp });
    expect(workoutForToday(run, sessions, "2026-11-24")?.day.day_number).toBe(4);
    expect(history(4, sessions, "2026-11-24").scheduledLocalDate).toBe("2026-11-23");
  });

  it("resumes the last saved session across dates and gives a scheduled rest day priority", () => {
    const startedAt = Date.parse("2026-11-24T10:00:00Z");
    let session = createSession(run, 5, startedAt, "draft");
    session = updateSession(session, { type: "done" }, startedAt + 60_000);
    session = updateSession(session, { type: "savePartial" }, startedAt + 90_000);

    expect(workoutForToday(run, [session], "2026-11-25")).toMatchObject({ day: { day_number: 5 }, session: { id: "draft", position: 1 } });
    expect(workoutForToday(run, [session], "2026-11-26")?.day.day_type).toBe("rest");
    expect(workoutForToday(run, [session], "2026-11-27")?.session).toBe(session);
  });

  it("keeps the remaining workouts available after the calendar ends and recognizes a complete program", () => {
    expect(workoutForToday(run, [], "2026-11-19")).toBeUndefined();
    expect(workoutForToday(run, [], "2026-12-20")?.day.day_number).toBe(1);
    const gymDays = Array.from({ length: 30 }, (_, index) => index + 1).filter((number) => getDay(number)?.day_type === "gym");
    const completed = gymDays.map((day) => finish(day, "2026-12-19", `completed-${day}`));
    expect(workoutForToday(run, completed, "2026-12-20")).toBeUndefined();
  });

  it("offers the next unfinished workout when a newer workout has already been completed", () => {
    const sessions = [finish(1, "2026-11-20", "day-one"), finish(3, "2026-11-22", "day-three")];
    expect(workoutForToday(run, sessions, "2026-11-23")?.day.day_number).toBe(2);
  });
});

describe("exercise analytics", () => {
  it("uses finished entries, measured time, and the same local period as total activity", () => {
    const earliest = finish(1, "2026-11-21", "earliest");
    const boundary = finish(1, "2026-11-22", "boundary");
    const latest = finish(1, "2026-11-28", "latest");
    Object.assign(latest.exercises[0], { actualMinutes: 6.5, distanceKm: 1.25, speedKmh: 6.2 });
    const skipped = finish(3, "2026-11-26", "skipped", 0);
    const partial = { ...finish(2, "2026-11-27", "partial"), status: "partial" as const };
    const future = finish(1, "2026-11-29", "future");
    const archived = { ...finish(1, "2026-11-25", "archived"), programRunId: "earlier-run" };
    const sessions = [earliest, boundary, latest, skipped, partial, future, archived];
    const week = progressSummary(run, sessions, "2026-11-28", "last7");
    const treadmill = exerciseProgress(week.exercises, "treadmill_walk_jog");

    expect(treadmill.history.map((entry) => entry.id)).toEqual(["latest:1", "boundary:1"]);
    expect(treadmill).toMatchObject({ seconds: 420, distanceKm: 1.25, latestSpeedKmh: 6.2, sets: 0, heaviestKg: null });
    expect(week).toMatchObject({ actualSeconds: 780, cardioSeconds: 510, strengthSeconds: 90, coreSeconds: 90, recoverySeconds: 90 });
    expect(exerciseProgress(progressSummary(run, sessions, "2026-11-28").exercises, "treadmill_walk_jog").history).toHaveLength(3);
    expect(exerciseProgress(week.exercises, "stationary_cycling")).toMatchObject({ distanceKm: null, latestSpeedKmh: null });
  });

  it("keeps substitutes, per-side reps and timed holds distinct and only uses completed sets", () => {
    const first = finish(1, "2026-11-20", "plank");
    const second = finish(2, "2026-11-21", "bird");
    const third = finish(3, "2026-11-22", "replacement");
    Object.assign(first.exercises[3].sets[0], { actualValue: 24, completedAt: first.exercises[3].completedAt });
    Object.assign(second.exercises[3].sets[0], { actualValue: 11, completedAt: second.exercises[3].completedAt });
    third.exercises[2].exerciseId = "lat_pulldown";
    Object.assign(third.exercises[2].sets[0], { actualValue: 12, weightKg: 25, completedAt: third.exercises[2].completedAt });
    Object.assign(third.exercises[2].sets[1], { actualValue: 16, weightKg: 50, completedAt: null });
    const { exercises } = progressSummary(run, [first, second, third], "2026-11-22");

    expect(exerciseProgress(exercises, "plank")).toMatchObject({ seconds: 30, longestHold: 24, reps: null, sets: 1 });
    expect(exerciseProgress(exercises, "bird_dog")).toMatchObject({ repsPerSide: 11, longestHold: null, reps: null });
    expect(exerciseProgress(exercises, "lat_pulldown")).toMatchObject({ reps: 12, sets: 1, heaviestKg: 25 });
    expect(exerciseProgress(exercises, "low_row_machine").history).toEqual([]);
  });
});
