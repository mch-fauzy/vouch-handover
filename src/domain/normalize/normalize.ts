import type { Observation, RawEvent } from "../types";
import { nightShiftMorningFrom } from "../sources/sources";
import { normalizeEvents } from "./events";
import { normalizeNightlog } from "./nightlog";
import { latestMorning } from "./rules/shift";

// Stage 2 door: turn both inputs into one Observation list. Runs the events path and the prose
// path, anchoring the prose to the night its heading names. Helpers live under ./rules.
export async function normalize(
  events: RawEvent[],
  nightRaw: string,
): Promise<{ observations: Observation[]; notice: string | null; droppedCount: number }> {
  const eventObs = normalizeEvents(events);

  // Default the night to the latest event morning, then let the file heading override it.
  const nightMorning = nightShiftMorningFrom(nightRaw, latestMorning(eventObs));
  const { observations: nightObs, notice, droppedCount } = await normalizeNightlog(nightRaw, nightMorning);

  return { observations: [...eventObs, ...nightObs], notice, droppedCount };
}
