import type { HandoverItem } from "../types";
import log from "../../logger";
import { parseNightLogRef } from "../refs";

function refResolves(ref: string, knownEventIds: Set<string>, nightLineCount: number): string | null {
  if (/^evt_/.test(ref)) return knownEventIds.has(ref) ? null : "unknown event id";
  const range = parseNightLogRef(ref);
  if (range) {
    if (range.start >= 1 && range.end <= nightLineCount && range.start <= range.end) return null;
    return "night-log line range out of bounds";
  }
  return "unrecognized ref format";
}

// The last check before render: every emitted ref must resolve to real input, across both sources
// (event id or night-log line). Anything unsourced is dropped and logged, never rendered. This
// catches a fabricated ref even if compose produced it.
export function verifyRefs(
  items: HandoverItem[],
  knownEventIds: Set<string>,
  nightLineCount: number,
): { kept: HandoverItem[]; dropped: { ref: string; reason: string }[] } {
  const kept: HandoverItem[] = [];
  const dropped: { ref: string; reason: string }[] = [];
  for (const it of items) {
    if (it.refs.length === 0) {
      dropped.push({ ref: it.title, reason: "no source ref" });
      continue;
    }
    // Every ref must resolve. The first that does not drops the whole item: a partly
    // unsourced item is not trustworthy.
    let badRef: { ref: string; reason: string } | null = null;
    for (const r of it.refs) {
      const reason = refResolves(r, knownEventIds, nightLineCount);
      if (reason) { badRef = { ref: r, reason }; break; }
    }
    if (badRef) {
      dropped.push(badRef);
      continue;
    }
    kept.push(it);
  }
  for (const d of dropped) log({ level: "warn", event: "dropped_unsourced", ref: d.ref, reason: d.reason });
  return { kept, dropped };
}
