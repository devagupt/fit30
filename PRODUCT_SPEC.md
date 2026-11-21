# Fit30 — Complete Product Requirements & UX Specification

**Document status:** Build specification for Codex. No app has been implemented.  
**Version:** 1.0 | **Primary locale:** English | **Default timezone:** Asia/Kolkata  
**Product:** Single-user, installable, mobile-first personal gym workout tracker.  
**Source of truth:** `data/30_day_gym_plan_with_video_tutorials.json` (seed program, schema v1.1.0).  
**Important:** The exercise program is user-specified educational content, not a clinical prescription. Never claim belly fat can be selectively lost by abdominal exercise.

## 1. Vision and why this app exists

Build the simplest possible app that helps one person show up for a 30-minute workout, know **exactly what to do next**, see **how to do it correctly** through a tutorial, log what was done, and look back at genuine progress. It must be usable quickly in a noisy gym with one hand and intermittent connectivity. This is not a social fitness network, nutrition-calorie counter, or AI personal trainer.

### Background / constraints

- User currently goes to the gym **six days per week**.
- Main goals: **general health**, **cardiovascular stamina**, sustainable waist/body-composition improvement, and some full-body strength; NOT aggressive weight loss.
- Prefers workouts that are **short, manageable, and uncomplicated**. Earlier suggestions with 7–8 exercises were considered overwhelming.
- Usual familiar movements: **treadmill running/brisk walking, stationary cycling, and abdominal/back extension**. The simplified program shifts towards safer trunk-stability work and rotating strength movements.
- **History of lower-back muscular strain**. On-screen instructions should emphasize controlled, pain-free motion. Do not automatically prescribe back extensions or heavy unsupported rows.
- Their gym has a **low row / lower row machine**, not necessarily a standard seated cable row. The video must match actual equipment before recommending technique.
- Wants to see a **tutorial video for every exercise of the day**, replay it on demand, and follow correct machine setup/form.
- Wants **daily exercise reminders**, **within-session transitions**, and clear progress tracking.
- The user is likely to access app on a smartphone at the gym, even if developed using a laptop and Codex.
- Existing 30-day source program: **26 gym days + 4 rest days** (day 7, 14, 21, 28); day 29 and 30 continue the weekly rotation. Do not invent a different plan in code.

### Non-goals for the MVP

No subscriptions or payments; no multi-user social community; no smart-watch integration; no calorie burn estimation; no biometric integrations; no AI diagnosis; no LLM-driven exercise changes; no auto-generated diet plan; no cloud account mandatory for the first usable version; no video copying/downloading/rehosting; no custom video editing.

## 2. Success criteria

A user can accomplish the following without technical help:

1. Open the installed app and see today's program day and the exercises in the correct order.
2. Tap **Start Workout**, see a single large exercise at a time, and see sets/reps or target duration.
3. Tap **Watch Tutorial** for the *correct exercise*; see easy form cues and lower-back caution; then return to the exact same session state.
4. Tap **Mark Done / Next** with no need to type for every cardio exercise; log actual sets, reps and weights when useful for strength.
5. Hear an optional tone / feel supported vibration when a **running foreground timer** finishes; never assume automatic transitions while the app is suspended.
6. Finish early, pause, skip, substitute, or resume a partially completed workout without losing data.
7. Receive a single **daily schedule reminder** at a configured time if notification support is set up; receive **in-session prompts** only after pressing Start.
8. See a monthly calendar with completed, partial, missed, upcoming and scheduled-rest states.
9. Record weekly waist measurement and see a true trend without making false fat-loss claims.
10. Refresh the browser, close/reopen the installed app, and retain all progress; export JSON/CSV and restore from an export.

## 3. Input data & exact canonical schedule

Files:

- `data/30_day_gym_plan_with_video_tutorials.json` is the canonical seeded program.
- `data/gym_exercise_video_catalog.csv` is supplemental review/editorial metadata; do not use it to replace the structured JSON.
- `data/FITNESS_VIDEO_FEATURE_AGENT_GUIDE.md` gives earlier video-specific policies.
- `DATA_CONTRACT.md` explains how static definitions map to mutable user state.

