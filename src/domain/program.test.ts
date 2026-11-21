import { describe, expect, it } from "vitest";
import canonical from "../../data/30_day_gym_plan_with_video_tutorials.json";
import { formatPrescription, getDay, getExercise, parseProgram, program, tutorialEmbedUrl, tutorialWatchUrl } from "./program";

describe("canonical plan", () => {
  it("retains the exact seed and the prescribed calendar and budgets", () => {
    expect(program).toEqual(canonical);
    expect(Object.isFrozen(program.days[0]?.exercise_blocks[0])).toBe(true);
    expect(program.start_date).toBeNull();
    expect(program.timezone).toBe("Asia/Kolkata");
    expect(program.days).toHaveLength(30);

    const rest = program.days.filter((day) => day.day_type === "rest");
    expect(rest.map((day) => day.day_number)).toEqual([7, 14, 21, 28]);
    for (const day of rest) {
      expect(day.target_gym_minutes).toBe(0);
      expect(day.exercise_blocks).toMatchObject([{ exercise_id: "optional_walk", duration_min: 20, optional: true }]);
    }

    const gym = program.days.filter((day) => day.day_type === "gym");
    expect(gym).toHaveLength(26);
    for (const day of gym) {
      expect(day.target_gym_minutes).toBe(30);
      expect(day.exercise_blocks.map((block) => block.duration_min)).toEqual([10, 8, 5, 5, 2]);
      for (const block of day.exercise_blocks) {
        expect(tutorialWatchUrl(getExercise(block.exercise_id))).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=/);
      }
    }
  });

  it("uses the supported low row and its own timestamped video on Day 3", () => {
    const block = getDay(3)?.exercise_blocks[2];
    expect(block?.exercise_id).toBe("low_row_machine");
    const row = getExercise("low_row_machine");
    expect(row.name).toBe("Low row machine (lower row)");
    expect(row.tutorial_video?.exercise_match_note).toContain("chest-supported");
    expect(row.tutorial_video?.editorial_status).toContain("review_equipment_match");
    expect(tutorialWatchUrl(row)).toBe("https://www.youtube.com/watch?v=FU6YQawma2Q&t=13s");
    expect(tutorialWatchUrl(getExercise("stationary_cycling"))).toContain("t=164s");
  });

  it("builds an official inline player for every exercise and preserves the segment", () => {
    for (const [id, definition] of Object.entries(program.exercise_library)) {
      const video = canonical.exercise_library[id as keyof typeof canonical.exercise_library].tutorial_video;
      const embed = tutorialEmbedUrl(definition);
      if (!embed) throw new Error(`Missing embed for ${id}`);
      const url = new URL(embed);

      expect(url.origin).toBe("https://www.youtube-nocookie.com");
      expect(url.pathname).toBe(`/embed/${video.youtube_video_id}`);
      expect(url.searchParams.get("start")).toBe(video.start_seconds ? String(video.start_seconds) : null);
      expect(url.searchParams.get("end")).toBe(video.end_seconds ? String(video.end_seconds) : null);
      expect(url.searchParams.get("playsinline")).toBe("1");
    }
  });

  it("respects the embed permission while keeping the official watch page available", () => {
    const exercise = getExercise("low_row_machine");
    const restricted = { ...exercise, tutorial_video: { ...exercise.tutorial_video, may_embed_if_allowed: false } };

    expect(tutorialEmbedUrl(restricted)).toBeNull();
    expect(tutorialWatchUrl(restricted)).toContain("v=FU6YQawma2Q");
  });

  it("preserves the seconds and per-side units", () => {
    const plank = getDay(1)?.exercise_blocks[3];
    const birdDog = getDay(2)?.exercise_blocks[3];
    if (!plank || !birdDog) throw new Error("Missing prescribed exercise");
    expect(formatPrescription(plank)).toBe("2 × 20 sec hold · 5 min");
    expect(formatPrescription(birdDog)).toBe("2 × 8 reps per side · 5 min");
  });

  it("rejects unsafe and mismatched video URLs, with a written-only fallback for missing metadata", () => {
    const row = getExercise("low_row_machine");
    const updateRow = (changes: Partial<typeof row>) => ({
      ...program,
      exercise_library: { ...program.exercise_library, low_row_machine: { ...row, ...changes } },
    });
    for (const watch_url of [
      "javascript:alert(1)",
      "https://www.youtube.com.example/watch?v=FU6YQawma2Q",
      "https://www.youtube.com@other.example/watch?v=FU6YQawma2Q",
      "https://www.youtube.com/watch?v=D8b3OVbRfwE",
    ]) {
      expect(() => parseProgram(updateRow({ tutorial_video: { ...row.tutorial_video, watch_url } }))).toThrow("official YouTube watch URL");
    }
    for (const embed_url of [
      "javascript:alert(1)",
      "https://www.youtube-nocookie.com.example/embed/FU6YQawma2Q",
      "https://www.youtube-nocookie.com/embed/D8b3OVbRfwE",
    ]) {
      expect(() => parseProgram(updateRow({ tutorial_video: { ...row.tutorial_video, embed_url } }))).toThrow("official YouTube embed URL");
    }
    const fallback = parseProgram(updateRow({ tutorial_video: null })).exercise_library.low_row_machine;
    if (!fallback) throw new Error("Missing fallback definition");
    expect(tutorialWatchUrl(fallback)).toBeNull();
    expect(tutorialEmbedUrl(fallback)).toBeNull();
    expect(fallback.instructions).toContain("Pull smoothly");
  });

  it("rejects changed dates, unresolved exercise IDs, and altered minute budgets", () => {
    const duplicate = structuredClone(program);
    const second = duplicate.days[1];
    if (!second) throw new Error("Missing Day 2");
    second.day_number = 1;
    expect(() => parseProgram(duplicate)).toThrow("calendar order");

    const altered = structuredClone(program);
    const first = altered.days[0]?.exercise_blocks[0];
    if (!first) throw new Error("Missing Day 1 block");
    first.exercise_id = "invented_exercise";
    first.duration_min = 4;
    expect(() => parseProgram(altered)).toThrow("Unknown exercise ID");
    expect(() => parseProgram(altered)).toThrow("Invalid exercise budget");
  });
});
