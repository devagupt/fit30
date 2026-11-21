# Fit30 — Codex Starter Bundle

This folder is a **handoff for Codex**, NOT an already-built application.
It captures the complete product context and includes the canonical 30-day fitness program and exercise video references.

## Files to use

| File | Purpose |
|---|---|
| `PRODUCT_SPEC.md` | Complete UX and behavior specification, screens, app logic, reminder semantics, testing and delivery phases |
| `AGENTS.md` | Persistent instructions Codex should follow while coding |
| `DATA_CONTRACT.md` | JSON schema/import rules and how to store logs without modifying seed data |
| `CODEX_PROMPTS.md` | Phase-by-phase prompts you can copy into Codex |
| `data/30_day_gym_plan_with_video_tutorials.json` | Actual 30-day plan, exercise IDs, sets/durations, tutorial source metadata |
| `data/gym_exercise_video_catalog.csv` | Flattened video source catalogue for manual inspection |
| `data/FITNESS_VIDEO_FEATURE_AGENT_GUIDE.md` | Supplementary tutorial implementation notes |

## Recommended start: ChatGPT desktop app Codex view

1. Extract this ZIP to a local folder such as `~/Projects/fit30/` (Mac) or your preferred location.
2. Install/update ChatGPT desktop from https://chatgpt.com/download/ if needed; sign in; choose **Codex** (not regular Chat). Or use Codex in an IDE/terminal (see below).
3. Open/select **this local folder** as the project in Codex.
4. Ask Codex to read `README_START_HERE.md`, `AGENTS.md`, `PRODUCT_SPEC.md`, and `DATA_CONTRACT.md` plus `data/`.
5. Paste **First prompt** from `CODEX_PROMPTS.md` and run it. Review the plan and any requested terminal permissions.
6. Once the app is scaffolded, follow Codex's reported install/run commands, usually `npm install` and `npm run dev` if it chose a Node/Next.js stack.
7. Open the local preview in a browser; test on your phone using the documented local-network or HTTPS preview instructions. Do not expose development ports to the public internet unintentionally.
8. Iterate using second/third/fourth prompt only after checking the preceding phase works.
9. Keep Git commits/backups of changes. Test on an actual phone before trusting reminders or video playback.

## Alternative: Codex CLI

After installing Node.js/npm and Codex CLI:

```bash
npm install -g @openai/codex@latest
cd /path/to/fit30
codex
```

Sign in to Codex with ChatGPT if requested, then paste the **First prompt** in `CODEX_PROMPTS.md`. For official current Codex guidance see https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan .

## Alternative: Codex Cloud / web

If you prefer Codex web, set up a repository (e.g. GitHub) containing these files and connect/configure it in Codex Cloud. A web/cloud coding task does not automatically have access to downloads on your local computer; ensure the repo contains the project files. See https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex .

## Key requirements to remember

- **30 days, 26 gym sessions, 4 rest days; 30 min active time on gym days**.
- **No more than two rotating strength/core movements** in addition to treadmill/cycle/cooldown. Easy one-exercise-at-a-time UI.
- **Tutorial videos tied to exercise_id**, official embeds, fallback cues; low row may vary by gym equipment.
- **Workout timer pauses during tutorial**; data persists across refresh/offline.
- **Daily reminders** and **within-workout prompts** are separate. Closed-app push needs backend/permissions; ICS calendar export is immediate fallback.
- App should never incorrectly claim that abs exercises alone target belly fat.

## What to verify before declaring the project successful

A user should be able to start Day 3, watch low-row technique, pause/restart a timer, mark a movement skipped, finish (or save partial), refresh, see correct workout history, record waist measurement, and export progress—on a real smartphone without losing data.
