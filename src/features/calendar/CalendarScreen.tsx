import { Check, ChevronLeft, ChevronRight, Circle, CircleCheck, CircleDot, CirclePause, CirclePlay, Minus, Moon } from "lucide-react";
import { useState } from "react";
import { addDays, dayNumberOn, formatDate, localDate, programEndDate, scheduledDate } from "../../domain/dates";
import type { ExerciseLog, Fit30Data, ProgramRun, Session, SetLog } from "../../domain/model";
import { formatPrescription, getDay, getExercise, type ExerciseBlock, type ProgramDay } from "../../domain/program";
import { daySummary, type DayStatus } from "../../domain/progress";
import { isGymClosed } from "../../domain/schedule";
import { completedExerciseSeconds } from "../../domain/workout";
import { dayStatusText as statusLabels } from "../../ui/Status";
import { workoutPhoto } from "../../ui/workoutPhoto";
import { formatClock } from "../player/formatClock";
import "./calendar.css";

interface CalendarScreenProps {
  data: Fit30Data;
  run: ProgramRun;
  today: string;
  initialDay?: number;
  onStart: (dayNumber: number, sessionId?: string) => void;
  onTutorial: (exerciseId: string) => void;
}

const statusIcons = {
  scheduled: Circle,
  in_progress: CircleDot,
  partial: CirclePause,
  completed: CircleCheck,
  completed_with_skips: Check,
  missed: Minus,
  rest: Moon,
};

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const dateOptions: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function monthGrid(month: string) {
  const first = new Date(`${month}T00:00:00Z`);
  const leading = (first.getUTCDay() + 6) % 7;
  first.setUTCMonth(first.getUTCMonth() + 1, 0);
  const dates = Array.from({ length: first.getUTCDate() }, (_, index) => addDays(month, index));
  return [...Array<string | null>(leading).fill(null), ...dates];
}

