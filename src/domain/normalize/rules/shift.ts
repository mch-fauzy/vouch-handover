import type { Observation } from "../../types";

// A shift runs ~23:00-07:00 and crosses two dates. Records at hour >= 12 (the 23:00 side)
// belong to the next morning. The feed carries the hotel offset, so we read wall-clock
// directly from the ISO prefix and avoid timezone libraries.
export function shiftMorning(iso: string): string {
  const date = iso.slice(0, 10);
  const hour = Number(iso.slice(11, 13));
  if (hour < 12) return date;
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

// The latest shift morning present in a set of records. Used to default the target morning.
export function latestMorning(observations: Observation[]): string {
  return observations.reduce((m, o) => (o.shiftMorning > m ? o.shiftMorning : m), observations[0]?.shiftMorning ?? "");
}
