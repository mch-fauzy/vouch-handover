// Deterministic embedded-instruction detection, run on both feeds independent of the model.
// We never obey input. Anything matching is quarantined to needs-review by later code.
const patterns: RegExp[] = [
  /\b(handover\s+tool|system\s+note\s+to)\b/i,
  /\bignore\s+(all|other|previous)\b/i,
  /\breport\s+(the\s+night\s+)?(as\s+)?all[-\s]?clear\b/i,
  /\bmark\s+(it|this)?\s*approved\b/i,
  /\badd\s+a?\s*(sgd|usd|\$)?\s*\d+.*\bcredit\b/i,
];

export function hasEmbeddedInstruction(text: string): boolean {
  return patterns.some((p) => p.test(text));
}
