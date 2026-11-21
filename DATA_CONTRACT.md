# Data Contract and Import Rules

## Canonical files

- `data/30_day_gym_plan_with_video_tutorials.json` — **primary source of truth**, v1.1.0; is not user progress storage.
- `data/gym_exercise_video_catalog.csv` — optional human-review catalogue.
- `data/FITNESS_VIDEO_FEATURE_AGENT_GUIDE.md` — historic handoff details.

## Schema summary

Program root includes `schema_version`, `program_id`, `program_name`, `program_duration_days`, `schedule_type`, `start_date`, `timezone`, `goal`, `constraints`, `guidelines`, `daily_tracking_fields`, `weekly_tracking_fields`, `exercise_library`, `weekly_rotation`, `days`, `feature_flags`, `video_player_policy`.

`days[]` items: `day_number`, `week_number`, `cycle_day`, `day_type`, `session_name`, `focus`, `target_gym_minutes`, `optional_activity_minutes`, `exercise_blocks`, `tracking`.

`exercise_blocks[]` have `order`, `exercise_id`, `duration_min`, `sets`, `reps`, `reps_unit` (some may be null). Preserve all original keys, even if a particular view doesn't use them.

`exercise_library[exercise_id]` has `name`, `category`, `equipment`, `instructions`, `back_safety`, `default_prescription`, plus `tutorial_video`, `quick_form_cues`, `instructional_disclaimer` in the video-enriched version.

`tutorial_video` can contain `provider`, `youtube_video_id`, `watch_url`, `embed_url`, `start_seconds`, `end_seconds`, `source_page_url`, `exercise_match_note`, `editorial_status`, `may_embed_if_allowed`, `default_open_mode`, `fallback_open_mode`. Optional fields must tolerate null. Third-party video availability and embed access are not guaranteed.

`tracking` in JSON contains initial placeholder values such as `workout_completed=false`. **Do not save user changes back into the canonical JSON** or make it the authoritative log store. Create separate persistent logs/entities.

## Input validation

- Root should have exactly 30 `days` numbered 1..30, no duplicates.
- `day_type` in `gym` or `rest`; 26 gym and 4 rest in the supplied program.
- Every gym day must sum to 30 target minutes; rest days have 0 gym minutes and may have an optional 20-minute walk.
- Every exercise block references a valid exercise library key.
- `category`: cardio, strength, core, cooldown, optional activity types as present. Do not hardcode incompatible enum before inspecting the seed.
- `reps_unit` varies: `repetitions`, `repetitions_per_side`, `seconds_hold`, or null. Respect the unit.
- Video IDs must be treated as untrusted strings: validate allowed YouTube ID pattern before embedding. Use provider metadata and official embed URLs; reject arbitrary `javascript:` or external HTML injection.
- On unresolved video show text/YouTube fallback and do not block logging.

## Completion & derived metrics

- A scheduled workout is `completed` **only after the user actively marks the session complete**; individual block completion does not necessarily complete the session. Implement clear user action and rules.
- A completed workout can contain skipped exercises, but then show an explicitly labeled `completed_with_skips` badge or partial-completion metric; never render skipped items as done.
- Use actual time for activity charts; do not sum planned duration for skipped blocks.
- Count only 26 scheduled gym days in the 30-day completion denominator, not 30 total dates.
- Planned rest days do not break adherence streak; missing an optional walk is not a failure.
- Store program run `start_date` separately from `start_date:null` seed definition.
- When program restarts, create a new run; old run retained unless user deliberately deletes it.

## Example normalization

```ts
interface ProgramRun {
  id: string;
  programId: string;
  startDate: string; // YYYY-MM-DD local date
  timezone: string; // Asia/Kolkata by default
  status: 'active' | 'archived' | 'finished';
}
interface SetLog {
  index: number;
  plannedValue: number | null;
  actualValue: number | null;
  unit: 'repetitions' | 'repetitions_per_side' | 'seconds_hold' | null;
  weightKg?: number | null;
  completedAt?: string | null;
}
interface ExerciseLog {
  id: string;
  sourceExerciseId: string;
  state: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'substituted';
  elapsedActiveSeconds: number;
  sets: SetLog[];
  notes?: string;
}
```

These are illustrative, not a requirement to use exactly these names; changes must be documented and stable.

## Notes for schema evolution

If source v1.1.0 is incompatible with runtime schema, create a pure parse/validate/normalize function with tests and error messages. Never silently corrupt sessions. Store program schema version in exports. Where videos are not reviewed for equipment match, retain editorial status and don't imply verified form instruction.
