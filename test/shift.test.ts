import { describe, it, expect } from "vitest";
import { shiftMorning } from "../src/domain/normalize/rules/shift";

describe("shiftMorning", () => {
  it("anchors a late-evening start to the next morning", () => {
    expect(shiftMorning("2026-05-25T23:14:00+08:00")).toBe("2026-05-26");
  });
  it("anchors an after-midnight record to the same date morning", () => {
    expect(shiftMorning("2026-05-26T03:10:00+08:00")).toBe("2026-05-26");
  });
  it("anchors an early-morning record to the same date morning", () => {
    expect(shiftMorning("2026-05-30T05:15:00+08:00")).toBe("2026-05-30");
  });
  it("rolls month and year at boundaries", () => {
    expect(shiftMorning("2026-12-31T23:50:00+08:00")).toBe("2027-01-01");
  });
});
