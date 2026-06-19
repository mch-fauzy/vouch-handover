import type { Observation } from "../types";

// Group by issue key. State is assigned later, per target morning.
export function groupThreads(observations: Observation[]): Map<string, Observation[]> {
  const byKey = new Map<string, Observation[]>();
  for (const o of observations) {
    const list = byKey.get(o.issue);
    if (list) list.push(o);
    else byKey.set(o.issue, [o]);
  }
  for (const list of byKey.values()) list.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  return byKey;
}
