import { describe, it, expect } from "vitest";
import { nightShiftMorningFrom } from "../src/domain/sources/sources";

describe("nightShiftMorningFrom", () => {
  it("derives the morning from the heading within the fallback year", () => {
    const raw = "## Night of Wed 27 May -> morning Thu 28 May";
    expect(nightShiftMorningFrom(raw, "2026-05-30")).toBe("2026-05-28");
  });
  it("rolls the year forward across a December to January boundary", () => {
    const raw = "## Night of Wed 31 Dec -> morning Thu 1 Jan";
    expect(nightShiftMorningFrom(raw, "2026-12-31")).toBe("2027-01-01");
  });
  it("falls back when the heading has no morning phrase", () => {
    expect(nightShiftMorningFrom("no heading here", "2026-05-30")).toBe("2026-05-30");
  });
});
