import { describe, it, expect } from "vitest";
import { verifyRefs } from "../src/domain/verify-refs/verify-refs";
import type { HandoverItem } from "../src/domain/types";

const known = new Set(["evt_0014", "evt_0019"]);
const lineCount = 29;

function item(refs: string[]): HandoverItem {
  return { title: "t", detail: "d", refs };
}

describe("verifyRefs", () => {
  it("keeps items whose every ref resolves to real input", () => {
    const { kept, dropped } = verifyRefs([item(["evt_0014", "night-logs.md L23"])], known, lineCount);
    expect(kept).toHaveLength(1);
    expect(dropped).toHaveLength(0);
  });
  it("drops + logs an item citing an unknown event id", () => {
    const { kept, dropped } = verifyRefs([item(["evt_9999"])], known, lineCount);
    expect(kept).toHaveLength(0);
    expect(dropped[0].reason).toMatch(/event/i);
  });
  it("drops + logs an item citing a night-log line out of bounds", () => {
    const { kept, dropped } = verifyRefs([item(["night-logs.md L99"])], known, lineCount);
    expect(kept).toHaveLength(0);
    expect(dropped[0].reason).toMatch(/range/i);
  });
  it("drops an item with no refs at all", () => {
    const { kept, dropped } = verifyRefs([item([])], known, lineCount);
    expect(kept).toHaveLength(0);
    expect(dropped[0].reason).toMatch(/no source/i);
  });
});