Exercise IDs in the seed:

`treadmill_walk_jog`, `stationary_cycling`, `chest_press_machine`, `leg_press_machine`, `low_row_machine`, `lat_pulldown`, `plank`, `bird_dog`, `glute_bridge`, `dead_bug`, `gentle_cooldown`, `optional_walk`.

**Workout template:** On gym days, **10 min treadmill + 8 min cycling + 5 min rotating strength + 5 min rotating core + 2 min cooldown = 30 minutes**, including light setup/rest within the individual blocks where feasible. This is *exercise budget*, not a deadline that pressures the user to rush. Allow pause and overrun. Video watching is outside the 30-minute budget. The app must not falsely claim 150 min moderate cardio weekly from this specific schedule; the 18 minutes cardio x 6 = 108 minutes/week, unless any further cardio is actually logged.

| Cycle day | Day type | Main strength block | Core block | Notes |
|---|---|---|---|---|
| 1 | Gym | Chest press machine | Plank | Push + front-core |
| 2 | Gym | Leg press machine | Bird-dog | Legs + stability |
| 3 | Gym | Low row (supported machine) | Glute bridge | Pull + glutes |
| 4 | Gym | Chest press machine | Dead bug | Push + coordination |
| 5 | Gym | Leg press machine | Glute bridge | Legs + glutes |
| 6 | Gym | Lat pulldown | Bird-dog | Pull + stability |
| 7 | Rest | None | Optional 20-min easy walk | No mandatory gym timer |

Repeat the 7-day rotation for calendar days 1–28, then days 29–30 follow cycle days 1–2. **If any detail conflicts with the above summary, the supplied JSON's `days[]` takes precedence**. Do not re-enter 30 days manually when JSON is present.

### Start date and schedule rules

- `start_date` is initially `null`: ask the user to select it in onboarding. Do not hardcode 16 November or any other past date.
- Program day `n` normally maps to `start_date + (n-1)` **local calendar days** (not 24-hour chunks, to avoid timezone/DST bugs); use `Asia/Kolkata` by default but make timezone explicit in settings.
- Rest days are intentionally planned; show a gentle recovery card and an optional walk. Never call a scheduled rest day a missed workout.
- Past days without session data should be labeled **Not logged** or **Missed** (based on settings) rather than silently "completed" or pushing the plan forward.
- Default: program calendar dates stay fixed. Missing a workout does **not** auto-shift all subsequent days. Offer **Do missed workout now** to create an additional session linked to the original plan day and clearly label it as make-up. Optionally offer a manually confirmed schedule-shift action in a later phase; never shift silently.
- A workout completed ahead of schedule must remain tied to a program day and carry actual `performed_at` timestamp. Multiple attempts may be recorded, but a day is completed once if at least one complete session exists.
- If user restarts the 30-day program, archive old run with its own program run ID, never overwrite history.

## 4. Information architecture and screen-by-screen UI

### 4.1 Onboarding — initial setup only

Use a lightweight four-step flow:

1. Welcome: "30 minutes. One exercise at a time." Brief explanation of stamina and waist-tracking, emphasizing no spot reduction.
2. Select start date and local time for **daily reminder** (e.g., 6:30 pm, editable; do NOT presume schedule). Show timezone. Notification permissions are asked **after an explicit user interaction**, not on page load.
3. Show program overview: 6 days/week, 30 minutes on gym days, 4 planned rest days. Allow "Preview Day 1".
4. Explain reminders: (a) calendar-compatible reminder export available immediately; (b) real closed-app push depends on installation/permission/backend; (c) in-session prompts work while session runs. Offer "Enable notifications" / "Not now".

No sign-in required for local MVP. If cloud sync added later, make it explicitly opt-in.

### 4.2 Today — default landing screen

Mobile layout example (content, not pixel-perfect code):

```
Fit30                                         [settings]
Fri 20 Nov                     DAY 3 / 30
Pull + glutes                                    30 min
Progress: ███████████░░░░░                 [3/5]

TODAY'S EXERCISES
[ ] Treadmill              10 min     [Video]
[ ] Cycling                 8 min     [Video]
[ ] Low row machine         2 x 10    [Video]
[ ] Glute bridge            2 x 10    [Video]
[ ] Cooldown                2 min     [Video]

[ START WORKOUT ]

Today | Calendar | Progress | Settings
```

