import type { Observation, Flag, ModelObservation } from "../types";
import config from "../../config";
import { hasEmbeddedInstruction } from "./rules/injection";
import { hasUnapprovedAction, hasDiscrepancy } from "./rules/flags";
import { TOPICS, composeKey } from "./rules/thread-key";
import { formatNightLogRef } from "../refs";

// Prose has no per-record time. We anchor it to a noon sentinel so it sorts after the
// structured events of the same shift morning, which all land in the 23:00-07:00 window.
const PROSE_SENTINEL_TIME = "12:00:00";

// Fold case and whitespace before the substring check: the quote is a locator to confirm the
// model pointed at the right lines, not the text we render. The verbatim we keep is always the
// file's own bytes, so a case or spacing difference in the model quote cannot change output.
function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

// Accept either ISO codes or names the model may return ('en', 'English').
function isEnglish(language: string): boolean {
  return /^(en|eng|english)$/i.test(language.trim());
}

// The prose is the only non-deterministic source: a model read free text and proposed line
// ranges + a quote + fields. Code rebuilds the verbatim text from the file and verifies the
// quote actually appears in those lines. A model can never tell us what the source said - it
// can only point at lines we re-read ourselves.
export function verifyProseQuotes(
  rawText: string,
  modelObs: ModelObservation[],
  nightShiftMorning: string,
): { observations: Observation[]; dropped: { ref: string; reason: string }[] } {
  const lines = rawText.split("\n");
  const observations: Observation[] = [];
  const dropped: { ref: string; reason: string }[] = [];

  for (let i = 0; i < modelObs.length; i++) {
    const m = modelObs[i];
    const ref = formatNightLogRef(m.lineStart, m.lineEnd);

    if (m.lineStart < 1 || m.lineEnd > lines.length || m.lineStart > m.lineEnd) {
      dropped.push({ ref, reason: "line range out of bounds" });
      continue;
    }
    const cited = lines.slice(m.lineStart - 1, m.lineEnd).join(" ");
    if (!normalize(cited).includes(normalize(m.quote))) {
      dropped.push({ ref, reason: "unverifiable citation: quote not in cited lines" });
      continue;
    }

    // The topic must come from the shared vocabulary. An off-list topic means the model drifted
    // from the prompt, so we drop it rather than create a phantom thread that joins nothing.
    if (!TOPICS.includes(m.topic)) {
      dropped.push({ ref, reason: `unknown topic: ${m.topic}` });
      continue;
    }

    // Code composes the key from the model topic and room, so events and prose join on the same
    // key and there is no room number baked into the vocabulary.
    const issue = composeKey(m.topic, m.room);

    // Flags are derived from the file-grounded text plus the model confidence. The translation
    // is included for non-English so detectors and urgency can read English keywords too.
    const english = isEnglish(m.language);
    const scanText = `${cited} ${m.translation ?? ""}`;
    const flags: Flag[] = [];
    if (!english) flags.push("non_english");
    if (m.confidence < config.lowConfidenceThreshold) flags.push("low_confidence");
    if (hasEmbeddedInstruction(scanText)) flags.push("embedded_instruction");
    if (hasUnapprovedAction(scanText)) flags.push("unapproved");
    if (hasDiscrepancy(scanText)) flags.push("discrepancy");

    observations.push({
      id: `nl_${m.lineStart}_${i}`,
      source: {
        feed: "night-log",
        ref,
        verbatim: cited,
        translation: english ? undefined : m.translation,
      },
      occurredAt: `${nightShiftMorning}T${PROSE_SENTINEL_TIME}${config.timezoneOffset}`,
      shiftMorning: nightShiftMorning,
      room: m.room,
      guest: m.guest,
      issue,
      signal: m.signal,
      language: english ? "en" : m.language,
      confidence: m.confidence,
      flags,
    });
  }

  return { observations, dropped };
}
