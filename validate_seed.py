#!/usr/bin/env python3
"""Standalone quick-check of Fit30's canonical seed. No dependencies."""
import json
from pathlib import Path

p = Path(__file__).parent / 'data' / '30_day_gym_plan_with_video_tutorials.json'
d = json.loads(p.read_text(encoding='utf-8'))
assert len(d['days']) == 30
assert [day['day_number'] for day in d['days']] == list(range(1, 31))
assert sum(day['day_type'] == 'gym' for day in d['days']) == 26
assert [x['day_number'] for x in d['days'] if x['day_type'] == 'rest'] == [7,14,21,28]
for day in d['days']:
    assert all(b['exercise_id'] in d['exercise_library'] for b in day['exercise_blocks'])
    if day['day_type'] == 'gym':
        assert day['target_gym_minutes'] == 30
        assert sum(b['duration_min'] for b in day['exercise_blocks']) == 30
    else:
        assert day['target_gym_minutes'] == 0
for key, exercise in d['exercise_library'].items():
    vid = exercise.get('tutorial_video')
    assert vid and (vid.get('watch_url') or vid.get('youtube_video_id')), key
print('PASS: 30 days, 26 gym days, 4 rest days, 30-min gym sessions, exercise/video references valid')
