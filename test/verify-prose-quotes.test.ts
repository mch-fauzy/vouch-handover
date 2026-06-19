import { describe, it, expect } from "vitest";
import { verifyProseQuotes } from "../src/domain/normalize/verify-prose-quotes";

const raw = [
  "line one",
  "- Room 112 aircon - maintenance came, it is the compressor, part on order. 112 stays out of order.",
  "- 309 deposit from Tuesday still not settled.",
].join("\n");

const good = {
  lineStart: 2, lineEnd: 2, quote: "Room 112 aircon", room: "112", guest: null,
  topic: "aircon", signal: "update" as const, language: "en", confidence: 0.9,
};

describe("verifyProseQuotes", () => {
  it("keeps an observation whose quote is a real substring of the cited lines", () => {
    const { observations, dropped } = verifyProseQuotes(raw, [good], "2026-05-28");
    expect(dropped).toHaveLength(0);
    expect(observations[0].issue).toBe("aircon:112");
    // verbatim is rebuilt from the file, not the model echo
    expect(observations[0].source.verbatim).toContain("compressor");
    expect(observations[0].source.ref).toBe("night-logs.md L2");
  });
  it("drops + logs an observation whose quote is not in the cited lines", () => {
    const bad = { ...good, quote: "guest approved a refund" };
    const { observations, dropped } = verifyProseQuotes(raw, [bad], "2026-05-28");
    expect(observations).toHaveLength(0);
    expect(dropped[0].reason).toMatch(/unverifiable/i);
  });
  it("drops + logs an observation whose line range is out of file bounds", () => {
    const oob = { ...good, lineStart: 99, lineEnd: 99 };
    const { observations, dropped } = verifyProseQuotes(raw, [oob], "2026-05-28");
    expect(observations).toHaveLength(0);
    expect(dropped[0].reason).toMatch(/range/i);
  });
  it("keeps a non-English observation with translation and non_english flag", () => {
    const zhRaw = "- 208 房的保险箱打不开了，护照锁在里面，明天退房赶飞机。";
    const zh = {
      lineStart: 1, lineEnd: 1, quote: "保险箱打不开", room: "208", guest: null,
      topic: "safe", signal: "opened" as const, language: "zh",
      translation: "Room 208 safe will not open, passport locked inside, checkout tomorrow for a flight.",
      confidence: 0.85,
    };
    const { observations } = verifyProseQuotes(zhRaw, [zh], "2026-05-28");
    expect(observations[0].language).toBe("zh");
    expect(observations[0].source.translation).toMatch(/safe/i);
    expect(observations[0].flags).toContain("non_english");
  });
  it("flags low_confidence when the model key confidence is below threshold", () => {
    const weak = { ...good, confidence: 0.4 };
    const { observations } = verifyProseQuotes(raw, [weak], "2026-05-28");
    expect(observations[0].flags).toContain("low_confidence");
  });
  it("flags discrepancy when cited lines show a system-vs-reality conflict", () => {
    const dRaw = "- 205 door ajar, bed clearly not slept in, no luggage. System still shows Mr Chen in 205 as in-house.";
    const disc = {
      lineStart: 1, lineEnd: 1, quote: "bed clearly not slept in", room: "205", guest: null,
      topic: "occupancy", signal: "opened" as const, language: "en", confidence: 0.9,
    };
    const { observations } = verifyProseQuotes(dRaw, [disc], "2026-05-28");
    expect(observations[0].flags).toContain("discrepancy");
  });
  it("composes a room-scoped key from topic and room", () => {
    const safeRaw = "- safe in 401 jammed, guest cannot leave.";
    const safe = {
      lineStart: 1, lineEnd: 1, quote: "safe in 401 jammed", room: "401", guest: null,
      topic: "safe", signal: "opened" as const, language: "en", confidence: 0.9,
    };
    const { observations } = verifyProseQuotes(safeRaw, [safe], "2026-05-28");
    // the room comes from the model, not a hardcoded vocabulary, so an unseen room works
    expect(observations[0].issue).toBe("safe:401");
  });
  it("composes a global-scope key that ignores the room", () => {
    const leakRaw = "- leak in the corridor near 215 getting worse.";
    const leak = {
      lineStart: 1, lineEnd: 1, quote: "leak in the corridor", room: "215", guest: null,
      topic: "leak", signal: "update" as const, language: "en", confidence: 0.9,
    };
    const { observations } = verifyProseQuotes(leakRaw, [leak], "2026-05-28");
    expect(observations[0].issue).toBe("leak:corridor");
  });
  it("treats a model language name like 'English' as English, not non_english", () => {
    const en = { ...good, language: "English" };
    const { observations } = verifyProseQuotes(raw, [en], "2026-05-28");
    expect(observations[0].language).toBe("en");
    expect(observations[0].flags).not.toContain("non_english");
  });
  it("drops a topic that is not in the shared vocabulary", () => {
    const offList = { ...good, topic: "maintenance" };
    const { observations, dropped } = verifyProseQuotes(raw, [offList], "2026-05-28");
    expect(observations).toHaveLength(0);
    expect(dropped[0].reason).toMatch(/unknown topic/i);
  });
});
