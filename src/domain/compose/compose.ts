import type { Thread, Handover, HandoverItem, Section } from "../types";
import { sectionFor } from "./urgency";
import { verifyRefs } from "../verify-refs/verify-refs";

// Deterministic, human-readable phrasing from grounded fields. No model wording.
const STATE_LABEL: Record<string, string> = {
  still_open: "Open", new_tonight: "New tonight", newly_resolved: "Resolved overnight",
  resolved_earlier: "Resolved", contradiction: "Sources disagree",
};

function toItem(t: Thread): HandoverItem {
  const refs = t.observations.map((o) => o.source.ref);
  const sides = t.state === "contradiction"
    ? t.observations.map((o) => ({ text: o.source.translation ?? o.source.verbatim, ref: o.source.ref }))
    : undefined;
  const detail = sides
    ? sides.map((s) => `- ${s.text} [${s.ref}]`).join("\n")
    : t.observations.map((o) => o.source.translation ?? o.source.verbatim).join(" | ");
  return { title: `${STATE_LABEL[t.state]}: ${t.issue}`, detail, refs, sides };
}

// Returns the handover plus the count of items dropped here because a ref did not resolve, so
// the pipeline summary can report every unsourced drop, not just the ones from normalize.
export function compose(
  threads: Thread[],
  ctx: { hotelId: string; morning: string; knownEventIds: Set<string>; nightLineCount: number; notices?: string[] },
): { handover: Handover; droppedItems: number } {
  const buckets: Record<Section, HandoverItem[]> = { onFire: [], pending: [], fyi: [], needsReview: [] };
  let droppedItems = 0;
  for (const t of threads) {
    const item = toItem(t);
    const [verified] = verifyRefs([item], ctx.knownEventIds, ctx.nightLineCount).kept;
    if (!verified) {
      droppedItems++;
      continue;
    }
    buckets[sectionFor(t)].push(verified);
  }
  const handover: Handover = {
    hotelId: ctx.hotelId, morning: ctx.morning, generatedAt: new Date().toISOString(),
    notices: ctx.notices ?? [],
    onFire: buckets.onFire, pending: buckets.pending, fyi: buckets.fyi, needsReview: buckets.needsReview,
  };
  return { handover, droppedItems };
}
