export const SIGNALS = ["opened", "update", "resolved", "disputed", "info"] as const;
export type Signal = (typeof SIGNALS)[number];

export type Flag =
  | "embedded_instruction" | "contradiction" | "unapproved"
  | "low_confidence" | "non_english" | "discrepancy" | "stale";

export type ThreadState =
  | "still_open" | "newly_resolved" | "new_tonight" | "contradiction" | "resolved_earlier";

export type Section = "onFire" | "pending" | "fyi" | "needsReview";

// One raw event as it arrives in events.json, before normalization.
export interface RawEvent {
  id: string; timestamp: string; type: string;
  room: string | null; guest: string | null; description: string; status: string;
}

// One record the model proposes from the prose, before it is verified against the source. Mirrors the Zod schema
// in llm/extract.ts. The model picks a topic and reports the room: code composes the thread
// key, verifies the quote, and decides everything from here on.
export interface ModelObservation {
  lineStart: number; lineEnd: number; quote: string;
  room: string | null; guest: string | null; topic: string;
  signal: Signal; language: string; translation?: string; confidence: number;
}

// Used only within this file by Observation, so it stays internal.
interface SourceRef {
  feed: "events" | "night-log";
  ref: string;            // 'evt_0014' or 'night-logs.md L23-24'
  verbatim: string;       // rebuilt from the file, never from the model
  translation?: string;   // English, present when language is not 'en'
}

export interface Observation {
  id: string;
  source: SourceRef;
  occurredAt: string;     // ISO, parsed and trusted
  shiftMorning: string;   // ISO date (YYYY-MM-DD) of the morning the shift ends
  room: string | null;
  guest: string | null;
  issue: string;          // thread key, e.g. 'deposit:309'
  signal: Signal;
  language: string;       // detected, 'en' for events
  confidence: number;     // 1 for events, 0..1 for model-derived prose
  flags: Flag[];
}

export interface Thread {
  issue: string;
  observations: Observation[];   // sorted by occurredAt
  state: ThreadState;
  flags: Flag[];
}

export interface HandoverItem {
  title: string;
  detail: string;
  refs: string[];
  sides?: { text: string; ref: string }[];  // contradictions: one entry per source
}

export interface Handover {
  hotelId: string;
  morning: string;
  generatedAt: string;
  notices: string[];   // incomplete-input warnings, e.g. night log not ingested
  onFire: HandoverItem[];
  pending: HandoverItem[];
  fyi: HandoverItem[];
  needsReview: HandoverItem[];
}
