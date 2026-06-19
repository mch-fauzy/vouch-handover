import type { Thread, Section, Flag } from "../types";

const NEEDS_REVIEW: Flag[] = [
  "contradiction", "embedded_instruction", "unapproved", "low_confidence", "discrepancy", "stale",
];

export function isOpen(t: Thread): boolean {
  return t.state === "still_open" || t.state === "new_tonight";
}

// A thread carrying only information notes is not an action item: it belongs in FYI.
function isInfoOnly(t: Thread): boolean {
  return t.observations.length > 0 && t.observations.every((o) => o.signal === "info");
}

function text(t: Thread): string {
  return t.observations.map((o) => `${o.source.verbatim} ${o.source.translation ?? ""}`).join(" ").toLowerCase();
}

// Deterministic urgency triggers over grounded text. Keep keywords broad enough to survive
// unseen wording but specific enough not to misfire.
function isUrgent(t: Thread): boolean {
  const d = text(t);
  const complianceDeadline = /deadline|48\s*hour/.test(d);
  const moneyBeforeCheckout = /(deposit|charge|refund)/.test(d) && /(checks?\s*out|checkout|check-out)/.test(d);
  // Genuine emergency only. "declined ambulance" / "felt unwell, said okay" must NOT fire.
  const safety = /(ambulance\s+(called|dispatched|en route|requested and (sent|came))|collapsed|unconscious|injur|bleeding|\bfire\b|evacuat)/.test(d);
  const guestBlocked = /(safe|保险箱).*(flight|赶飞机|cannot leave|can't leave|退房)/.test(d) || /(flight|赶飞机).*(safe|保险箱|locked)/.test(d);
  return complianceDeadline || moneyBeforeCheckout || safety || guestBlocked;
}

export function sectionFor(thread: Thread): Section {
  if (thread.flags.some((f) => NEEDS_REVIEW.includes(f))) return "needsReview";
  if (isInfoOnly(thread)) return "fyi";
  const open = isOpen(thread);
  if (open && isUrgent(thread)) return "onFire";
  if (open) return "pending";
  return "fyi";
}
