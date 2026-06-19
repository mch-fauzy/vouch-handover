// Deterministic content detectors for trust flags that need surfacing to needs-review.
// Both are keyword based and id-agnostic so they survive unseen wording and other hotels.

// An action proposed without the evidence or approval it requires: a charge or fee that the
// text itself admits lacks photos or manager sign-off. Flag, never endorse.
export function hasUnapprovedAction(text: string): boolean {
  const d = text.toLowerCase();
  const proposesCharge = /\b(propos\w*|charg\w*|fee|damage)\b/.test(d);
  const missingEvidence = /\bno\s+(photo|photos|approval|manager approval)\b/.test(d) ||
    /\bwithout\s+approval\b/.test(d) ||
    /\bnot\s+approved\b/.test(d) ||
    /no\s+\w+\s+approval\s+on\s+record/.test(d);
  return proposesCharge && missingEvidence;
}

// System of record says one thing, the physical world says another: a room shown occupied
// while staff report it empty or unslept. Surface both sides, do not pick one.
export function hasDiscrepancy(text: string): boolean {
  const d = text.toLowerCase();
  const systemOccupied =
    /(system|record|shows?)\b.{0,40}\b(in-house|in house|occupied|checked in|still .* in)\b/.test(d);
  const physicallyEmpty =
    /\bbed\b.{0,20}not slept|not been slept|unslept|no luggage|nobody|no one .* been|door ajar|\bempty\b/.test(d);
  return systemOccupied && physicallyEmpty;
}
