import type { CompletedExercise } from "./progress";

function sumRecorded(values: (number | null)[]): number | null {
  return values.reduce<number | null>((sum, value) => value === null ? sum : (sum ?? 0) + value, null);
}

function maxRecorded(values: (number | null)[]): number | null {
  return values.reduce<number | null>((max, value) => value === null ? max : Math.max(max ?? value, value), null);
}

function summarizeEntry({ sessionId, date, seconds, log }: CompletedExercise) {
  const sets = log.sets.filter((set) => set.completedAt !== null && set.actualValue !== null);

  return {
    id: `${sessionId}:${log.order}`,
    date,
    seconds,
    distanceKm: log.distanceKm,
    speedKmh: log.speedKmh,
    sets: sets.length,
    reps: sumRecorded(sets.filter((set) => set.unit === "repetitions").map((set) => set.actualValue)),
    repsPerSide: sumRecorded(sets.filter((set) => set.unit === "repetitions_per_side").map((set) => set.actualValue)),
    longestHold: maxRecorded(sets.filter((set) => set.unit === "seconds_hold").map((set) => set.actualValue)),
    heaviestKg: maxRecorded(sets.map((set) => set.weightKg)),
  };
}

export function exerciseProgress(exercises: CompletedExercise[], exerciseId: string) {
  const history = exercises.filter((entry) => entry.log.exerciseId === exerciseId)
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .map(summarizeEntry);

  return {
    history,
    seconds: history.reduce((total, entry) => total + entry.seconds, 0),
    distanceKm: sumRecorded(history.map((entry) => entry.distanceKm)),
    latestSpeedKmh: history.find((entry) => entry.speedKmh !== null)?.speedKmh ?? null,
    sets: history.reduce((total, entry) => total + entry.sets, 0),
    reps: sumRecorded(history.map((entry) => entry.reps)),
    repsPerSide: sumRecorded(history.map((entry) => entry.repsPerSide)),
    longestHold: maxRecorded(history.map((entry) => entry.longestHold)),
    heaviestKg: maxRecorded(history.map((entry) => entry.heaviestKg)),
  };
}
