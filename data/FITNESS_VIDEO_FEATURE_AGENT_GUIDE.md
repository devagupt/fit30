# Video Tutorial Feature — Exercise Tracker Agent Handoff

## Files
- `30_day_gym_plan_with_video_tutorials.json`: all 30 days, existing prescriptions and log fields, plus video metadata in `exercise_library[exercise_id].tutorial_video`.
- `gym_exercise_video_catalog.csv`: flattened video source library and safety cues; suitable for review / UI database imports.

## Required functionality
1. Load the JSON and schedule the existing 30-day workouts; do not rebuild the program from scratch.
2. Resolve each `exercise_blocks[*].exercise_id` to `exercise_library[exercise_id]`. Show workout duration, sets, repetitions, back safety, and Watch Tutorial.
3. In `Watch Tutorial`, embed `https://www.youtube-nocookie.com/embed/{youtube_video_id}` with the official player using start/end seconds when present. Support pause, seek, replay, captions (when available), playback speed (when allowed), fullscreen and a close button.
4. **Pause the workout timer while a tutorial is open** so the user has 30 exercise minutes regardless of learning time.
5. On the first encounter with a new exercise, optionally offer Watch Tutorial; after first view keep it accessible but do not auto-play or repeatedly interrupt the workout.
6. For exercise transitions, sound/vibrate only when the workout has started. Never schedule fixed time-of-day notifications per exercise.
7. If the video link fails, privacy/embed restrictions prevent playback, or connectivity fails, show technique cues and `watch_url` as an external fallback; never block workout completion.
8. Store exercise-level progress and the watched/skip-video choice independently from the static program JSON. Do not overwrite exercise definitions with completion data.
9. Match the tutorial to the equipment. In particular, **low row** needs a supported/chest-supported machine matching the gym equipment, and leg press types differ. If mismatch, show a warning and allow choosing a replacement tutorial.
10. Videos come from third-party creators and remain their copyrighted works. Follow YouTube's terms. Do not download/rehost their footage without permission.

## Model and example (exercise library entry)
```json
{
  "exercise_id": "low_row_machine",
  "name": "Low row machine (lower row)",
  "tutorial_video": {
    "provider": "youtube",
    "youtube_video_id": "FU6YQawma2Q",
    "watch_url": "https://www.youtube.com/watch?v=FU6YQawma2Q",
    "start_seconds": 13,
    "end_seconds": 118
  }
}
```

## Reliability and clinical caution
The linked pages/videos were found and the titles/content descriptions appear relevant, but **not all videos were watched end-to-end or individually assessed by a clinician**. Validate URL status, embeddability, and exact gym-machine form before production; videos are educational, not injury-specific advice. Choose exercises and movement ranges that remain pain-free.

## Minimal acceptance tests
- Every `exercise_id` in all 30 days maps to an existing library entry and a non-empty tutorial URL.
- Clicking Watch Tutorial on each exercise opens its matching video, not the video for the preceding exercise.
- A user can close a tutorial, resume their timer, log reps and mark an exercise completed.
- A blocked or unavailable embed still allows reading instructions and completing a workout.
- Rest days remain rest days and do not generate a 30-minute workout session.
