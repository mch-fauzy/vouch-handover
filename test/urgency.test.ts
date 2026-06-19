import { describe, it, expect } from "vitest";
import { sectionFor } from "../src/domain/compose/urgency";
import type { Thread } from "../src/domain/types";

function thread(p: Partial<Thread> & { issue: string }): Thread {
  return { observations: [], state: "still_open", flags: [], ...p } as Thread;
}
function withText(t: Thread, text: string): Thread {
  return { ...t, observations: [{ source: { feed: "events", ref: "e", verbatim: text } } as any] };
}

describe("sectionFor", () => {
  it("routes any needs-review flag to needsReview", () => {
    expect(sectionFor(thread({ issue: "noshow:312", state: "contradiction", flags: ["contradiction"] }))).toBe("needsReview");
    expect(sectionFor(thread({ issue: "damage:226", flags: ["unapproved"] }))).toBe("needsReview");
    expect(sectionFor(thread({ issue: "guest-note:214", flags: ["embedded_instruction"] }))).toBe("needsReview");
    expect(sectionFor(thread({ issue: "occupancy:205", flags: ["discrepancy"] }))).toBe("needsReview");
    expect(sectionFor(thread({ issue: "safe:208", flags: ["stale"] }))).toBe("needsReview");
  });
  it("routes an open compliance-deadline thread to onFire", () => {
    const t = withText(thread({ issue: "compliance:passport-scan", state: "still_open" }), "deadline is 48 hours from check-in");
    expect(sectionFor(t)).toBe("onFire");
  });
  it("routes an open deposit-before-checkout thread to onFire", () => {
    const t = withText(thread({ issue: "deposit:309", state: "still_open" }), "deposit never collected, guest checks out tomorrow");
    expect(sectionFor(t)).toBe("onFire");
  });
  it("routes a guest blocked by a jammed safe to onFire", () => {
    const t = withText(thread({ issue: "safe:208", state: "new_tonight" }), "safe will not open, passport locked inside, checkout tomorrow for a flight");
    expect(sectionFor(t)).toBe("onFire");
  });
  it("routes a genuine medical emergency to onFire", () => {
    const t = withText(thread({ issue: "medical:401", state: "new_tonight" }), "guest collapsed, ambulance called");
    expect(sectionFor(t)).toBe("onFire");
  });
  it("does not route a declined-ambulance awareness note to onFire", () => {
    const t = withText(thread({ issue: "medical:301", state: "still_open" }), "Guest felt unwell, declined ambulance, said she was okay. Logged for awareness.");
    expect(sectionFor(t)).toBe("pending");
  });
  it("routes a clean open thread with no urgency to pending", () => {
    const t = withText(thread({ issue: "aircon:112", state: "still_open" }), "compressor part on order, repair scheduled Saturday");
    expect(sectionFor(t)).toBe("pending");
  });
  it("routes a newly resolved thread to fyi", () => {
    expect(sectionFor(thread({ issue: "leak:corridor", state: "newly_resolved" }))).toBe("fyi");
  });
  it("routes an info-only open thread to fyi, not pending", () => {
    const t = {
      ...thread({ issue: "occupancy:115", state: "still_open" }),
      observations: [{ source: { feed: "night-log", ref: "night-logs.md L15", verbatim: "guest fine, still in 115" }, signal: "info" } as any],
    };
    expect(sectionFor(t)).toBe("fyi");
  });
});
