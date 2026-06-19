import { existsSync } from "node:fs";
import { join } from "node:path";

// Load a local .env for development if present. Node does not read .env on its own, and the
// SDK reads ANTHROPIC_API_KEY from process.env. On Vercel the env is injected, so this is a
// no-op there. Missing file is fine - we degrade gracefully without a key.
try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the ambient environment.
}

// Resolve the data directory so the same code works locally and inside a bundled
// Vercel function. Prefer an explicit env, then cwd/data (where Vercel includeFiles
// lands), then a path relative to this module for plain local runs.
function resolveDataDir(): string {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  const cwdData = join(process.cwd(), "data");
  if (existsSync(cwdData)) return cwdData;
  return new URL("../data", import.meta.url).pathname;
}

// Single source of runtime config. Env overrides, with safe defaults for the sample hotel.
const config = {
  hotelId: process.env.HOTEL_ID ?? "lumen-sg",
  // Records in the feed already carry this offset. If a future feed differs, normalize first.
  timezoneOffset: "+08:00",
  dataDir: resolveDataDir(),
  model: "claude-haiku-4-5",
  // Model price per million tokens (USD), used only to enforce the spend cap. Defaults match
  // claude-haiku-4-5 (1 in, 5 out). Override via env if the model or its pricing changes.
  modelPriceInPerMTok: Number(process.env.MODEL_PRICE_IN_PER_MTOK ?? 1),
  modelPriceOutPerMTok: Number(process.env.MODEL_PRICE_OUT_PER_MTOK ?? 5),
  // Below this, a model-derived thread key is treated as low confidence and routed to needs-review.
  lowConfidenceThreshold: Number(process.env.LOW_CONFIDENCE_THRESHOLD ?? 0.7),
  // An open thread with no update within this many shifts before the target morning is stale.
  staleShifts: Number(process.env.STALE_SHIFTS ?? 2),
  // Hard cap on model spend per process. Above this the night log is skipped and logged.
  spendCapUsd: Number(process.env.SPEND_CAP_USD ?? 1),
};

export default config;
