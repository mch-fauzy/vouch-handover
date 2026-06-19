import type { Observation, Signal, Flag, RawEvent } from "../types";
import { shiftMorning } from "./rules/shift";
import { deriveEventKey } from "./rules/thread-key";
import { hasEmbeddedInstruction } from "./rules/injection";
import { hasUnapprovedAction, hasDiscrepancy } from "./rules/flags";

// One snapshot signal per event. Thread state is derived later across the whole thread,
// never from a single event status. A dispute in the text is a signal in its own right, so
// the contradiction survives even when the night log is unavailable.
function signalFor(status: string, description: string): Signal {
  if (/\bdisput/i.test(description)) return "disputed";
  if (status === "resolved") return "resolved";
  if (status === "pending") return "update";
  return "opened";
}

// Trust flags carried per record, surfaced to needs-review by later code.
function flagsFor(description: string): Flag[] {
  const flags: Flag[] = [];
  if (hasEmbeddedInstruction(description)) flags.push("embedded_instruction");
  if (hasUnapprovedAction(description)) flags.push("unapproved");
  if (hasDiscrepancy(description)) flags.push("discrepancy");
  return flags;
}

export function normalizeEvents(events: RawEvent[]): Observation[] {
  return events
    .map((e): Observation => ({
      id: e.id,
      source: { feed: "events", ref: e.id, verbatim: e.description },
      occurredAt: e.timestamp,
      shiftMorning: shiftMorning(e.timestamp),
      room: e.room,
      guest: e.guest,
      issue: deriveEventKey(e.type, e.room, e.description),
      signal: signalFor(e.status, e.description),
      language: "en",
      confidence: 1,
      flags: flagsFor(e.description),
    }))
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}
