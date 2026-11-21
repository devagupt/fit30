import { z } from "zod";
import rawProgram from "../../data/30_day_gym_plan_with_video_tutorials.json";

const positiveInt = z.number().int().positive();
const text = z.string().min(1);
const exerciseId = z.string().regex(/^[a-z][a-z0-9_]*$/);
const youTubeId = /^[A-Za-z0-9_-]{11}$/;
const repsUnit = z.enum(["repetitions", "repetitions_per_side", "seconds_hold"]);
const category = z.enum(["cardio", "strength", "core", "core_glutes", "recovery"]);

function httpsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port ? url : null;
  } catch {
    return null;
  }
}

function watchId(value: string): string | null {
  const url = httpsUrl(value);
  if (!url || url.hostname !== "www.youtube.com" || url.pathname !== "/watch") return null;
  const ids = url.searchParams.getAll("v");
  return ids.length === 1 && youTubeId.test(ids[0] ?? "") ? (ids[0] ?? null) : null;
}

function embedId(value: string): string | null {
  const url = httpsUrl(value);
  if (!url || !["www.youtube-nocookie.com", "www.youtube.com"].includes(url.hostname)) return null;
  return /^\/embed\/([A-Za-z0-9_-]{11})$/.exec(url.pathname)?.[1] ?? null;
}

const video = z.object({
  provider: z.literal("youtube").nullish(),
  youtube_video_id: z.string().regex(youTubeId).nullish(),
  title: text.nullish(),
  creator: text.nullish(),
  watch_url: text.nullish(),
  embed_url: text.nullish(),
  start_seconds: z.number().int().nonnegative().nullish(),
  end_seconds: positiveInt.nullish(),
  source_page_url: text.refine((value) => httpsUrl(value) !== null).nullish(),
  exercise_match_note: text.nullish(),
  editorial_status: text.nullish(),
  may_embed_if_allowed: z.boolean().nullish(),
  default_open_mode: text.nullish(),
  fallback_open_mode: text.nullish(),
}).passthrough().superRefine((value, context) => {
  const watch = value.watch_url ? watchId(value.watch_url) : null;
  const embed = value.embed_url ? embedId(value.embed_url) : null;
  const expectedId = value.youtube_video_id ?? watch ?? embed;
  if (value.watch_url && (!watch || watch !== expectedId)) {
    context.addIssue({ code: "custom", path: ["watch_url"], message: "Expected a matching official YouTube watch URL" });
  }
  if (value.embed_url && (!embed || embed !== expectedId)) {
    context.addIssue({ code: "custom", path: ["embed_url"], message: "Expected a matching official YouTube embed URL" });
  }
  if (value.end_seconds != null && value.end_seconds <= (value.start_seconds ?? 0)) {
    context.addIssue({ code: "custom", path: ["end_seconds"], message: "Video segment must end after it starts" });
  }
});

const prescriptionFields = {
  duration_min: positiveInt,
  sets: positiveInt.nullable(),
  reps: positiveInt.nullable(),
};

function consistentPrescription(sets: number | null, reps: number | null, unit: string | null): boolean {
  return (sets === null) === (reps === null) && (reps === null) === (unit === null);
}

const defaultPrescription = z.object({
  ...prescriptionFields,
  unit: repsUnit.nullable(),
}).passthrough().refine((value) => consistentPrescription(value.sets, value.reps, value.unit), {
  message: "Sets, repetition or hold target, and unit must be specified together",
});

const exercise = z.object({
  name: text,
  category,
  equipment: text,
  instructions: text,
  back_safety: text,
  default_prescription: defaultPrescription,
  tutorial_video: video.nullish(),
  quick_form_cues: z.array(text),
  instructional_disclaimer: text,
}).passthrough();

const exerciseBlock = z.object({
  ...prescriptionFields,
  order: positiveInt,
  exercise_id: exerciseId,
  reps_unit: repsUnit.nullable(),
  optional: z.boolean(),
  completed: z.literal(false),
}).passthrough().refine((value) => consistentPrescription(value.sets, value.reps, value.reps_unit), {
  message: "Sets, repetition or hold target, and unit must be specified together",
});

const programDay = z.object({
  day_number: positiveInt,
  week_number: positiveInt,
  cycle_day: positiveInt,
  day_type: z.enum(["gym", "rest"]),
  session_name: text,
  focus: text,
  target_gym_minutes: z.number().int().nonnegative(),
  optional_activity_minutes: z.number().int().nonnegative(),
  exercise_blocks: z.array(exerciseBlock),
  tracking: z.object({
    workout_completed: z.literal(false),
    minutes_completed: z.literal(0),
    perceived_effort_1_to_10: z.null(),
    back_pain_0_to_10: z.null(),
    notes: z.literal(""),
  }).passthrough(),
}).passthrough();

