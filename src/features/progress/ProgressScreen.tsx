import { Activity, CalendarCheck, ChartNoAxesColumnIncreasing, Plus, Ruler, Timer } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { formatDate, isLocalDate, scheduledDate } from "../../domain/dates";
import { exerciseProgress } from "../../domain/exerciseProgress";
import { newId, type Fit30Data, type Measurement, type ProgramRun } from "../../domain/model";
import { categoryLabel, getExercise, program } from "../../domain/program";
import { progressSummary, type ActivityPeriod, type CompletedExercise } from "../../domain/progress";
import "./progress.css";

interface ProgressScreenProps {
  data: Fit30Data;
  run: ProgramRun;
  today: string;
  onSave: (update: (data: Fit30Data) => Fit30Data) => Promise<boolean>;
  busy: boolean;
  initialMeasurement?: boolean;
}

const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const dateOptions: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
const exerciseOptions = Object.entries(program.exercise_library);
const exerciseGroups = Array.from(new Set(exerciseOptions.map(([, exercise]) => exercise.category)), (category) => ({
  category,
  options: exerciseOptions.filter(([, exercise]) => exercise.category === category),
}));

function duration(seconds: number): string {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  if (!minutes) return `${remainder} sec`;
  return remainder ? `${minutes} min ${remainder} sec` : `${minutes} min`;
}