Rules: real date/day from chosen start date; dynamic status and progress from stored user logs; no fake "completed" preview state. Each exercise row shows **name**, **category**, **target**, **actual status**, and **Watch Tutorial**. Tap an exercise for form detail. Rest day screen: recovery title, optional 20-minute walk, no "Start 30-min workout" button.

### 4.3 Workout player — highest-priority screen

One exercise shown prominently with **category, equipment, planned duration OR sets x reps, form cues**, and an optional small thumbnail. Large buttons accessible with a single hand:

```
Workout · Day 3               [Pause] [Exit]
Exercise 3 of 5 · STRENGTH

LOW ROW MACHINE
Target: 2 sets × 10 reps | Block: ~5 min

[ WATCH 45s TUTORIAL ]
Form: stable chest / neutral back / smooth pull
Lower-back note: don't swing the torso

Set 1:  [10 reps] [__kg]    [✓]
Set 2:  [10 reps] [__kg]    [ ]

                03:40 remaining
[ PAUSE ]   [ MARK DONE & NEXT ]
[ Skip / Substitute ]
```

Functional rules:

- Active timer uses **real clock timestamps/monotonic-time logic** as available, persisting `remaining_ms`, `last_started_at` and paused state. Never rely only on interval tick counts.
- Start/Pause/Resume/Next/Previous/Skip/Finish/Cancel must be deterministic. "Cancel" confirms whether to save partial progress or discard this attempt. Don't discard automatically.
- **Completion is explicit**, not inferred only because a time counter reached zero. A completed exercise records when and what was done.
- Cardio: start timer, complete/stop early, record optional actual minutes/distance/speed; don't demand entries to proceed.
- Strength: per-set reps, optional weight in kg, actual reps, done toggle, and optional rest timer. Do not assume minutes elapsed means set completed.
- Core: plank hold seconds vs bird-dog repetitions-per-side; show correct units. Track pain/effort if user wants.
- If 5 minutes is too short due to equipment queues, allow extending/swapping/skipping and recording reason. Do not pressure unsafe speed.
- When the foreground timer ends, optional vibration/short tone **only after user initiated session**, then show "Time is up — continue or move on?". Do not automatically change exercises while user is moving.
- When user is on a tutorial, **pause the workout's exercise and session active timers**; return to the same place. Display separate elapsed wall-clock vs active-exercise time if helpful.
- When browser/app becomes backgrounded, timers may be throttled. Reconcile against timestamps on resume, but do not claim notification or automatic transition guaranteed while the phone is locked.
- Persist updates frequently (on every control action and time checkpoints) to IndexedDB. Resume incomplete sessions after reload.

### 4.4 Exercise tutorial screen / modal

Each exercise has a **stable ID** linking its card to its own `exercise_library[id].tutorial_video`; never reuse current card position to pick a video. UI:

- Title + target exercise and target equipment.
- Embedded official YouTube player with `youtube-nocookie.com` URL using the provided video ID and optional start/end. Respect actual provider embedding rules; use supported API controls where available.
- **No silent auto-play**. First encounter may show a non-intrusive "New exercise — watch how" suggestion, dismissible and remembered.
- Below the video: 3 concise **form cues**, "Avoid" / common mistakes, **lower-back precaution** from seed, and a visible "Machine looks different?" action.
- "Machine looks different?" explains that low-row and leg press variants vary; offers a preview/alternate written instructions or safe replacement (approved/curated). Do NOT silently substitute machine movement. For uncertain low-row machine, prompt to consult staff and allow skipping.
- Video may fail due to regional access, embed restrictions, network, removed content. Always show written cues and an **Open video in YouTube** link as fallback. Never block workout completion.
- Respect copyright: only official embeds; no downloads, rehosting, scraping or extracting media.
- Video length may be longer than the 30–90s ideal. Show any source timestamp/segment metadata honestly, not fictitious "45s" unless verified.
- All video sources have editorial review status needing equipment check. An "unverified equipment match" warning may be appropriate until reviewed.
- Tutorial player should close back to original exercise and timer state.
- Educational materials are not personalized physiotherapy; do not imply medical clearance.

