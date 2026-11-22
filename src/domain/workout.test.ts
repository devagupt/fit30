import { describe, expect, it } from "vitest";
import { appDataSchema, emptyData, type Session } from "./model";
import { allowedSubstitutions, canFinish, completedExerciseSeconds, createSession, exerciseElapsedMs, recoverOpenWorkout, sessionActiveMs, startProgram, updateSession } from "./workout";

const now = Date.parse("2026-11-22T09:00:00.000Z");
const data = startProgram(emptyData, "2026-11-20", "Asia/Kolkata", now, "first-run");
const run = data.runs[0];
if (!run) throw new Error("Fixture program failed to initialize");

function current(session: Session) {
  const log = session.exercises[session.position];
  if (!log) throw new Error("No current exercise");
  return log;
}

function completeAndAdvance(session: Session, time: number) {
  return updateSession(updateSession(session, { type: "done" }, time), { type: "startNext" }, time);
}

describe("workout session", () => {
  it("handles pause, reload, overtime and explicit exercise completion", () => {
    const started = createSession(run, 3, now, "first-workout");
    const late = now + 650_000;
    expect(exerciseElapsedMs(current(started), late)).toBe(650_000);
    expect(current(started).state).toBe("in_progress");
    expect(started.position).toBe(0);

    const paused = updateSession(started, { type: "pause" }, late);
    const restored = appDataSchema.parse(JSON.parse(JSON.stringify({ ...data, sessions: [paused] }))).sessions[0];
    if (!restored) throw new Error("Saved workout could not be restored");
    expect(exerciseElapsedMs(current(restored), late + 45_000)).toBe(650_000);
    const resumed = updateSession(restored, { type: "resume" }, late + 45_000);
    expect(exerciseElapsedMs(current(resumed), late + 60_000)).toBe(665_000);

    const next = updateSession(resumed, { type: "done", at: 0 }, late + 60_000);
    expect(next.position).toBe(1);
    expect(next.exercises[0]).toMatchObject({ state: "completed", elapsedMs: 665_000, startedAtMs: null });
    expect(current(next).exerciseId).toBe("stationary_cycling");
    expect(current(next).startedAtMs).toBeNull();
    expect(next.restUntilMs).toBe(late + 90_000);
    expect(updateSession(next, { type: "done", at: 0 }, late + 60_000)).toBe(next);
  });

  it("reopens a legacy running workout paused at its last checkpoint", () => {
    const start = createSession(run, 1, now);
    const checkpoint = updateSession(start, { type: "checkpoint" }, now + 12_000);
    expect(current(checkpoint)).toMatchObject({ elapsedMs: 12_000, startedAtMs: now + 12_000 });
    const legacy = Object.fromEntries(Object.entries(checkpoint).filter(([key]) => key !== "restUntilMs"));
    const stored = appDataSchema.parse({ ...data, sessions: [legacy] });
    const [reopened] = recoverOpenWorkout(stored).sessions;
    if (!reopened) throw new Error("Missing restored workout");
    expect(reopened.position).toBe(0);
    expect(reopened.restUntilMs).toBeNull();
    expect(current(reopened)).toMatchObject({ elapsedMs: 12_000, startedAtMs: null, state: "in_progress" });
  });

  it("persists a rest break and starts the next timer only on request", () => {
    const initial = createSession(run, 1, now);
    const resting = updateSession(initial, { type: "done" }, now + 60_000);
    const saved = updateSession(resting, { type: "savePartial" }, now + 70_000);
    const [loaded] = appDataSchema.parse({ ...data, sessions: [saved] }).sessions;
    if (!loaded) throw new Error("Missing saved rest break");
    const resumed = updateSession(loaded, { type: "resume" }, now + 120_000);
    expect(resumed.restUntilMs).toBe(now + 90_000);
    expect(current(resumed).startedAtMs).toBeNull();
    expect(sessionActiveMs(resumed, now + 120_000)).toBe(60_000);
    expect(updateSession(resumed, { type: "done" }, now + 120_000)).toBe(resumed);
    const next = updateSession(resumed, { type: "startNext" }, now + 125_000);
    expect(next.restUntilMs).toBeNull();
    expect(current(next).startedAtMs).toBe(now + 125_000);
    expect(sessionActiveMs(next, now + 130_000)).toBe(65_000);
  });

  it("keeps position and active time while learning the low row", () => {
    let session = createSession(run, 3, now);
    session = completeAndAdvance(session, now + 5_000);
    session = completeAndAdvance(session, now + 10_000);
    expect(current(session).exerciseId).toBe("low_row_machine");
    session = updateSession(session, { type: "openTutorial" }, now + 15_000);
    session = updateSession(session, { type: "watchTutorial" }, now + 20_000);
    expect(session.position).toBe(2);
    expect(current(session).tutorialWatchedAt).toBe(new Date(now + 20_000).toISOString());
    expect(exerciseElapsedMs(current(session), now + 120_000)).toBe(5_000);
    expect(sessionActiveMs(session, now + 120_000)).toBe(15_000);
    session = updateSession(session, { type: "resume" }, now + 120_000);
    expect(exerciseElapsedMs(current(session), now + 125_000)).toBe(10_000);
  });

  it("finishes Day 3 with a skipped row only after explicit confirmation", () => {
    let session = createSession(run, 3, now);
    session = completeAndAdvance(session, now + 20_000);
    session = completeAndAdvance(session, now + 40_000);
    expect(updateSession(session, { type: "finish" }, now + 41_000)).toBe(session);
    session = updateSession(session, { type: "skip", reason: "Machine occupied" }, now + 60_000);
    session = updateSession(session, { type: "set", index: 1, actualValue: 8, completed: true }, now + 70_000);
    expect(current(session).sets[0]).toMatchObject({ plannedValue: 10, actualValue: 8, unit: "repetitions" });
    session = completeAndAdvance(session, now + 80_000);
    session = updateSession(session, { type: "done" }, now + 100_000);
    expect(canFinish(session)).toBe(true);
    expect(session.status).toBe("in_progress");
    session = updateSession(session, { type: "details", effort: 6, backPain: 0, notes: "Felt steady" }, now + 110_000);
    session = updateSession(session, { type: "finish" }, now + 111_000);
    expect(session.status).toBe("completed");
    expect(session.exercises.map((log) => log.state)).toEqual(["completed", "completed", "skipped", "completed", "completed"]);
    expect(session.exercises[2]).toMatchObject({ sourceExerciseId: "low_row_machine", skipReason: "Machine occupied", completedAt: null });
    expect(appDataSchema.safeParse({ ...data, sessions: [session] }).success).toBe(true);
  });

  it("keeps completed sets separate from navigation and workout outcomes", () => {
    let session = createSession(run, 1, now);
    session = updateSession(session, { type: "next" }, now + 1_000);
    session = updateSession(session, { type: "next" }, now + 2_000);
    session = updateSession(session, { type: "set", index: 1, completed: true, weightKg: 12.5 }, now + 3_000);
    expect(current(session).sets[0]).toMatchObject({ actualValue: 10, weightKg: 12.5 });
    expect(current(session).sets[1]?.completedAt).toBeNull();
    expect(current(session).state).toBe("in_progress");
    session = updateSession(session, { type: "previous" }, now + 4_000);
    expect(session.position).toBe(1);
    expect(current(session).startedAtMs).toBeNull();
    session = updateSession(session, { type: "savePartial" }, now + 5_000);
    expect(session.status).toBe("partial");
    session = updateSession(session, { type: "resume" }, now + 50_000);
    expect(current(session).elapsedMs).toBe(1_000);
    expect(current(session).startedAtMs).toBe(now + 50_000);
    expect(session.exercises[2]?.sets[0]?.weightKg).toBe(12.5);
    session = updateSession(session, { type: "abandon" }, now + 55_000);
    expect(session.status).toBe("abandoned");
    expect(session.exercises[2]?.sets[0]?.weightKg).toBeNull();
    expect(sessionActiveMs(session)).toBe(0);
  });

  it("requires an explicit, supported substitution and keeps the original block", () => {
    let session = createSession(run, 3, now);
    session = updateSession(session, { type: "next" }, now + 1_000);
    session = updateSession(session, { type: "next" }, now + 2_000);
    const original = current(session);
    expect(original.exerciseId).toBe("low_row_machine");
    expect(allowedSubstitutions(original)).toEqual(["lat_pulldown"]);
    expect(updateSession(session, { type: "substitute", exerciseId: "generic_row" }, now + 3_000)).toBe(session);
    session = updateSession(session, { type: "substitute", exerciseId: "lat_pulldown" }, now + 3_000);
    expect(current(session)).toMatchObject({ sourceExerciseId: "low_row_machine", exerciseId: "lat_pulldown", targetDurationSeconds: 300 });
    expect(allowedSubstitutions(current(session))).toEqual([]);
    expect(appDataSchema.safeParse({ ...data, sessions: [session] }).success).toBe(true);
  });

  it("archives the prior run and pauses and retains its draft when starting over", () => {
    const session = createSession(run, 3, now);
    const restarted = startProgram({ ...data, sessions: [session] }, "2026-12-01", "Asia/Kolkata", now + 10_000, "second-run");
    expect(restarted.activeRunId).toBe("second-run");
    expect(restarted.runs[0]?.archivedAt).toBe(new Date(now + 10_000).toISOString());
    expect(restarted.sessions[0]).toMatchObject({ programRunId: run.id, status: "partial", scheduledLocalDate: "2026-11-22" });
    expect(restarted.sessions[0]?.exercises[0]).toMatchObject({ elapsedMs: 10_000, startedAtMs: null });
    expect(appDataSchema.safeParse(restarted).success).toBe(true);
  });

  it("uses manually logged cardio minutes only on completed exercises", () => {
    let session = createSession(run, 3, now);
    session = updateSession(session, { type: "cardio", actualMinutes: 3.5, distanceKm: 0.8, speedKmh: 5 }, now + 1_000);
    expect(completedExerciseSeconds(current(session))).toBe(0);
    session = updateSession(session, { type: "done" }, now + 5_000);
    const cardio = session.exercises[0];
    if (!cardio) throw new Error("Missing completed cardio");
    expect(completedExerciseSeconds(cardio)).toBe(210);
    expect(cardio).toMatchObject({ elapsedMs: 5_000, distanceKm: 0.8, speedKmh: 5 });
  });

  it("rejects persisted exercise IDs outside the source and cross-attempt timer conflicts", () => {
    const valid = createSession(run, 3, now);
    const malformed = structuredClone(valid);
    current(malformed).exerciseId = "__proto__";
    expect(appDataSchema.safeParse({ ...data, sessions: [malformed] }).success).toBe(false);
    expect(appDataSchema.safeParse({ ...data, sessions: [valid, createSession(run, 4, now)] }).success).toBe(false);
  });
});
