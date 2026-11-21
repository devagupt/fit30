# Copy/Paste Prompts for Codex

Use **the same project folder** containing this file, `AGENTS.md`, `PRODUCT_SPEC.md`, `DATA_CONTRACT.md`, and `data/`. Start with Phase 0/1 below, inspect the running app, then send each later prompt separately. Do not paste the entire project spec into the chat when Codex can read it directly from disk.

## First prompt — review and build the first usable version

```text
Please work inside this project folder. First read README_START_HERE.md,
AGENTS.md, PRODUCT_SPEC.md, DATA_CONTRACT.md, and the canonical files in data/.

This is my personal mobile-first 30-day fitness tracker. I want a genuinely
usable, clean, minimal app, not a static visual mockup or a gigantic scaffold.

Do the following in this turn:
1) Inspect the repository and source JSON; briefly list the plan and any
   inconsistencies/constraints. Do not invent a new exercise program.
2) Implement Phase 0 and Phase 1 as scoped in PRODUCT_SPEC.md:
   - React/TypeScript mobile-first PWA
   - import/validate the 30-day source JSON
   - onboarding start date and daily reminder time
   - Today, calendar/history, basic progress and settings
   - Start/Pause/Next/Skip/Finish exercise flow with persistence
   - correct exercise details (durations/sets/reps/units)
   - working tutorial links and form cues (embedded video can follow in Phase 2)
   - local data persistence and JSON backup/export/restore
   - ICS calendar export for reliable external daily reminders
3) Run lint, typecheck, unit tests and production build; fix failures.
4) Give me the exact commands to run the app locally, how to open it on my
   phone for testing, and any constraints I need to know.

Keep it scoped. Avoid sign-in, cloud setup, payment, AI functionality,
third-party analytics, or push backend in this first phase.
Don't claim closed-app reminders work until they are actually implemented.
Use clean UI with big, easy gym controls; no fake buttons or placeholders.
```

## Second prompt — exercise tutorials

```text
Implement Phase 2 from PRODUCT_SPEC.md in the same codebase.
Each exercise must have a working Watch Tutorial view using the exact
exercise_id mapping from data/30_day_gym_plan_with_video_tutorials.json.
Use official YouTube embedded playback with timestamps when supported.
Show quick form cues and lower-back precautions and an external YouTube
fallback if the embed fails/offline/unavailable. The low-row tutorial must
be marked as requiring equipment match: my gym has a lower row machine.
Pause exercise active time while the tutorial is open; resume where I left off.
Avoid auto-play. Add tests for correct video mapping, blocked video fallback,
and timer pause/resume. Run checks and show how to verify on my phone.
```

## Third prompt — dependable reminders

```text
Implement Phase 3 from PRODUCT_SPEC.md. I want a daily reminder at my
chosen local gym time even when my installed mobile app is closed.
First explain the supported deployment architecture and what backend /
service credentials will be required. Do NOT claim that client-side setTimeout
or a service worker alone guarantees scheduled push delivery.
Build standards-based web push with explicit user opt-in, backend
subscriptions, scheduled sends, idempotency, timezone support,
unsubscribe, status display, and a graceful ICS calendar fallback.
Handle iOS Home Screen PWA limitations; include a physical-device test
checklist. Do not create external accounts or deploy without asking first.
```

## Fourth prompt — progress and finish

```text
Implement Phase 4 from PRODUCT_SPEC.md. Improve the calendar and progress
screens using real logged data: gym session adherence (exclude rest days),
actual exercise minutes, strength progression, weekly waist measurements
(Days 1,8,15,22,29), effort/back discomfort, end-of-program summary,
export/import and good empty states. Test missed workouts, partial sessions,
rest days, make-up sessions and a restarted 30-day program.
Run accessibility and mobile e2e checks. Report exactly what is tested.
```

## Quick follow-up prompt after you see a bug

```text
Bug: [describe actual behavior, screen, steps to reproduce].
Expected: [desired behavior].
Inspect the current code, reproduce with a failing test where practical,
fix the smallest correct scope, then run impacted tests + typecheck + build.
Don't rewrite the whole app or alter canonical fitness data.
```