### 4.5 Calendar / history

- Month/30-day view with day number and status: `scheduled`, `in_progress`, `completed`, `partial`, `missed`/`not_logged`, `rest`, `rescheduled` where supported.
- Tap date to see planned vs actual exercises, actual minutes, sets/weights, perceived effort (1–10), back discomfort (0–10), notes.
- Day 7, 14, 21, 28 always "Rest" if no extra activity. Optional walk is a bonus, not a mandatory completion criterion.
- A missed exercise row may be marked "Skipped (machine occupied)"; progress should not claim completed.
- Past workout editing requires confirmation, preserves edited timestamp and updates derived stats.

### 4.6 Progress dashboard

Must show grounded, computable metrics:

- `Gym sessions completed / gym sessions scheduled up to today` (exclude rest days), and a separate overall `completed / 26` badge.
- Weekly streak: consecutive **scheduled gym days** completed; rest days do not break streak. Clearly label definition; no shame-inducing design.
- Minutes actually completed; cardio vs strength/core totals (only completed/logged time, not target time).
- Optional trend: avg perceived effort, treadmill/cycling duration, and performance for strength movement (weight/reps). Never infer improvements if no logged metrics.
- Waist circumference in cm as manually measured at **Day 1, 8, 15, 22, 29** (show reminders and allow any additional entry). Optional weight in kg.
- Waist changes are measures of circumference, **not guaranteed fat loss**. Avoid labels like "burned X belly-fat grams" or unsupported calorie estimates.
- "Last 7 days" and "Program so far" filters, simple legible graphs, and empty states that tell user how to begin logging.

### 4.7 Settings and export

- Change reminder time, timezone, audio/vibration preferences, notification permission status, and theme (light/dark optional).
- View/edit program start date only with conflict-handling if sessions already exist.
- Backup **all** progress as JSON, download CSV workout history/measurements, restore/import backup after validation and confirmation.
- Optional data wipe button with clear confirmation; no analytics or sharing workout/health information with third parties by default.
- Help page explains installation on iOS/Android, notification limitations, where records live, and how to recover backup.

## 5. Reminders: exact expected behavior

**Important separation:** A reminder about today's planned session is not the same thing as a signal that an exercise timer has finished.

### Daily reminders

- User chooses ONE configurable local-time reminder for gym days.
- Example: "Fit30 — Day 3: 10m treadmill, 8m cycle, low row, glute bridge. Start when ready." Use concise text; do not send notifications with overly detailed health information unless user opts in.
- Rest day: default **no gym reminder**; optional "Recovery day" toggle. No repeated nags.
- Don't send on past days, don't duplicate same reminder on retry, don't send after completion if the notification has not been dispatched.
- Notifications need permission and a delivery mechanism that actually works while app closed. **A local client-side timer cannot guarantee this**.
- MVP fallback: **downloadable `.ics` calendar file** containing one 30-day series (or individual events) with correct local dates, descriptions and alarm(s); allow importing into Google/Apple Calendar. State that system calendar alert behavior depends on calendar settings.
- Proper server-backed web push in a separate phase: use Push API + service worker + VAPID, opt-in subscription, authenticated storage if backend added, daily scheduler with timezone and idempotent send log, unsubscribe/settings; verify on physical devices. No push for people who did not opt in.
- On iPhone/iPad web push, an installable Home Screen web app may be needed; don't promise delivery on a plain Safari tab. Background timers and vibration have platform restrictions.

### Within-workout exercise alerts

- Only start after **Start Workout**; derive next exercise from `exercise_blocks` in order.
- Foreground timer: optional sound/vibration/visual prompt at block completion; display Next button.
- If phone locked or backgrounded, do not promise sub-minute push reliability or auto-advance.
- If tutorial plays, pause active exercise timer; pause and persist elapsed time appropriately.
- Do not schedule five absolute wall-clock notifications based on assumed gym start time.

