import type { Observation } from "../types";
import { extractNightlog } from "../../llm/extract";
import { verifyProseQuotes } from "./verify-prose-quotes";
import log from "../../logger";

// Read the messy prose with the model, then ground every claim against the file. The notice
// (if any) and the dropped count are passed up so the handover and its summary log can show
// what was incomplete instead of hiding it.
export async function normalizeNightlog(
  rawText: string,
  nightShiftMorning: string,
): Promise<{ observations: Observation[]; notice: string | null; droppedCount: number }> {
  const { observations: modelObs, notice } = await extractNightlog(rawText);
  const { observations, dropped } = verifyProseQuotes(rawText, modelObs, nightShiftMorning);
  for (const d of dropped) log({ level: "warn", event: "dropped_unsourced", ref: d.ref, reason: d.reason });
  log({ event: "nightlog_normalized", kept: observations.length, dropped: dropped.length });
  return { observations, notice, droppedCount: dropped.length };
}
