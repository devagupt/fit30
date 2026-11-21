import { Activity, Bike, CalendarDays, Check, CirclePlay, Clock3, Dumbbell, Footprints, Heart, Ruler, ShieldCheck } from 'lucide-react';
import { dayNumberOn, formatDate } from '../../domain/dates';
import type { Fit30Data, ProgramRun, Session } from '../../domain/model';
import { daySummary, progressSummary, workoutForToday } from '../../domain/progress';
import { categoryLabel, formatPrescription, getDay, getExercise, program, type ExerciseBlock, type ProgramDay } from '../../domain/program';
import { dayStatusText, Status } from '../../ui/Status';
import './today.css';

interface TodayProps {
  data: Fit30Data;
  run: ProgramRun;
  today: string;
  busy: boolean;
  onStart: (dayNumber: number, sessionId?: string) => void;
  onCalendar: (dayNumber?: number) => void;
  onMeasurement: () => void;
  onTutorial: (exerciseId: string) => void;
}

function ExerciseSymbol({ exerciseId }: { exerciseId: string }) {
  const exercise = getExercise(exerciseId);
  const Symbol = exerciseId === 'stationary_cycling' ? Bike
    : exercise.category === 'cardio' || exerciseId === 'optional_walk' ? Footprints
    : exercise.category === 'strength' ? Dumbbell
    : exercise.category === 'recovery' ? Heart : Activity;
  return <span className="exercise-symbol" data-category={exercise.category}><Symbol size={21} aria-hidden="true" /></span>;
}

function ExerciseRow({ block, session, onTutorial }: { block: ExerciseBlock; session?: Session; onTutorial: (id: string) => void }) {
  const log = session?.exercises.find((exerciseLog) => exerciseLog.order === block.order);
  const id = log?.exerciseId ?? block.exercise_id;
  const exercise = getExercise(id);
  const didSubstitute = id !== block.exercise_id;
  const displayBlock = didSubstitute && log ? {
    ...block, sets: log.sets.length || null, reps: log.sets[0]?.plannedValue ?? null, reps_unit: log.sets[0]?.unit ?? null,
  } : block;
  const state = log?.state ?? 'pending';
  const status = { completed: 'Done', skipped: 'Skipped', in_progress: 'In progress', pending: 'Planned' }[state];

  return (
    <li className="exercise-row">
      <ExerciseSymbol exerciseId={id} />
      <div className="exercise-row-main">
        <button type="button" className="exercise-title" onClick={() => onTutorial(id)}>{exercise.name}</button>
        <p>{categoryLabel(exercise.category)} <span aria-hidden="true">·</span> {formatPrescription(displayBlock)}</p>
        {didSubstitute && <p>Substitute for {getExercise(block.exercise_id).name}</p>}
        {state !== 'pending' && <p className="exercise-status" data-state={state}>
          {state === 'completed' && <Check size={14} aria-hidden="true" />} {status}{log?.skipReason && ` · ${log.skipReason}`}
        </p>}
        {state === 'pending' && <span className="sr-only">{status}</span>}
      </div>
      <button type="button" className="button button-quiet exercise-video" onClick={() => onTutorial(id)} aria-label={`Watch tutorial for ${exercise.name}`}>
        <CirclePlay size={20} aria-hidden="true" /><span>Video</span>
      </button>
    </li>
  );
}

function WeekPanel({ day, currentWeek, data, run, today, onCalendar }: { day: ProgramDay; currentWeek: boolean; data: Fit30Data; run: ProgramRun; today: string; onCalendar: () => void }) {
  const week = program.days.filter((entry) => entry.week_number === day.week_number);
  const completed = week.filter((entry) => daySummary(entry, run, data.sessions, today).status.startsWith('completed')).length;
  const gymDays = week.filter((entry) => entry.day_type === 'gym').length;
  return (
    <section className="panel week-panel" aria-label="This program week">
      <div className="week-header">
        <div>
          <h2>{currentWeek ? 'This week' : 'Program week'}</h2>
          <p>Week {day.week_number} of {program.days.at(-1)?.week_number}</p>
        </div>
        <span className="week-icon"><CalendarDays size={21} aria-hidden="true" /></span>
      </div>
      <ol className="week-days" style={{ gridTemplateColumns: `repeat(${week.length}, minmax(0, 1fr))` }}>
        {week.map((entry) => {
          const summary = daySummary(entry, run, data.sessions, today);
          const current = summary.scheduledLocalDate === today;
          return (
            <li key={entry.day_number} title={`Day ${entry.day_number}, ${dayStatusText[summary.status]}`}>
              <span className="week-weekday" aria-hidden="true">{formatDate(summary.scheduledLocalDate, { weekday: 'short' })}</span>
              <span className="week-day" data-status={summary.status} data-current={current} aria-hidden="true">
                {summary.status.startsWith('completed') ? <Check size={17} /> : summary.status === 'rest' ? <Heart size={15} /> : entry.day_number}
              </span>
              <span className="sr-only">Day {entry.day_number}, {dayStatusText[summary.status]}{current && ', today'}</span>
            </li>
          );
        })}
      </ol>
      <p className="week-count"><strong>{completed} of {gymDays}</strong> gym days finished</p>
      <button type="button" className="button button-quiet week-calendar" onClick={onCalendar}>View calendar</button>
    </section>
  );
}

