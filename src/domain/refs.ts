// Single owner of the night-log ref format, shared by the minting side (verify-prose-quotes)
// and the parsing side (verify-refs) so a format change lands in one place.
export function formatNightLogRef(start: number, end: number): string {
  return `night-logs.md L${start}${end > start ? `-${end}` : ""}`;
}

export function parseNightLogRef(ref: string): { start: number; end: number } | null {
  const m = ref.match(/^night-logs\.md L(\d+)(?:-(\d+))?$/);
  if (!m) return null;
  const start = Number(m[1]);
  return { start, end: m[2] ? Number(m[2]) : start };
}
