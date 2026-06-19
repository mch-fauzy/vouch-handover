# Night-Shift Hotel Handover

Turns one hotel's week of front-desk activity - structured events (`data/events.json`) plus one
free-text relief-staff night (`data/night-logs.md`, mixed English + Mandarin) - into an
action-first morning handover for a given shift: **On fire / Pending / FYI / Needs review**, with
every line traced back to its source.

The thing being optimized is **trust**: the model reads the messy multilingual prose to extract and
translate it, deterministic code makes every decision, and every rendered line resolves to a real
event id or night-log line. See [DECISIONS.md](./DECISIONS.md) for the reasoning.

## Run locally

Requires Node 22+ (the config loader uses `process.loadEnvFile`).

```bash
npm install
cp .env.example .env     # add ANTHROPIC_API_KEY (optional - see below)
npm run dev              # tsx watch -> http://localhost:3000
npm test                # vitest: 68 tests
```

Without `ANTHROPIC_API_KEY` the service still runs: it returns the structured-events handover and a
`notices[]` banner stating the night log was not ingested. The same graceful path covers a reached
spend cap or a model error.

## Endpoints

| Method | Path | Returns |
|---|---|---|
| GET | `/handover` | JSON or HTML, chosen by the `Accept` header |
| GET | `/handover.json` | the `Handover` object |
| GET | `/handover.txt` | plain text |
| GET | `/handover.html` | minimal server-rendered HTML, no client JS |
| GET | `/health` | `{ "status": "ok" }` |

Query: `?morning=YYYY-MM-DD` (optional, defaults to the latest morning in the data). A present but
invalid date returns `400`.

## Sample curl

Local:

```bash
# passport deadline + 309 deposit on fire; 312 three-way contradiction + 214 injection in needs-review
curl "http://localhost:3000/handover.txt?morning=2026-05-30"

# the free-text night: 208 safe (translated from Mandarin) on fire, 205 discrepancy in needs-review
curl "http://localhost:3000/handover.json?morning=2026-05-28"
```

Deployed:

```bash
curl "https://vouch-handover-black.vercel.app/handover.txt?morning=2026-05-30"   # passport deadline, 309 deposit, 312 contradiction
curl "https://vouch-handover-black.vercel.app/handover.json?morning=2026-05-28"  # multilingual night: 208 safe, 205 discrepancy
```

## Configuration

Every env var is optional except the API key. See `.env.example` and `src/config.ts`:
`SPEND_CAP_USD` (default 1), `MODEL_PRICE_IN_PER_MTOK` / `MODEL_PRICE_OUT_PER_MTOK` (1 / 5),
`LOW_CONFIDENCE_THRESHOLD` (0.7), `STALE_SHIFTS` (2), `HOTEL_ID`, `PORT`, `DATA_DIR`.

## How it works

Pipeline: `sources -> normalize -> reconcile -> verify-refs -> compose -> serve`.

- The model (`claude-haiku-4-5`, temperature 0, structured output validated by Zod) only extracts
  fields and translates the prose. Classification, urgency, and wording all happen in code.
- Code does everything else, including the two trust checks: the model's quote must be a real
  substring of the cited night-log lines, and every emitted ref must resolve to a real event id or
  in-bounds line, else the item is dropped and logged.
- Structured JSON logging keyed by hotel, morning, and reason lets a future builder debug a bad
  handover in production.