## 6. Functional state model / data persistence

Make static plan immutable and store user activity separately. Proposed entity layout:

- `ProgramDefinition`: imported JSON, schema/version, exercise library, `days`.
- `ProgramRun`: unique run ID, selected `startDate`, `timezone`, `createdAt`, archived/completed status.
- `Session`: id, programRunId, plannedDayNumber, scheduledLocalDate, performedAt, status (`not_started|in_progress|completed|partial|abandoned`), activeSeconds, wallSeconds, effort, backPain, notes.
- `ExerciseLog`: id, sessionId, sourceExerciseId, order, state (`pending|in_progress|completed|skipped|substituted`), targetDurationSeconds, actualDurationSeconds, set logs, optional distance/pace, reason/notes, tutorialWatchedAt.
- `SetLog`: id, exerciseLogId, setIndex, plannedRepsOrSeconds, actualRepsOrSeconds, optional weightKg, completedAt.
- `Measurement`: id, programRunId, localDate, type (`waist_cm|weight_kg`), numeric value, timestamp.
- `UserPreferences`: reminderTime, timezone, notificationsOptIn, tutorialFirstViewBehavior, sounds, vibration, preferred units.
- `NotificationRecord` (later): delivery channel, intended local date, sent at, status, idempotency key.

Use generated IDs and ISO timestamps with timezone treatment explicit. Do not mutate the seed JSON's `days[].tracking` as ongoing persisted data; treat those objects only as defaults. Persist in browser IndexedDB first; use backups for device transfer. If enabling a backend/cloud account later, add user-scoped authentication, row-level access controls and careful synchronization/conflict resolution. Avoid storing health data in logs, URLs, or third-party analytics.

### Offline

- Service worker/app shell cached; today/calendar and existing logs usable without internet; video embeds may not play offline.
- On reconnect, no duplicate completions. Avoid stale state overwrites across tabs (transactional storage/version IDs).
- App should explain "Your progress is saved on this device" until sync exists.

## 7. Proposed technology and implementation strategy

**Recommended default:** React + TypeScript + Next.js (App Router) + Tailwind CSS + accessible component primitives; a PWA manifest/service worker; IndexedDB via Dexie (or a comparably robust library); Zod for import validation; date-fns with timezone handling or equivalent; Vitest + React Testing Library for units; Playwright for end-to-end checks. Select current compatible stable versions at build time rather than hardcoding outdated version numbers. No AI API key is needed to run this basic tracker.

Use modular boundaries: `domain` (types and state reducers), `data` (validated seed and persistence), `ui` (components), `features` (today, player, tutorials, calendar, progress, settings), and optional `notifications/server` later. Put static seed data in versioned files and load them via parser, not hardcoded arrays.

**MVP has to be usable without any third-party cloud account.** For reliable push while closed, implement a separate, clearly explained integration requiring a server/job runner. The **ICS reminder export is the immediate no-backend path**. If the user wants full cloud sync or push in v1, require explicit choice of deployment host and secrets; do not invent credentials.

## 8. UX quality bar

- Design first for 360–430px mobile widths, then desktop.
- Minimal, calm, modern visual design: neutral surfaces with a restrained teal/blue accent, high text contrast, large touch targets (at least ~44px), clear labels, no oversized dashboard clutter.
- Avoid gamification that penalizes rest or missed workouts. Keep motivation constructive.
- A single primary action on each screen. Bottom nav: **Today, Calendar, Progress, Settings**.
- Use native accessible buttons, keyboard focus management, screen-reader labels, accessible video fallback, numeric inputs with units.
- Skeleton/empty/error states and slow-network/offline indicators.
- First meaningful content should show immediately from local plan + logs.
- Never make the user watch tutorials just to mark done; never auto-play unrequested video.

## 9. Safety and privacy requirements

- Show lower-back safety note on relevant exercises. If user logs significant pain or pain that changes during session, suggest stopping and getting professional assessment rather than "pushing through".
- General exercise cautions: stop for severe symptoms such as chest pain, faintness, or neurological changes and seek medical care.
- It is *not* a medical device and should not diagnose/treat injuries or prescribe load progressions algorithmically.
- Record back-pain level only if user chooses; make it nullable. Do not label every slight discomfort a diagnosis.
- No mandatory account, tracking cookies, advertising, or personal health telemetry by default. Exports should not leak sensitive fields through public links.

