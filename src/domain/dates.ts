import { program } from "./program";

type Schedule = { startDate: string };

export function isLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isProgramStartDate(value: string): boolean {
  return isLocalDate(value) && value <= "9999-12-02";
}

export function isTimeZone(value: string): boolean {
  if (!value || value.length > 100 || /^[+-]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function localDate(timezone: string = program.timezone, now = Date.now()): string {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value.padStart(4, "0");
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) throw new Error("Could not resolve local calendar date");
  return `${year}-${month}-${day}`;
}

function dateAtUtcMidnight(value: string): Date {
  if (!isLocalDate(value)) throw new RangeError("Invalid calendar date");
  return new Date(`${value}T00:00:00Z`);
}

export function addDays(value: string, amount: number): string {
  if (!Number.isSafeInteger(amount)) throw new RangeError("Day offset must be a whole number");
  const date = dateAtUtcMidnight(value);
  date.setUTCDate(date.getUTCDate() + amount);
  const result = date.toISOString().split("T")[0] ?? "";
  if (!isLocalDate(result)) throw new RangeError("Calendar date is out of range");
  return result;
}

export function scheduledDate(run: Schedule, dayNumber: number): string {
  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > program.program_duration_days) {
    throw new RangeError("Invalid program day");
  }
  return addDays(run.startDate, dayNumber - 1);
}

export function dayNumberOn(run: Schedule, value: string): number | null {
  // Both UTC midnights represent date labels in the same artificial calendar.
  // The subtraction never compares real instants in the user's time zone.
  const difference = dateAtUtcMidnight(value).getTime() - dateAtUtcMidnight(run.startDate).getTime();
  const dayNumber = difference / 86_400_000 + 1;
  return dayNumber >= 1 && dayNumber <= program.program_duration_days ? dayNumber : null;
}

export function formatDate(value: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-IN", {
    ...(options ?? { weekday: "short", month: "short", day: "numeric" }),
    timeZone: "UTC",
  }).format(dateAtUtcMidnight(value));
}