function ActivitySummary({ totals, period }: { totals: ReturnType<typeof progressSummary>; period: ActivityPeriod }) {
  const activity = [
    { category: "cardio", label: "Cardio", value: totals.cardioSeconds },
    { category: "strength", label: "Strength", value: totals.strengthSeconds },
    { category: "core", label: "Core & glutes", value: totals.coreSeconds },
    { category: "recovery", label: "Recovery", value: totals.recoverySeconds },
  ];

  return (
    <section className="panel fit-progress-block fit-progress-activity-panel" aria-labelledby="fit-progress-activity">
      <div className="fit-progress-heading">
        <div>
          <h2 id="fit-progress-activity"><Timer size={20} aria-hidden="true" /> Logged activity</h2>
          <p>Completed exercises from finished sessions</p>
        </div>
      </div>
      {totals.exercises.length > 0 ? (
        <>
          <p className="fit-progress-total">{duration(totals.actualSeconds)}</p>
          <ul className="fit-progress-categories">
            {activity.map(({ category, label, value }) => (
              <li className="fit-progress-category" key={category} data-category={category}>
                <span>{label}</span><strong>{duration(value)}</strong>
                <div className="fit-progress-bar" aria-hidden="true"><span style={{ width: `${totals.actualSeconds ? 100 * value / totals.actualSeconds : 0}%` }} /></div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="fit-progress-empty">Finish {period === "last7" ? "a session this week" : "your first session"} to see your logged exercise time.</p>
      )}
    </section>
  );
}

function valueWithUnit(value: number | null, unit: string): string | null {
  return value === null ? null : `${number.format(value)} ${unit}`;
}

function ExerciseAnalytics({ entries, period }: { entries: CompletedExercise[]; period: ActivityPeriod }) {
  const [selected, setSelected] = useState<string | null>(null);
  const exerciseId = selected ?? exerciseOptions.find(([id]) => entries.some(({ log }) => log.exerciseId === id))?.[0] ?? exerciseOptions[0][0];
  const exercise = getExercise(exerciseId);
  const analytics = exerciseProgress(entries, exerciseId);
  const recent = analytics.history.slice(0, 5);
  const maxSeconds = Math.max(0, ...recent.map((entry) => entry.seconds));
  const statistics = [
    { label: "Completed sessions", value: number.format(analytics.history.length) },
    { label: "Total logged time", value: duration(analytics.seconds) },
    { label: "Logged distance", value: valueWithUnit(analytics.distanceKm, "km") },
    { label: "Latest logged speed", value: valueWithUnit(analytics.latestSpeedKmh, "km/h") },
    { label: "Logged sets", value: exercise.default_prescription.sets === null ? null : number.format(analytics.sets) },
    { label: "Logged reps", value: analytics.reps === null ? null : number.format(analytics.reps) },
    { label: "Logged reps per side", value: analytics.repsPerSide === null ? null : number.format(analytics.repsPerSide) },
    { label: "Heaviest logged load", value: valueWithUnit(analytics.heaviestKg, "kg") },
    { label: "Longest hold", value: valueWithUnit(analytics.longestHold, "sec") },
  ];

  return (
    <section className="panel fit-progress-block fit-exercise-analytics" aria-labelledby="fit-exercise-analytics">
      <div className="fit-progress-heading">
        <h2 id="fit-exercise-analytics"><ChartNoAxesColumnIncreasing size={21} aria-hidden="true" /> Exercise analytics</h2>
      </div>
      <label className="field fit-exercise-selector">
        <span>Exercise</span>
        <select value={exerciseId} onChange={(event) => setSelected(event.target.value)}>
          {exerciseGroups.map(({ category, options }) => (
            <optgroup key={category} label={categoryLabel(category)}>
              {options.map(([id, definition]) => <option key={id} value={id}>{definition.name}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      {analytics.history.length ? (
        <>
          <dl className="fit-exercise-stats" aria-label={`${exercise.name} totals`}>
            {statistics.map(({ label, value }) => value === null ? null : (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
          <h3>Recent workouts</h3>
          <ol className="fit-exercise-history" aria-label="Recent workouts">
            {recent.map((entry) => {
              const details = [
                entry.sets ? valueWithUnit(entry.sets, entry.sets === 1 ? "set" : "sets") : null,
                valueWithUnit(entry.reps, "reps"),
                valueWithUnit(entry.repsPerSide, "reps per side"),
                valueWithUnit(entry.heaviestKg, "kg heaviest"),
                valueWithUnit(entry.longestHold, "sec best hold"),
                valueWithUnit(entry.distanceKm, "km"),
                valueWithUnit(entry.speedKmh, "km/h"),
              ].filter((value) => value !== null);
              return (
                <li key={entry.id}>
                  <time dateTime={entry.date}>{formatDate(entry.date, dateOptions)}</time>
                  <strong>{duration(entry.seconds)}</strong>
                  {details.length > 0 && <p>{details.join(" · ")}</p>}
                  {maxSeconds > 0 && <div className="fit-progress-bar" aria-hidden="true"><span style={{ width: `${100 * entry.seconds / maxSeconds}%` }} /></div>}
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <p className="fit-progress-empty">{period === "last7" ? "No completed entries for this exercise in the last 7 days."
          : "Finish a workout with this exercise to see its stats here."}</p>
      )}
    </section>
  );
}

function WaistTrend({ entries }: { entries: Measurement[] }) {
  const first = entries[0];
  const latest = entries[entries.length - 1];
  if (!first || !latest) return <p className="fit-progress-empty">Log a waist measurement to start your trend.</p>;

  const change = latest.value - first.value;
  const direction = change < 0 ? "smaller" : "larger";
  const roundedChange = Math.round(Math.abs(change) * 100) / 100;
  const max = entries.reduce((largest, entry) => Math.max(largest, entry.value), 0);
  const upper = Math.ceil(max / 10) * 10;

  return (
    <figure className="fit-progress-waist" aria-label="Waist measurements">
      <figcaption>
        <strong>{number.format(latest.value)} cm</strong>
        <span>{entries.length === 1 ? `First entry · ${formatDate(latest.localDate, dateOptions)}`
          : roundedChange === 0 ? "Unchanged since first entry"
            : `${number.format(roundedChange)} cm ${direction} than first entry`}</span>
      </figcaption>
      {entries.length > 1 && (
        <ul aria-label={entries.length > 5 ? "Last five waist entries" : "Waist entries"}>
          {entries.slice(-5).map((entry) => (
            <li key={entry.id}>
              <time dateTime={entry.localDate}>{formatDate(entry.localDate, dateOptions)}</time>
              <div className="fit-progress-bar" aria-hidden="true"><span style={{ width: `${100 * entry.value / upper}%` }} /></div>
              <strong>{number.format(entry.value)} cm</strong>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

function MeasurementForm({ today, busy, save, cancel }: {
  today: string;
  busy: boolean;
  save: (date: string, waist: number, weight: number | null) => Promise<boolean>;
  cancel: () => void;
}) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      formRef.current?.focus({ preventScroll: true });
      formRef.current?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || busy) return;
    const form = new FormData(event.currentTarget);
    const date = String(form.get("date") ?? "");
    const waist = Number(form.get("waist"));
    const weightInput = String(form.get("weight") ?? "");
    const weight = weightInput ? Number(weightInput) : null;
    if (!isLocalDate(date) || date > today || !(waist > 0 && waist <= 1000) || (weight !== null && !(weight > 0 && weight <= 1000))) {
      setError("Enter a valid date and measurement.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      if (!await save(date, waist, weight)) setError("Your measurement couldn’t be saved. Please try again.");
    } catch {
      setError("Your measurement couldn’t be saved. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="fit-progress-form" aria-label="Log measurement" ref={formRef} tabIndex={-1} onSubmit={(event) => void submit(event)}>
      <div className="fit-progress-fields">
        <label className="field"><span>Measurement date</span><input name="date" type="date" max={today} defaultValue={today} required /></label>
        <label className="field"><span>Waist (cm)</span><input name="waist" type="number" inputMode="decimal" step="0.1" min="0.1" max="1000" required /></label>
        <label className="field"><span>Weight (kg), optional</span><input name="weight" type="number" inputMode="decimal" step="0.1" min="0.1" max="1000" /></label>
      </div>
      {error && <p className="fit-progress-error" role="alert">{error}</p>}
      <div className="fit-progress-actions">
        <button type="submit" className="button button-primary" disabled={submitting || busy}>{submitting ? "Saving…" : "Save measurement"}</button>
        <button type="button" className="button button-quiet" onClick={cancel} disabled={submitting}>Cancel</button>
      </div>
    </form>
  );
}

function Measurements({ data, run, today, busy, onSave, initialMeasurement }: ProgressScreenProps) {
  const [showForm, setShowForm] = useState(initialMeasurement === true);
  const [saved, setSaved] = useState(false);
  const entries = data.measurements.filter((entry) => entry.programRunId === run.id)
    .sort((left, right) => left.localDate.localeCompare(right.localDate) || left.createdAt.localeCompare(right.createdAt));
  const waists = entries.filter((entry) => entry.type === "waist_cm");
  const nextCheckIn = program.days.filter((day) => day.cycle_day === 1)
    .map((day) => ({ day: day.day_number, date: scheduledDate(run, day.day_number) }))
    .find((entry) => entry.date >= today && !waists.some((measurement) => measurement.localDate === entry.date));

  async function save(date: string, waist: number, weight: number | null) {
    const createdAt = new Date().toISOString();
    const values: Measurement[] = [{ id: newId(), programRunId: run.id, localDate: date, type: "waist_cm", value: waist, createdAt }];
    if (weight !== null) values.push({ id: newId(), programRunId: run.id, localDate: date, type: "weight_kg", value: weight, createdAt });
    const saved = await onSave((current) => {
      if (current.activeRunId !== run.id) throw new Error("Your current program changed. Review the new date and try again.");
      return { ...current, measurements: [...current.measurements, ...values] };
    });
    if (saved) {
      setShowForm(false);
      setSaved(true);
    }
    return saved;
  }

  return (
    <section className="panel fit-progress-block fit-progress-measurements-panel" aria-labelledby="fit-progress-measurements">
      <div className="fit-progress-heading">
        <div>
          <h2 id="fit-progress-measurements"><Ruler size={21} aria-hidden="true" /> Measurements</h2>
          {nextCheckIn && <p>Next waist check-in · Day {nextCheckIn.day} · {formatDate(nextCheckIn.date)}</p>}
        </div>
        {!showForm && (
          <button type="button" className="button button-secondary" onClick={() => { setSaved(false); setShowForm(true); }} disabled={busy}>
            <Plus size={18} aria-hidden="true" /> Log measurement
          </button>
        )}
      </div>
      {showForm && <MeasurementForm today={today} busy={busy} save={save} cancel={() => setShowForm(false)} />}
      {saved && <p className="fit-progress-saved" role="status">Measurement saved.</p>}
      <WaistTrend entries={waists} />
      {entries.length > 0 && (
        <details className="fit-progress-records">
          <summary>Measurement history</summary>
          <ul>
            {entries.slice().reverse().map((entry) => (
              <li key={entry.id}>
                <time dateTime={entry.localDate}>{formatDate(entry.localDate, { ...dateOptions, year: "numeric" })}</time>
                <span>{entry.type === "waist_cm" ? "Waist" : "Weight"}</span>
                <strong>{number.format(entry.value)} {entry.type === "waist_cm" ? "cm" : "kg"}</strong>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

export function ProgressScreen(props: ProgressScreenProps) {
  const [period, setPeriod] = useState<ActivityPeriod>("all");
  const { data, run, today } = props;
  const totals = progressSummary(run, data.sessions, today, period);

  return (
    <section className="fit-progress" aria-labelledby="progress-title">
      <header className="page-heading"><h1 id="progress-title">Progress</h1><p>Your workouts, exercise stats, and measurements for the current program.</p></header>
      <dl className="fit-progress-cards" aria-label="Gym workout progress">
        <div className="panel fit-progress-card">
          <dt><CalendarCheck size={18} aria-hidden="true" /> Scheduled to date</dt>
          <dd>{totals.completedToDate} <span>/ {totals.scheduledToDate}</span><small>Gym days completed</small></dd>
        </div>
        <div className="panel fit-progress-card">
          <dt><Activity size={18} aria-hidden="true" /> Full program</dt>
          <dd>{totals.completedOverall} <span>/ {totals.totalGymDays}</span><small>{totals.completedWithSkips ? `${totals.completedWithSkips} completed with skips` : "Gym days completed"}</small></dd>
        </div>
        <div className="panel fit-progress-card">
          <dt><CalendarCheck size={18} aria-hidden="true" /> Current streak</dt>
          <dd>{totals.streak}<small>Consecutive scheduled gym days</small></dd>
        </div>
      </dl>
      <div className="fit-progress-period">
        <div className="fit-progress-filter" aria-label="Activity period" role="group">
          <button type="button" className="button button-quiet" aria-pressed={period === "all"} onClick={() => setPeriod("all")}>Program so far</button>
          <button type="button" className="button button-quiet" aria-pressed={period === "last7"} onClick={() => setPeriod("last7")}>Last 7 days</button>
        </div>
      </div>
      <div className="fit-progress-panels">
        <ActivitySummary totals={totals} period={period} />
        <ExerciseAnalytics entries={totals.exercises} period={period} />
        <Measurements key={run.id} {...props} />
      </div>
    </section>
  );
}
