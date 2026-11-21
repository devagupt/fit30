# Codex Repository Instructions — Fit30

Read `PRODUCT_SPEC.md`, `DATA_CONTRACT.md`, and `README_START_HERE.md` before editing app code. Read the source JSON under `data/` carefully. Treat those local files as the complete project context; this repository starts with project instructions and seed data, not a functioning app.

## Product invariants

1. This is a **single-user, mobile-first 30-minute gym tracking app**, intended for 6 gym days and 1 planned rest day each week, with lower-back safety cues and workout tutorial videos.
2. `data/30_day_gym_plan_with_video_tutorials.json` is the immutable canonical program (30 dates; 26 gym / 4 rest); never retype or regenerate it by hand.
3. **Keep the app simple**: one exercise at a time, large controls, shortest possible path to Start -> Follow -> Done -> Next.
4. All exercise cards/tutorials/logs must resolve through the stable `exercise_id`; `low_row_machine` is not interchangeable by default with a generic bent-over/seated cable row.
5. Preserve exact prescribed minute budgets and units from JSON. Do not rush sets to fit a 30-minute target; allow pauses/overtime. Tutorial time is excluded from active exercise time.
6. Exercise completion requires user action; never mark a movement done just because the timer expired. Rest days do not count as missed gym sessions.
7. Persist user logs separately from static seed. Never lose user data on refresh, failed import, missing network, or app updates.
8. Web push to closed phones needs browser/OS permission and a real delivery backend. Local timers are not reliable closed-app push. Provide ICS reminders until proper push is configured and tested.
9. Never download/rehost third-party YouTube video content; use official embeds or open source watch page; show written cues on failures.
10. History of lower-back strain warrants pain-free movement reminders, not diagnosis or generic high-risk loading recommendations.

## Engineering rules

- Work in **small, reviewed phases** (see `CODEX_PROMPTS.md`); report assumptions and dependencies.
- If starting with an empty repository, scaffold React + TypeScript app (Next.js App Router recommended), a simple accessible component set, IndexedDB persistence, PWA support, and tests. Use stable compatible versions available during implementation.
- Implement schema validation and tests before building a large UI.
- Prefer a small clear codebase over abstractions/agent frameworks. No LLM API is required in the app.
- Security: no auth secrets in client code or repository, no silent telemetry or public health logs, sanitization/validation for imports and video URLs.
- Avoid brittle date arithmetic: use local calendar dates in Asia/Kolkata. Tests must cover date rollover and missed days.
- Use semantic HTML, high-contrast touch-friendly controls, accessible modal/dialog behavior and visible error states.
- Include test scripts and README instructions. Before declaring a phase done, run typecheck, lint, tests, build, and preview/manual smoke test as feasible. Report exact pass/fail outcomes and outstanding blockers; do not invent testing results.
- Do not deploy, create paid services, publish health data, or change third-party account settings without explicit user request and approval.

## Change communication

At end of each phase respond with: **(a)** what was implemented, **(b)** how to run it locally, **(c)** tests performed/results, **(d)** what is incomplete, and **(e)** suggested next phase. Make a Git commit after a successful phase if user workflow allows, otherwise summarize changed paths for review.