export function TodayScreen({ data, run, today, busy, onStart, onCalendar, onMeasurement, onTutorial }: TodayProps) {
  const calendarDayNumber = dayNumberOn(run, today);
  const calendarDay = calendarDayNumber === null ? undefined : getDay(calendarDayNumber);
  const selected = workoutForToday(run, data.sessions, today);

  if (!selected) {
    const upcoming = today < run.startDate;
    const progress = progressSummary(run, data.sessions, today);
    const complete = progress.completedOverall === progress.totalGymDays;
    return (
      <div className="today-screen">
        <header className="page-heading today-heading"><h1>Today</h1><time dateTime={today}>{formatDate(today)}</time></header>
        <section className="today-hero">
          <div className="today-hero-content">
            <h2>{upcoming ? 'Your first workout' : complete ? 'Program complete' : 'You’re caught up'}</h2>
            <p>{upcoming ? `Day 1 is ${formatDate(run.startDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`
              : complete ? `${progress.completedOverall} of ${progress.totalGymDays} gym days finished.` : 'Your next workout will appear on its scheduled day.'}</p>
            <button type="button" className="button hero-button" onClick={() => onCalendar()}>View calendar</button>
          </div>
        </section>
      </div>
    );
  }

  const { day, session: current } = selected;
  const summary = daySummary(day, run, current ? [current] : [], today);
  const finished = current?.status === 'completed';
  const resume = current && !finished ? current : undefined;
  const completed = current?.exercises.filter((entry) => entry.state === 'completed').length ?? 0;
  const restDay = day.day_type === 'rest';
  const carriedOver = !restDay && summary.scheduledLocalDate < today;
  const otherWorkoutToday = calendarDay?.day_type === 'gym' && calendarDay.day_number !== day.day_number && !finished &&
    daySummary(calendarDay, run, data.sessions, today).status === 'scheduled' ? calendarDay : undefined;
  const measureDue = calendarDay?.cycle_day === 1 && !data.measurements.some((entry) => entry.programRunId === run.id && entry.localDate === today && entry.type === 'waist_cm');
  const steps = day.exercise_blocks.length;
  const mode = restDay ? 'walk' : 'workout';
  const action = finished ? (restDay ? 'View walk' : 'View workout')
    : resume ? `Resume ${mode}` : restDay ? 'Start optional walk' : carriedOver ? 'Continue plan' : 'Start workout';
  const ActionIcon = finished ? Check : CirclePlay;

  return (
    <div className="today-screen">
      <header className="page-heading today-heading">
        <h1>Today</h1>
        <time dateTime={today}>{formatDate(today, { weekday: 'short', day: 'numeric', month: 'long' })}</time>
      </header>
      <div className="today-grid">
        <div className="today-main">
          <section className="today-hero" data-rest={restDay} aria-labelledby="today-session">
            <div className="today-hero-content">
              <div className="hero-day">Day {day.day_number} of {program.program_duration_days}</div>
              <h2 id="today-session">{restDay ? 'Rest day' : day.session_name}</h2>
              <p>{restDay ? 'Recovery with an optional easy walk.' : day.focus}</p>
              {carriedOver && !finished && <p className="hero-scheduled">Scheduled for {formatDate(summary.scheduledLocalDate)}</p>}
              <div className="hero-meta">
                <span><Clock3 size={18} aria-hidden="true" /> {restDay ? `${day.optional_activity_minutes} min optional` : `${day.target_gym_minutes} min target`}</span>
                {!restDay && <span><Dumbbell size={18} aria-hidden="true" /> {steps} exercises</span>}
              </div>
              <button type="button" className="button hero-button" disabled={busy} onClick={finished ? () => onCalendar(day.day_number) : () => onStart(day.day_number, resume?.id)}>
                <ActionIcon size={20} aria-hidden="true" /> {action}
              </button>
            </div>
          </section>

          <section aria-labelledby="today-plan" className="today-plan">
            <div className="today-plan-heading">
              <h2 id="today-plan">{restDay ? 'Optional activity' : 'Exercises'}</h2>
              {!restDay && <span>{completed} of {steps} done</span>}
              {restDay && finished && <span>Walk logged</span>}
            </div>
            {!restDay && <div className="today-segments" aria-hidden="true">
              {day.exercise_blocks.map((block) => <span key={block.order} data-state={current?.exercises[block.order - 1]?.state ?? 'pending'} />)}
            </div>}
            {current && summary.status !== 'rest' && <div className="today-plan-status"><Status status={summary.status} /></div>}
            <ol className="panel exercise-list">
              {day.exercise_blocks.map((block) => <ExerciseRow key={block.order} block={block} session={current} onTutorial={onTutorial} />)}
            </ol>
          </section>
        </div>

        <aside className="today-side" aria-label="Program overview">
          {otherWorkoutToday && <section className="panel today-alternate">
            <h2>On the calendar today</h2>
            <p>Day {otherWorkoutToday.day_number} · {otherWorkoutToday.session_name}</p>
            <button type="button" className="button button-secondary" disabled={busy} onClick={() => onStart(otherWorkoutToday.day_number)}>Start today’s workout</button>
          </section>}
          <WeekPanel day={calendarDay ?? day} currentWeek={!!calendarDay} data={data} run={run} today={today} onCalendar={() => onCalendar()} />
          {measureDue && <section className="panel today-measure">
            <span className="week-icon"><Ruler size={21} aria-hidden="true" /></span>
            <div><h2>Weekly waist check-in</h2><p>Log a measurement in centimeters to track change over time.</p></div>
            <button type="button" className="button button-secondary" onClick={onMeasurement}>Log measurement</button>
          </section>}
          <section className="today-safety">
            <ShieldCheck size={21} aria-hidden="true" />
            <div><h2>Move at your own pace</h2><p>Keep movements controlled and pain-free. Pause or stop if an exercise worsens your back pain.</p></div>
          </section>
        </aside>
      </div>
    </div>
  );
}
