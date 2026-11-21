import { describe, expect, it } from "vitest";
import { addDays, dayNumberOn, isLocalDate, isProgramStartDate, isTimeZone, localDate, scheduledDate } from "./dates";

describe("local program calendar", () => {
  const run = { startDate: "2026-11-20", timezone: "Asia/Kolkata" };

  it("maps Day 2 and Day 7 without moving dates across month rollover", () => {
    expect(scheduledDate(run, 2)).toBe("2026-11-21");
    expect(scheduledDate(run, 7)).toBe("2026-11-26");
    expect(scheduledDate(run, 12)).toBe("2026-12-01");
    expect(scheduledDate(run, 30)).toBe("2026-12-19");
    expect(dayNumberOn(run, "2026-12-01")).toBe(12);
    expect(dayNumberOn(run, "2026-11-19")).toBeNull();
    expect(dayNumberOn(run, "2026-12-20")).toBeNull();
  });

  it("rolls over at midnight in Kolkata, independently from the host", () => {
    const parse = (value: string) => Date.parse(value);
    expect(localDate(run.timezone, parse("2026-11-20T18:29:59.999Z"))).toBe("2026-11-20");
    expect(localDate(run.timezone, parse("2026-11-20T18:30:00.000Z"))).toBe("2026-11-21");
    expect(localDate("America/Los_Angeles", parse("2026-11-20T18:30:00.000Z"))).toBe("2026-11-20");
  });

  it("counts calendar days over leap years, year boundaries, and daylight saving", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(scheduledDate({ startDate: "2026-11-01" }, 2)).toBe("2026-11-02");
    expect(localDate("America/New_York", Date.parse("2026-11-02T04:59:00Z"))).toBe("2026-11-01");
    expect(localDate("America/New_York", Date.parse("2026-11-02T05:00:00Z"))).toBe("2026-11-02");
  });

  it("validates calendar input and named timezones", () => {
    expect(isLocalDate("2026-02-29")).toBe(false);
    expect(isLocalDate("2026-11-2")).toBe(false);
    expect(isLocalDate("0000-01-01")).toBe(false);
    expect(isTimeZone("Europe/London")).toBe(true);
    expect(isTimeZone("Christmas Island or Mars")).toBe(false);
    expect(isProgramStartDate("9999-12-02")).toBe(true);
    expect(isProgramStartDate("9999-12-03")).toBe(false);
    expect(() => scheduledDate(run, 31)).toThrow("Invalid program day");
  });
});
