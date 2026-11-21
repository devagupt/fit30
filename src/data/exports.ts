import { scheduledDate } from '../domain/dates';
import type { Fit30Data, SetLog } from '../domain/model';
import { getDay, getExercise, program } from '../domain/program';
import { exerciseElapsedMs } from '../domain/workout';

export function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8') {
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

function calendarText(value: string): string {
  return value.replaceAll('\\', '\\\\').replace(/\r\n|\r|\n/g, '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;');
}

function utcStamp(instant: number): string {
  return new Date(instant).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function localTimeConverter(timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });

  function localAsUtc(instant: number): number {
    const fields = Object.fromEntries(formatter.formatToParts(instant).map(({ type, value }) => [type, value]));
    return Date.parse(`${fields.year.padStart(4, '0')}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}:${fields.second}Z`);
  }

  return (date: string, time: string) => {
    const wanted = Date.parse(`${date}T${time}:00Z`);
    const horizon = 36 * 60 * 60 * 1000;
    const probes = [wanted - horizon, wanted, wanted + horizon];
    const candidates = probes.map((instant) => wanted - (localAsUtc(instant) - instant));
    const matches = candidates.filter((instant) => localAsUtc(instant) === wanted);
    // During a fall-back fold use the first occurrence. During a spring-forward gap use the pre-gap offset.
    return matches.length > 0 ? Math.min(...matches) : candidates[0];
  };
}

const encoder = new TextEncoder();

function foldLine(line: string): string {
  let folded = '';
  let length = 0;
  for (const character of line) {
    const bytes = encoder.encode(character).length;
    if (length + bytes > 75) {
      folded += '\r\n ';
      length = 1;
    }
    folded += character;
    length += bytes;
  }
  return folded;
}

export function createCalendarExport(data: Fit30Data, now = Date.now()): { text: string; eventCount: number } {
  const run = data.runs.find((candidate) => candidate.id === data.activeRunId);
  if (!run) throw new Error('Start a Fit30 program to export reminders.');

  const { reminderTime, remindOnRestDays } = data.preferences;
  if (reminderTime === null) throw new Error('Choose a reminder time before exporting reminders.');

  const toUtc = localTimeConverter(run.timezone);
  const completed = new Set(data.sessions.filter((session) =>
    session.programRunId === run.id && session.status === 'completed',
  ).map((session) => session.plannedDayNumber));
  const eventLines: string[] = [];
  let eventCount = 0;

  for (const day of program.days) {
    if (completed.has(day.day_number) || (day.day_type === 'rest' && !remindOnRestDays)) continue;

    const start = toUtc(scheduledDate(run, day.day_number), reminderTime);
    if (start < now) continue;

    const rest = day.day_type === 'rest';
    const summary = rest ? `Fit30 — Day ${day.day_number}: Recovery day` : `Fit30 — Day ${day.day_number}: ${day.session_name}`;
    const exercises = day.exercise_blocks.map((block) => `${block.duration_min} min ${getExercise(block.exercise_id).name}`);
    const description = rest ? `Planned recovery. Optional: ${exercises.join(', ')}.` : `${exercises.join(', ')}. Start when ready.`;
    eventLines.push(
      'BEGIN:VEVENT',
      `UID:${calendarText(run.id)}-day-${day.day_number}@fit30.local`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART:${utcStamp(start)}`,
      `DURATION:PT${rest ? day.optional_activity_minutes : day.target_gym_minutes}M`,
      `SUMMARY:${calendarText(summary)}`,
      `DESCRIPTION:${calendarText(description)}`,
      'CLASS:PRIVATE',
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:PT0S',
      `DESCRIPTION:${calendarText(summary)}`,
      'END:VALARM',
      'END:VEVENT',
    );
    eventCount += 1;
  }

  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fit30//Workout Reminders//EN', 'CALSCALE:GREGORIAN', ...eventLines, 'END:VCALENDAR'];
  return { text: lines.map(foldLine).join('\r\n') + '\r\n', eventCount };
}
