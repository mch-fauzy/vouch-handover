import type { Handover } from "./types";
import config from "../config";
import log from "../logger";
import { readSources } from "./sources/sources";
import { normalize } from "./normalize/normalize";
import { reconcile } from "./reconcile/reconcile";
import { compose } from "./compose/compose";
import { isOpen } from "./compose/urgency";
import { latestMorning } from "./normalize/rules/shift";

// The spine: sources -> normalize -> reconcile -> compose, in order.
export async function buildHandover(morning?: string): Promise<Handover> {
  const { events, nightRaw } = await readSources();
  const { observations, notice, droppedCount } = await normalize(events, nightRaw);

  // Default to the latest morning present, or use the requested one.
  const target = morning ?? latestMorning(observations);

  const threads = reconcile(observations, target);
  const knownEventIds = new Set(events.map((e) => e.id));
  const nightLineCount = nightRaw.split("\n").length;
  const notices = notice ? [notice] : [];
  const { handover, droppedItems } = compose(threads, { hotelId: config.hotelId, morning: target, knownEventIds, nightLineCount, notices });

  // One summary line so a future builder can answer which hotel, which morning, and why.
  const openCount = threads.filter(isOpen).length;
  const perFlag = threads.flatMap((t) =>
    t.flags.map((flag) => ({ flag, issue: t.issue, ref: t.observations[0]?.source.ref ?? null })),
  );
  log({
    event: "handover_built", hotelId: config.hotelId, morning: target,
    normalized: observations.length, droppedUnsourced: droppedCount, droppedItems, threads: threads.length,
    threadsOpen: openCount,
    threadsResolved: threads.length - openCount,
    flaggedItems: threads.filter((t) => t.flags.length > 0).length,
    onFire: handover.onFire.length, pending: handover.pending.length,
    fyi: handover.fyi.length, needsReview: handover.needsReview.length,
    flags: perFlag,
  });
  return handover;
}
