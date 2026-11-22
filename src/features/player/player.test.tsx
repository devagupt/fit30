import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProgramRun } from '../../domain/model';
import * as program from '../../domain/program';
import { createSession, updateSession } from '../../domain/workout';
import { TutorialDialog } from './TutorialDialog';
import { WorkoutTimer } from './WorkoutTimer';
import { movementGuides } from './movementGuides';

const now = Date.UTC(2026, 10, 22, 8);
const run: ProgramRun = {
  id: 'test-run',
  startDate: '2026-11-20',
  timezone: 'Asia/Kolkata',
  createdAt: new Date(now).toISOString(),
  archivedAt: null,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('workout timer display', () => {
  it('holds the same remaining time after a tutorial pauses a running block', () => {
    vi.useFakeTimers();
    const session = createSession(run, 3, now, 'day-three');
    const paused = updateSession(session, { type: 'openTutorial', at: 0 }, now + 32_000);
    vi.setSystemTime(now + 120_000);

    const screen = renderToStaticMarkup(<WorkoutTimer log={paused.exercises[0]} sound={false} vibration={false} />);

    expect(screen).toContain('Timer paused');
    expect(screen).toContain('09:28');
    expect(paused.position).toBe(0);
    expect(paused.exercises[0].state).toBe('in_progress');
  });

  it('prompts at overtime while the current exercise remains active', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now + 611_000);
    const session = createSession(run, 3, now, 'day-three');

    const screen = renderToStaticMarkup(<WorkoutTimer log={session.exercises[0]} sound={false} vibration={false} />);

    expect(screen).toContain('Overtime');
    expect(screen).toContain('+00:11');
    expect(screen).toContain('Time is up. Continue at a comfortable pace or move on.');
    expect(session.position).toBe(0);
    expect(session.exercises[0].state).toBe('in_progress');
  });
});

describe('exercise tutorial content', () => {
  it('bundles a movement guide for every canonical exercise', () => {
    expect(Object.keys(movementGuides).sort()).toEqual(Object.keys(program.program.exercise_library).sort());
  });

  it('uses the supported low-row source and warns to check the equipment', () => {
    const screen = renderToStaticMarkup(
      <TutorialDialog exerciseId="low_row_machine" onClose={() => {}} timerPaused />,
    );

    expect(screen).toContain('Low row machine (lower row)');
    expect(screen).toContain('https://www.youtube.com/watch?v=FU6YQawma2Q&amp;t=13s');
    expect(screen).toContain('rel="noopener noreferrer"');
    expect(screen).toContain('Check your equipment');
    expect(screen).toContain('chest-supported machine');
    expect(screen).toContain('Workout timer paused');
    expect(screen).toContain('Play video');
    expect(screen).not.toContain('<iframe');
  });

  it('offers written cues and safety information when video metadata is missing', () => {
    const exercise = program.getExercise('low_row_machine');
    vi.spyOn(program, 'getExercise').mockReturnValue({ ...exercise, tutorial_video: null });

    const screen = renderToStaticMarkup(<TutorialDialog exerciseId="low_row_machine" onClose={() => {}} />);

    expect(screen).toContain('Video unavailable');
    expect(screen).toContain('Lower-back cue');
    expect(screen).toContain(exercise.instructions);
    expect(screen).not.toContain('href=');
  });
});
