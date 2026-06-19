import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { RawEvent } from "../types";
import config from "../../config";
import log from "../../logger";

// Validate the events feed at the boundary. Events are mandatory input, so a bad shape is a
// hard error we surface, not something we silently paper over.
const RawEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  type: z.string(),
  room: z.string().nullable(),
  guest: z.string().nullable(),
  description: z.string(),
  status: z.string(),
});
const EventsFileSchema = z.object({ events: z.array(RawEventSchema) });

// File adapter today. The shape (events array + night-log text) is what a queue or API
// would also provide, so swapping the source means swapping only this function.
export async function readSources(): Promise<{ events: RawEvent[]; nightRaw: string }> {
  // The two reads are independent: run them concurrently.
  const [eventsJson, nightRaw] = await Promise.all([
    readFile(join(config.dataDir, "events.json"), "utf8"),
    readFile(join(config.dataDir, "night-logs.md"), "utf8"),
  ]);
  const parsed = EventsFileSchema.safeParse(JSON.parse(eventsJson));
  if (!parsed.success) {
    log({ level: "error", event: "events_invalid", reason: parsed.error.message });
    throw new Error("events.json failed schema validation");
  }
  return { events: parsed.data.events, nightRaw };
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

// The night-log heading states its night ('morning Thu 28 May') but carries no year. Derive
// day and month, then pick the year that places the date closest to the fallback morning, so a
// December-to-January boundary rolls correctly instead of borrowing the fallback year blindly.
export function nightShiftMorningFrom(nightRaw: string, fallback: string): string {
  const m = nightRaw.match(/morning\s+\w+\s+(\d{1,2})\s+(\w+)/i);
  if (!m) return fallback;
  const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
  if (!mon) return fallback;
  const day = m[1].padStart(2, "0");
  const fbYear = Number(fallback.slice(0, 4));
  const fbTime = Date.parse(`${fallback}T00:00:00Z`);

  let best = fallback;
  let bestDiff = Infinity;
  for (const y of [fbYear - 1, fbYear, fbYear + 1]) {
    const candidate = `${y}-${mon}-${day}`;
    const diff = Math.abs(Date.parse(`${candidate}T00:00:00Z`) - fbTime);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = candidate;
    }
  }
  return best;
}
