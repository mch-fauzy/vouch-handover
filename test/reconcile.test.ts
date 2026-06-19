import { describe, it, expect } from "vitest";
import { reconcile } from "../src/domain/reconcile/reconcile";
import type { Observation, Signal } from "../src/domain/types";

function obs(p: Partial<Observation> & { issue: string; shiftMorning: string; signal: Signal }): Observation {
  return {
    id: Math.random().toString(36).slice(2),
    source: { feed: "events", ref: "evt_x", verbatim: "x" },
    occurredAt: `${p.shiftMorning}T03:00:00+08:00`,
    room: null, guest: null, language: "en", confidence: 1, flags: [],
    ...p,
  };
}

describe("reconcile", () => {
  it("ignores shifts after the target morning", () => {
    const threads = reconcile(
      [obs({ issue: "aircon:112", shiftMorning: "2026-05-31", signal: "resolved" })],
      "2026-05-30",
    );
    expect(threads).toHaveLength(0);
  });
  it("classifies a thread opened earlier with no resolution as still_open", () => {
    const threads = reconcile([
      obs({ issue: "aircon:112", shiftMorning: "2026-05-26", signal: "opened" }),
      obs({ issue: "aircon:112", shiftMorning: "2026-05-30", signal: "update" }),
    ], "2026-05-30");
    expect(threads[0].state).toBe("still_open");
  });
  it("classifies resolution on the target morning as newly_resolved", () => {
    const threads = reconcile([
      obs({ issue: "leak:corridor", shiftMorning: "2026-05-27", signal: "opened" }),
      obs({ issue: "leak:corridor", shiftMorning: "2026-05-29", signal: "resolved" }),
    ], "2026-05-29");
    expect(threads[0].state).toBe("newly_resolved");
  });
  it("classifies a resolution before the target morning as resolved_earlier", () => {
    const threads = reconcile([
      obs({ issue: "leak:corridor", shiftMorning: "2026-05-27", signal: "opened" }),
      obs({ issue: "leak:corridor", shiftMorning: "2026-05-29", signal: "resolved" }),
    ], "2026-05-30");
    expect(threads[0].state).toBe("resolved_earlier");
  });
  it("classifies a first-appearance on the target morning as new_tonight", () => {
    const threads = reconcile(
      [obs({ issue: "damage:226", shiftMorning: "2026-05-30", signal: "opened" })],
      "2026-05-30",
    );
    expect(threads[0].state).toBe("new_tonight");
  });
  it("classifies a disputed thread as contradiction and keeps every side", () => {
    const threads = reconcile([
      obs({ issue: "noshow:312", shiftMorning: "2026-05-27", signal: "opened" }),
      obs({ issue: "noshow:312", shiftMorning: "2026-05-28", signal: "resolved" }),
      obs({ issue: "noshow:312", shiftMorning: "2026-05-29", signal: "disputed" }),
    ], "2026-05-30");
    expect(threads[0].state).toBe("contradiction");
    expect(threads[0].flags).toContain("contradiction");
    expect(threads[0].observations).toHaveLength(3);
  });
  it("does not treat a lone disputed record as a contradiction", () => {
    const threads = reconcile(
      [obs({ issue: "checkout:205", shiftMorning: "2026-05-28", signal: "disputed" })],
      "2026-05-28",
    );
    expect(threads[0].state).not.toBe("contradiction");
    expect(threads[0].flags).not.toContain("contradiction");
  });
  it("does not flag an info-only thread as stale", () => {
    const threads = reconcile(
      [obs({ issue: "occupancy:115", shiftMorning: "2026-05-28", signal: "info" })],
      "2026-05-30",
    );
    expect(threads[0].flags).not.toContain("stale");
  });
  it("flags an open thread gone quiet as stale", () => {
    const threads = reconcile(
      [obs({ issue: "safe:208", shiftMorning: "2026-05-28", signal: "opened" })],
      "2026-05-30",
    );
    expect(threads[0].state).toBe("still_open");
    expect(threads[0].flags).toContain("stale");
  });
  it("does not flag a recently updated open thread as stale", () => {
    const threads = reconcile(
      [obs({ issue: "safe:208", shiftMorning: "2026-05-28", signal: "opened" })],
      "2026-05-28",
    );
    expect(threads[0].flags).not.toContain("stale");
  });
});
