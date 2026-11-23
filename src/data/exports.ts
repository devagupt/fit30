import { Capacitor } from '@capacitor/core';
import type { Fit30Data, SetLog } from '../domain/model';
import { getDay, getExercise } from '../domain/program';
import { exerciseElapsedMs } from '../domain/workout';

export async function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8') {
  if (Capacitor.isNativePlatform()) {
    const [{ Directory, Encoding, Filesystem }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'), import('@capacitor/share'),
    ]);
    const { uri } = await Filesystem.writeFile({ path: filename, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ files: [uri], title: filename });
    return;
  }

  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

type CsvCell = string | number | null | undefined;

function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);

  // A leading apostrophe prevents spreadsheet apps from interpreting user text as a formula.
  const startsWithFormula = /^[\s\p{Cc}]*[=+@\-＝＋＠－]/u.test(value);
  const escaped = (startsWithFormula ? `'${value}` : value).replaceAll('"', '""');
  return `"${escaped}"`;
}

function csv(headings: string[], rows: CsvCell[][]): string {
  return [headings.join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\r\n') + '\r\n';
}

function formatSet(set: SetLog): string {
  const unit = set.unit === 'seconds_hold' ? 'sec' : set.unit === 'repetitions_per_side' ? 'reps per side' : 'reps';
  const value = set.actualValue === null ? '' : ` ${set.actualValue} ${unit}`;
  const weight = set.weightKg === null ? '' : ` @ ${set.weightKg} kg`;
  const status = set.completedAt ? 'done' : 'unmarked';
  return `Set ${set.index}${value}${weight} (${status})`;
}

export function workoutsCsv(data: Fit30Data, now = Date.now()): string {
  const headings = [
    'run_id', 'session_id', 'program_day', 'scheduled_date', 'performed_at', 'day_type',
    'session_status', 'make_up', 'planned_exercise_id', 'performed_exercise_id', 'exercise',
    'exercise_status', 'target_seconds', 'timer_seconds', 'actual_minutes_override',
    'distance_km', 'speed_kmh', 'sets', 'skip_reason', 'effort', 'back_discomfort', 'notes',
  ];

  return csv(headings, data.sessions.flatMap((session) => {
    const completedWithSkips = session.status === 'completed' && session.exercises.some((exercise) => exercise.state === 'skipped');
    const status = completedWithSkips ? 'completed_with_skips' : session.status;
    const day = getDay(session.plannedDayNumber);

    return session.exercises.map((exercise) => [
      session.programRunId, session.id, session.plannedDayNumber, session.scheduledLocalDate,
      session.performedAt, day?.day_type, status, session.isMakeUp ? 'yes' : '',
      exercise.sourceExerciseId, exercise.exerciseId, getExercise(exercise.exerciseId).name,
      exercise.state, exercise.targetDurationSeconds, Math.round(exerciseElapsedMs(exercise, now) / 1000),
      exercise.actualMinutes, exercise.distanceKm, exercise.speedKmh,
      exercise.sets.map(formatSet).join('; '), exercise.skipReason, session.effort, session.backPain, session.notes,
    ]);
  }));
}

export function measurementsCsv(data: Fit30Data): string {
  return csv(['run_id', 'measurement_id', 'local_date', 'measurement_type', 'value', 'recorded_at'],
    data.measurements.map((measurement) => [
      measurement.programRunId, measurement.id, measurement.localDate, measurement.type,
      measurement.value, measurement.createdAt,
    ]));
}