const programSchema = z.object({
  schema_version: z.literal("1.1.0"),
  program_id: z.literal("simple_30_min_fitness_30_days"),
  program_name: text,
  program_duration_days: z.literal(30),
  schedule_type: z.literal("relative_day_number"),
  start_date: z.null(),
  timezone: z.literal("Asia/Kolkata"),
  goal: z.array(text),
  constraints: z.object({
    active_days_per_week: z.literal(6),
    rest_days_per_week: z.literal(1),
    target_gym_minutes_per_active_day: z.literal(30),
    max_sessions_per_day: positiveInt,
    lower_back_strain_history: z.boolean(),
  }).passthrough(),
  guidelines: z.array(text),
  daily_tracking_fields: z.array(text),
  weekly_tracking_fields: z.array(text),
  exercise_library: z.record(exerciseId, exercise),
  weekly_rotation: z.array(z.object({
    cycle_day: positiveInt,
    session_name: text,
    focus: text,
    exercise_ids: z.array(exerciseId),
  }).passthrough()).length(7),
  days: z.array(programDay).length(30),
  feature_flags: z.record(z.string(), z.boolean()),
  video_player_policy: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
}).passthrough().superRefine((value, context) => {
  value.days.forEach((day, index) => {
    const cycleDay = index % 7 + 1;
    const rotation = value.weekly_rotation[cycleDay - 1];
    const minutes = day.exercise_blocks.reduce((sum, block) => sum + block.duration_min, 0);
    const path = ["days", index];
    const rest = cycleDay === 7;
    const { day_type, target_gym_minutes, optional_activity_minutes } = day;
    const blockCount = day.exercise_blocks.length;
    const validBudget = rest
      ? day_type === "rest" && target_gym_minutes === 0 && optional_activity_minutes === 20 && minutes === 20 && blockCount === 1
      : day_type === "gym" && target_gym_minutes === 30 && optional_activity_minutes === 0 && minutes === 30 && blockCount === 5;

    if (day.day_number !== index + 1 || day.week_number !== Math.floor(index / 7) + 1 || day.cycle_day !== cycleDay) {
      context.addIssue({ code: "custom", path, message: "Days must follow the 30-day calendar order" });
    }
    if (!validBudget) {
      context.addIssue({ code: "custom", path, message: "Invalid exercise budget for the scheduled gym or rest day" });
    }
    if (!rotation || rotation.cycle_day !== cycleDay || rotation.exercise_ids.length !== blockCount) {
      context.addIssue({ code: "custom", path, message: "Exercise blocks must match the weekly rotation" });
    }
    day.exercise_blocks.forEach((block, blockIndex) => {
      if (!Object.hasOwn(value.exercise_library, block.exercise_id)) {
        context.addIssue({ code: "custom", path: [...path, "exercise_blocks", blockIndex, "exercise_id"], message: "Unknown exercise ID" });
      }
      if (block.order !== blockIndex + 1 || block.optional !== rest || rotation?.exercise_ids[blockIndex] !== block.exercise_id) {
        context.addIssue({ code: "custom", path: [...path, "exercise_blocks", blockIndex], message: "Exercise order or required status differs from the weekly rotation" });
      }
    });
  });
  if (value.days[2]?.exercise_blocks[2]?.exercise_id !== "low_row_machine") {
    context.addIssue({ code: "custom", path: ["days", 2, "exercise_blocks", 2], message: "Day 3 requires the supported low row machine" });
  }
});

export type Exercise = z.infer<typeof exercise>;
export type ExerciseBlock = z.infer<typeof exerciseBlock>;
export type ProgramDay = z.infer<typeof programDay>;
export type RepsUnit = z.infer<typeof repsUnit>;
export type Program = z.infer<typeof programSchema>;

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export function parseProgram(input: unknown): Program {
  return freeze(programSchema.parse(input));
}

export const program = parseProgram(rawProgram);

export function getDay(dayNumber: number): ProgramDay | undefined {
  return program.days[dayNumber - 1];
}

export function getExercise(id: string): Exercise {
  const definition = Object.hasOwn(program.exercise_library, id) ? program.exercise_library[id] : undefined;
  if (!definition) throw new Error(`Unknown exercise ID: ${id}`);
  return definition;
}

function tutorialId(tutorial: NonNullable<Exercise["tutorial_video"]>): string | null {
  const id = tutorial.youtube_video_id
    ?? (tutorial.watch_url ? watchId(tutorial.watch_url) : null)
    ?? (tutorial.embed_url ? embedId(tutorial.embed_url) : null);
  return id && youTubeId.test(id) ? id : null;
}

export function tutorialWatchUrl(definition: Exercise): string | null {
  const tutorial = definition.tutorial_video;
  if (!tutorial) return null;
  const id = tutorialId(tutorial);
  if (!id) return null;
  const url = new URL("https://www.youtube.com/watch");
  url.searchParams.set("v", id);
  if (tutorial.start_seconds != null && tutorial.start_seconds > 0) {
    url.searchParams.set("t", `${tutorial.start_seconds}s`);
  }
  return url.toString();
}

export function tutorialEmbedUrl(definition: Exercise): string | null {
  const tutorial = definition.tutorial_video;
  if (!tutorial || tutorial.may_embed_if_allowed === false) return null;
  const id = tutorialId(tutorial);
  if (!id) return null;

  const url = new URL(`/embed/${id}`, "https://www.youtube-nocookie.com");
  // The iframe is mounted only when the user presses Play video.
  url.searchParams.set("autoplay", "1");
  url.searchParams.set("playsinline", "1");
  if (tutorial.start_seconds) url.searchParams.set("start", String(tutorial.start_seconds));
  if (tutorial.end_seconds) url.searchParams.set("end", String(tutorial.end_seconds));
  return url.toString();
}

const categoryLabels: Record<z.infer<typeof category>, string> = {
  cardio: "Cardio",
  strength: "Strength",
  core: "Core",
  core_glutes: "Core & glutes",
  recovery: "Recovery",
};

export function categoryLabel(value: Exercise["category"]): string {
  return categoryLabels[value];
}

const repetitionLabels: Record<RepsUnit, string> = {
  repetitions: "reps",
  repetitions_per_side: "reps per side",
  seconds_hold: "sec hold",
};

export function formatPrescription(block: ExerciseBlock): string {
  if (block.reps_unit === null) return `${block.duration_min} min`;
  return `${block.sets} × ${block.reps} ${repetitionLabels[block.reps_unit]} · ${block.duration_min} min`;
}