function adjacentMonth(month: string, offset: number): string {
  const date = new Date(`${month}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 10);
}

function StatusIcon({ status }: { status: DayStatus }) {
  const Icon = statusIcons[status];
  return <Icon size={12} strokeWidth={2.5} className="fit-calendar-state" data-state={status} aria-hidden="true" />;
}

function attemptStatus(session: Session | undefined): DayStatus | undefined {
  if (!session || session.status === "abandoned") return undefined;
  if (session.status === "completed" && session.exercises.some((log) => log.state === "skipped")) return "completed_with_skips";
  return session.status;
}

function attemptLabel(session: Session, run: ProgramRun): string {
  const performed = localDate(run.timezone, Date.parse(session.performedAt));
  const status = attemptStatus(session);
  const description = status ? statusLabels[status] : "Discarded";
  const timing = session.isMakeUp ? " · Make-up" : performed < session.scheduledLocalDate ? " · Ahead of schedule" : "";
  const time = new Intl.DateTimeFormat("en-IN", { timeZone: run.timezone, hour: "numeric", minute: "2-digit" }).format(Date.parse(session.performedAt));
  return `${formatDate(performed)} · ${time} · ${description}${timing}`;
}

function workoutLabel(day: ProgramDay, session: Session | undefined, date: string, today: string) {
  if (session?.status === "in_progress" || session?.status === "partial") return day.day_type === "rest" ? "Resume walk" : "Resume workout";
  if (day.day_type === "rest") return session ? "Log another walk" : "Start optional walk";
  if (session?.status === "completed") return "Repeat workout";
  if (date < today) return "Do missed workout now";
  return date > today ? "Start workout ahead" : "Start workout";
}

function setLabel(set: SetLog) {
  const unit = set.unit === "seconds_hold" ? "sec hold" : set.unit === "repetitions_per_side" ? "reps per side" : "reps";
  const pieces = [`Set ${set.index}`];
  if (set.actualValue !== null) pieces.push(`${set.actualValue} ${unit}`);
  if (set.weightKg !== null) pieces.push(`${set.weightKg} kg`);
  pieces.push(set.completedAt ? "Done" : "Open");
  return pieces.join(" · ");
}

function ExerciseLine({ block, log, onTutorial }: { block: ExerciseBlock; log: ExerciseLog | undefined; onTutorial: CalendarScreenProps["onTutorial"] }) {
  const exerciseId = log?.exerciseId ?? block.exercise_id;
  const exercise = getExercise(exerciseId);
  const loggedSets = log?.sets.filter((set) => set.actualValue !== null || set.weightKg !== null || set.completedAt !== null) ?? [];
  const state = log?.state;
  const timed = state === "completed" && log ? completedExerciseSeconds(log) : (log?.elapsedMs ?? 0) / 1000;
  const stateLabel = state === "completed" ? "Done" : state === "skipped" ? "Skipped" : state === "in_progress" ? "In progress" : "Open";

  return (
    <li className="fit-calendar-exercise">
      <div className="fit-calendar-exercise__body">
        <strong>{exercise.name}</strong>
        <p>{formatPrescription(block)}</p>
        {log && exerciseId !== block.exercise_id && <p>Substitute for {getExercise(block.exercise_id).name}</p>}
        {log && (
          <p className="fit-calendar-exercise__result" data-state={state}>
            {stateLabel}{(timed >= 1 || state === "completed") && ` · ${formatClock(timed)} ${state === "completed" ? "logged" : "timed"}`}{log.skipReason && ` · ${log.skipReason}`}
          </p>
        )}
        {log?.distanceKm != null && <p>{log.distanceKm} km</p>}
        {log?.speedKmh != null && <p>{log.speedKmh} km/h</p>}
        {loggedSets.length > 0 && (
          <ul className="fit-calendar-set-list">
            {loggedSets.map((set) => <li key={set.index}>{setLabel(set)}</li>)}
          </ul>
        )}
      </div>
      <button type="button" className="button button-quiet fit-calendar-video" aria-label={`Watch tutorial for ${exercise.name}`} onClick={() => onTutorial(exerciseId)}>
        <CirclePlay size={21} aria-hidden="true" />
      </button>
    </li>
  );
}

function DayDetail({ day, run, today, data, onStart, onTutorial }: CalendarScreenProps & { day: ProgramDay }) {
  const [chosenAttempt, setChosenAttempt] = useState<string | null>(null);
  const summary = daySummary(day, run, data.sessions, today);
  const attempts = data.sessions.filter((session) => session.programRunId === run.id &&
    session.plannedDayNumber === day.day_number && session.status !== "abandoned")
    .sort((left, right) => right.performedAt.localeCompare(left.performedAt));
  const session = attempts.find((attempt) => attempt.id === chosenAttempt) ?? summary.session;
  const resumableId = session?.status === "in_progress" || session?.status === "partial" ? session.id : undefined;
  const timelineStatus = day.day_type === "rest" ? "rest" : attemptStatus(session) ?? summary.status;

  return (
    <article id="calendar-day" className="panel fit-calendar-day" aria-labelledby="calendar-day-title">
      <header className="fit-calendar-day__header">
        <div>
          <p className="eyebrow">Day {day.day_number} · {formatDate(summary.scheduledLocalDate)}</p>
          <h2 id="calendar-day-title" tabIndex={-1}>{day.day_type === "rest" ? "Rest day" : day.session_name}</h2>
        </div>
        <span className="fit-calendar-badge" data-state={timelineStatus}><StatusIcon status={timelineStatus} /> {statusLabels[timelineStatus]}</span>
      </header>
      <p className="fit-calendar-meta">{day.day_type === "rest" ? `${day.optional_activity_minutes}-minute optional walk` : `${day.focus} · ${day.target_gym_minutes} min target`}</p>

      {attempts.length > 1 ? (
        <label className="field fit-calendar-attempt">
          <span>Workout attempt</span>
          <select value={session?.id ?? ""} onChange={(event) => setChosenAttempt(event.target.value)}>
            {attempts.map((attempt) => <option key={attempt.id} value={attempt.id}>{attemptLabel(attempt, run)}</option>)}
          </select>
        </label>
      ) : session && <p className="fit-calendar-meta fit-calendar-attempt-label">Logged {attemptLabel(session, run)}</p>}

      {run.id === data.activeRunId && (
        <button type="button" className={`button fit-calendar-start ${session?.status === "completed" ? "button-secondary" : "button-primary"}`} onClick={() => onStart(day.day_number, resumableId)}>
          {workoutLabel(day, session, summary.scheduledLocalDate, today)}
        </button>
      )}

      <img className="fit-calendar-photo" src={workoutPhoto(day.day_number)} alt="" loading="lazy" />

      <h3>{session ? "Exercises and logs" : "Planned exercises"}</h3>
      <ol className="fit-calendar-exercises">
        {day.exercise_blocks.map((block, index) => <ExerciseLine key={block.order} block={block} log={session?.exercises[index]} onTutorial={onTutorial} />)}
      </ol>

      {session && (session.effort !== null || session.backPain !== null || session.notes) && (
        <dl className="fit-calendar-notes">
          {session.effort !== null && <div><dt>Effort</dt><dd>{session.effort}/10</dd></div>}
          {session.backPain !== null && <div><dt>Back discomfort</dt><dd>{session.backPain}/10</dd></div>}
          {session.notes && <div><dt>Notes</dt><dd>{session.notes}</dd></div>}
        </dl>
      )}
    </article>
  );
}

function RunCalendar(props: CalendarScreenProps) {
  const { run, data } = props;
  const today = run.id === data.activeRunId ? props.today : localDate(run.timezone);
  const end = programEndDate(run);
  const anchor = today < run.startDate ? run.startDate : today > end ? end : today;
  const [chosenDate, setChosenDate] = useState<string | null>(() =>
    props.initialDay && run.id === data.activeRunId ? scheduledDate(run, props.initialDay) : null);
  const selectedDate = chosenDate && chosenDate >= run.startDate && chosenDate <= end ? chosenDate : anchor;
  const month = monthStart(selectedDate);
  const selected = dayNumberOn(run, selectedDate);
  const selectedDay = selected === null ? undefined : getDay(selected);

  function moveMonth(offset: number) {
    const next = adjacentMonth(month, offset);
    setChosenDate(next < run.startDate ? run.startDate : next);
  }

  function openDate(date: string) {
    setChosenDate(date);
    window.requestAnimationFrame(() => {
      document.getElementById("calendar-day-title")?.focus({ preventScroll: true });
      if (window.matchMedia("(max-width: 800px)").matches) {
        document.getElementById("calendar-day")?.scrollIntoView({ block: "start" });
      }
    });
  }

  return (
    <div className="fit-calendar-columns">
      <section className="panel fit-calendar-month" aria-labelledby="fit-calendar-month-title">
        <div className="fit-calendar-month__heading">
          <button type="button" className="button button-quiet fit-calendar-arrow" aria-label="Previous month" onClick={() => moveMonth(-1)} disabled={month === monthStart(run.startDate)}><ChevronLeft size={20} aria-hidden="true" /></button>
          <h2 id="fit-calendar-month-title">{formatDate(month, { month: "long", year: "numeric" })}</h2>
          <button type="button" className="button button-quiet fit-calendar-arrow" aria-label="Next month" onClick={() => moveMonth(1)} disabled={month === monthStart(end)}><ChevronRight size={20} aria-hidden="true" /></button>
        </div>
        <div className="fit-calendar-grid">
          {weekdays.map((name) => <abbr key={name} className="fit-calendar-weekday" title={name}>{name.slice(0, 2)}</abbr>)}
          {monthGrid(month).map((date, index) => {
            if (!date) return <span key={`blank-${index}`} aria-hidden="true" />;
            const dayNumber = dayNumberOn(run, date);
            const day = dayNumber === null ? undefined : getDay(dayNumber);
            const dayOfMonth = Number(date.slice(-2));
            const closed = !day && date >= run.startDate && date <= end && isGymClosed(run, date);
            if (!day && !closed) return <span key={date} className="fit-calendar-cell fit-calendar-cell--empty" aria-hidden="true">{dayOfMonth}</span>;
            const status = day ? daySummary(day, run, data.sessions, today).status : 'rest';
            return (
              <button
                key={date} type="button" className="fit-calendar-cell" data-state={status}
                aria-label={day ? `${formatDate(date)}, Day ${day.day_number}, ${statusLabels[status]}` : `${formatDate(date)}, Gym closed`}
                aria-current={date === today ? "date" : undefined} aria-pressed={date === selectedDate} aria-controls="calendar-day"
                onClick={() => openDate(date)}
              >
                <span>{dayOfMonth}</span><StatusIcon status={status} />
              </button>
            );
          })}
        </div>
        <ul className="fit-calendar-legend" aria-label="Calendar statuses">
          {Object.entries(statusLabels).map(([status, label]) => (
            <li key={status}><StatusIcon status={status as DayStatus} /> {status === "completed_with_skips" ? "With skips" : label}</li>
          ))}
        </ul>
      </section>
      {selectedDay && <DayDetail key={selectedDay.day_number} {...props} today={today} day={selectedDay} />}
      {!selectedDay && isGymClosed(run, selectedDate) && (
        <article id="calendar-day" className="panel fit-calendar-day" aria-labelledby="calendar-day-title">
          <p className="eyebrow">{formatDate(selectedDate)}</p>
          <h2 id="calendar-day-title" tabIndex={-1}>Gym closed</h2>
          <p className="fit-calendar-meta">Your next workout will be ready the next day your gym is open.</p>
        </article>
      )}
    </div>
  );
}

export function CalendarScreen(props: CalendarScreenProps) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const run = props.data.runs.find((entry) => entry.id === selectedRunId) ?? props.run;
  const last = programEndDate(run);
  const runs = props.data.runs.slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return (
    <section className="fit-calendar" aria-labelledby="calendar-title">
      <header className="page-heading fit-calendar-heading">
        <div>
          <h1 id="calendar-title">Calendar</h1>
          <p>{formatDate(run.startDate, dateOptions)} to {formatDate(last, dateOptions)}</p>
        </div>
        {runs.length > 1 && (
          <label className="field fit-calendar-run">
            <span>Program run</span>
            <select value={run.id} onChange={(event) => setSelectedRunId(event.target.value)}>
              {runs.map((entry) => <option key={entry.id} value={entry.id}>{entry.archivedAt ? "Archived" : "Current"} · {formatDate(entry.startDate, dateOptions)}</option>)}
            </select>
          </label>
        )}
      </header>
      <RunCalendar key={run.id} {...props} run={run} />
    </section>
  );
}