## 10. Development phases and acceptance tests

### Phase 0: Repo setup and seed validation

Deliver app scaffold, `README.md`, `AGENTS.md`, reproducible install and run commands, data validator tests, CI-friendly lint/typecheck/test/build scripts.

**Acceptance:** all 30 day definitions resolve, exercise IDs exist, videos mapped; gym days total 30 target min; exactly 4 rest days; default start date null, timezone Asia/Kolkata; no invented exercise IDs.

### Phase 1: Useful offline MVP

Onboarding, Today, calendar/list, workout player, per-exercise logging, IndexedDB persistence, export/restore, basic progress, manual reminder time setting, ICS export; tutorial can initially open official YouTube external link. Installable PWA.

**Acceptance:** user can finish Day 3, mark row skipped, navigate away, refresh, come back, see correct persistence and summaries. Test partial session and day 7 rest.

### Phase 2: Integrated tutorials and polish

Embedded responsive video player, form cues, mismatch/blocked-video fallback, first-view preference, timer pause while tutorial opens, robust error/loading states, mobile UX polish.

**Acceptance:** each video resolves by ID; failing embed falls back; tutorial does not consume active session minutes; wrong exercise video never shown.

### Phase 3: Notifications that work while app closed

Implement permission UX, push subscription management, server-side scheduler/idempotency, graceful ICS fallback, physical device tests. This phase has external deployment and credentials requirements and must explicitly report any blockers rather than faking push.

**Acceptance:** opt-in device receives daily push with app closed (for supported install / permissions), respects timezone and schedule edits, no duplicate sends, unsubscribing works, no reminder for rest unless enabled.

### Phase 4: Insights, tests and polish

Weekly/monthly charts, meaningful trends, end-of-30-day summary, improved history editing and exports, accessibility and regression suite.

**Acceptance:** all metrics derive from actual logs and exclude uncompleted sessions; rest excluded from denominator; week boundary and date math correct; tested offline/import behavior.

## 11. Test cases Codex must explicitly implement

1. Seed validation: 30 days, 26 gym, four rest (7/14/21/28), each gym day 30 targeted minutes and five blocks.
2. Every `exercise_blocks[*].exercise_id` resolves to `exercise_library` and has safe video URL; missing URL shows written fallback.
3. Day 3 displays **Low row machine**, not seated cable row; its video/technique must be the `low_row_machine` entry, flagged for equipment-match review.
4. Day 7 shows rest; optional 20-minute walk not counted as missed gym.
5. `startDate=2026-11-20` in Asia/Kolkata maps day 2 to 2026-11-21 and day 7 to 2026-11-26; use a date utility and test month rollover.
6. Pausing, refreshing, resuming does not overcount time or falsely mark exercise done.
7. Open tutorial and close: exercise count and active timer unchanged, state retained; timeout/blocked media shows fallback link and cues.
8. Strength repetitions-per-side and plank hold in seconds are formatted correctly; no accidental confusion of reps and seconds.
9. Missing a day does not shift future calendar dates; make-up session preserves original planned day association.
10. Completed workout shows in History and progress dashboard, persists after reload; partial workout shown distinctly.
11. Exports round-trip; corrupt or unsupported import produces validation error without deleting existing logs.
12. Notification time change updates generated ICS and future pushes; no permission yields a transparent fallback.
13. Data never leaves the user's device in offline MVP except when they explicitly open an external video.
14. Mobile screen responsive, controls tappable, accessible labels on controls, no horizontal overflow.

## 12. Delivery / definition of done

Codex should not stop at scaffolded files. At each implementation phase, it must report exactly what changed, run/record `lint`, `typecheck`, `test`, and `build` as configured, and provide runnable local instructions. Capture screenshots or local preview where possible (without requiring external deployment). Be clear on known limitations of push/video/real devices. Never claim a feature works unless the relevant tests/manual verification happened.
