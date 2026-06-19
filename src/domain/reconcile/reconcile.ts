import type { Observation, Thread, ThreadState, Flag } from "../types";
import { groupThreads } from "./thread";
import config from "../../config";

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

// Opposing factual claims on one thread: a resolution followed later by a non-resolution.
function conflicting(obs: Observation[]): boolean {
  const resolvedAt = obs.findIndex((o) => o.signal === "resolved");
  if (resolvedAt < 0) return false;
  return obs.slice(resolvedAt + 1).some((o) => o.signal === "opened" || o.signal === "update" || o.signal === "disputed");
}

function classify(obs: Observation[], target: string): { state: ThreadState; flags: Flag[] } {
  // Union model + record flags onto the thread. A set dedups in one pass.
  const flags = new Set<Flag>();
  for (const o of obs) for (const f of o.flags) flags.add(f);

  // A contradiction needs at least two sources that disagree: an explicit dispute, or one
  // source resolving and another re-opening the same thread. A lone record is never one.
  const multi = obs.length > 1;
  const hasDispute = obs.some((o) => o.signal === "disputed");
  const hasResolved = obs.some((o) => o.signal === "resolved");
  // conflicting() already requires a resolution followed by a non-resolution, so it implies
  // both a resolved and a non-resolved record. No separate hasNonResolved guard is needed.
  if (multi && (hasDispute || (hasResolved && conflicting(obs)))) {
    flags.add("contradiction");
    return { state: "contradiction", flags: [...flags] };
  }

  const last = obs[obs.length - 1];
  const firstMorning = obs[0].shiftMorning;
  let state: ThreadState;
  if (last.signal === "resolved") {
    state = last.shiftMorning === target ? "newly_resolved" : "resolved_earlier";
  } else if (firstMorning === target) {
    state = "new_tonight";
  } else {
    state = "still_open";
  }

  // Stale: an actionable open issue gone quiet. Pure information notes are never stale, since
  // there is nothing to resolve.
  const actionable = obs.some((o) => o.signal === "opened" || o.signal === "update" || o.signal === "disputed");
  if (state === "still_open" && actionable && dayDiff(last.shiftMorning, target) >= config.staleShifts) {
    flags.add("stale");
  }
  return { state, flags: [...flags] };
}

export function reconcile(observations: Observation[], targetMorning: string): Thread[] {
  const visible = observations.filter((o) => o.shiftMorning <= targetMorning);
  const grouped = groupThreads(visible);
  const threads: Thread[] = [];
  for (const [issue, obs] of grouped) {
    const { state, flags } = classify(obs, targetMorning);
    threads.push({ issue, observations: obs, state, flags });
  }
  return threads;
}
