import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Bell, CalendarDays, Clock3, Dumbbell, Leaf } from 'lucide-react';
import type { DataUpdate } from '../../data/storage';
import { isProgramStartDate, localDate } from '../../domain/dates';
import { type Fit30Data, preferencesSchema } from '../../domain/model';
import { formatPrescription, getExercise, program } from '../../domain/program';
import { startProgram } from '../../domain/workout';
import { Dialog } from '../../ui/Dialog';
import { BackupRestore } from '../settings/BackupRestore';
import './onboarding.css';

interface OnboardingProps {
  data: Fit30Data;
  onSave: (update: DataUpdate) => Promise<boolean>;
  busy: boolean;
}

const headings = ['Welcome', 'Set your schedule', 'Your 30-day program', 'Workout reminders'];
const preview = program.days[0];

export function Onboarding({ data, onSave, busy }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [startDate, setStartDate] = useState(() => localDate(data.preferences.timezone));
  const [reminderTime, setReminderTime] = useState(data.preferences.reminderTime ?? '');
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const saving = useRef(false);
  const timezone = data.preferences.timezone;

  useEffect(() => { heading.current?.focus(); }, [step]);

  function goTo(next: number) {
    setError('');
    setStep(next);
  }

  function confirmSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isProgramStartDate(startDate)) {
      setError('Choose a valid start date for your program.');
      return;
    }
    if (!preferencesSchema.safeParse({ ...data.preferences, reminderTime: reminderTime || null }).success) {
      setError('Choose a valid reminder time or leave it blank.');
      return;
    }
    goTo(2);
  }

  async function beginProgram() {
    if (busy || saving.current) return;
    saving.current = true;
    try {
      await onSave((current) => {
        if (current.activeRunId) throw new Error('A Fit30 program is already active.');
        const next = startProgram(current, startDate, current.preferences.timezone);
        return { ...next, preferences: { ...next.preferences, reminderTime: reminderTime || null } };
      });
    } finally {
      saving.current = false;
    }
  }

  return (
    <section className={`setup-shell${step === 0 ? ' setup-welcome' : ''}`} aria-labelledby="setup-heading">
      {step === 0 && <div className="setup-visual"><img src={`${import.meta.env.BASE_URL}studio-welcome-duo.jpg`} alt="" /></div>}
      <div className="setup-content">
        <div className="setup-progress" aria-label={`Step ${step + 1} of ${headings.length}`} role="group">
          {headings.map((label, index) => <span key={label} className={index <= step ? 'setup-progress-filled' : ''} aria-hidden="true" />)}
        </div>
        {step === 0 && (
          <>
            <h1 id="setup-heading" className="setup-welcome-title" ref={heading} tabIndex={-1}>30 minutes.<br />One exercise at a time.</h1>
            <p className="setup-intro">Build stamina with a simple gym plan. Track workouts and waist measurements over time.</p>
            <div className="setup-actions">
              <button type="button" className="button button-primary" onClick={() => goTo(1)}>Get started</button>
              <BackupRestore className="button button-quiet" busy={busy} onSave={onSave} />
            </div>
          </>
        )}
        {step === 1 && (
          <form onSubmit={confirmSchedule}>
            <CalendarDays className="setup-step-icon" size={27} aria-hidden="true" />
            <h1 id="setup-heading" ref={heading} tabIndex={-1}>{headings[step]}</h1>
            <p className="setup-intro">Pick the date for Day 1. Reminders use {timezone}.</p>
            <div className="setup-fields">
              <label className="field">Start date<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required max="9999-12-02" /></label>
              <label className="field">Daily reminder time<input type="time" value={reminderTime} onChange={(event) => setReminderTime(event.target.value)} aria-describedby="setup-time-hint" /></label>
            </div>
            <p id="setup-time-hint" className="setup-hint">Leave the reminder time blank if you prefer to set it later.</p>
            {error && <p className="settings-feedback settings-error" role="alert">{error}</p>}
            <div className="setup-actions">
              <button type="submit" className="button button-primary">Continue</button>
              <button type="button" className="button button-quiet" onClick={() => goTo(0)}>Back</button>
            </div>
          </form>
        )}
        {step === 2 && (
          <>
            <Dumbbell className="setup-step-icon" size={27} aria-hidden="true" />
            <h1 id="setup-heading" ref={heading} tabIndex={-1}>{headings[step]}</h1>
            <ul className="setup-plan">
              <li><Dumbbell size={20} aria-hidden="true" /><span><strong>Six gym days each week</strong><small>Cardio, one strength exercise, one core exercise, and a cooldown.</small></span></li>
              <li><Clock3 size={20} aria-hidden="true" /><span><strong>30 minutes of exercise</strong><small>Take extra time or pause when you need to.</small></span></li>
              <li><Leaf size={20} aria-hidden="true" /><span><strong>Four planned recovery days</strong><small>Easy walks are optional.</small></span></li>
            </ul>
            <button type="button" className="button button-secondary" onClick={() => setShowPreview(true)}>Preview Day 1</button>
            <div className="setup-actions">
              <button type="button" className="button button-primary" onClick={() => goTo(3)}>Continue</button>
              <button type="button" className="button button-quiet" onClick={() => goTo(1)}>Back</button>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <Bell className="setup-step-icon" size={27} aria-hidden="true" />
            <h1 id="setup-heading" ref={heading} tabIndex={-1}>{headings[step]}</h1>
            <p className="setup-intro">Use your phone’s calendar for daily reminders. Export the dates from Settings and import them into your calendar app.</p>
            <p className="setup-hint">Exercise timer alerts work while you have a workout open.</p>
            <div className="setup-actions">
              <button type="button" className="button button-primary" disabled={busy} onClick={() => void beginProgram()}>Begin program</button>
              <button type="button" className="button button-quiet" disabled={busy} onClick={() => goTo(2)}>Back</button>
            </div>
          </>
        )}
      </div>
      {showPreview && (
        <Dialog title="Day 1 workout" onClose={() => setShowPreview(false)}>
          <p className="setup-preview-summary"><strong>{preview.session_name}</strong><span>{preview.target_gym_minutes} min</span></p>
          <ol className="setup-preview-exercises">
            {preview.exercise_blocks.map((block) => (
              <li key={block.order}>
                <strong>{getExercise(block.exercise_id).name}</strong>
                <span>{formatPrescription(block)}</span>
              </li>
            ))}
          </ol>
          <button type="button" className="button button-primary" onClick={() => setShowPreview(false)}>Back to setup</button>
        </Dialog>
      )}
    </section>
  );
}
