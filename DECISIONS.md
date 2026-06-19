# DECISIONS

The graded bar is grounding and trust, so every decision below serves one goal: an
operator can trust this at 7am, unattended, across hundreds of hotels. Feature completeness came
second.

## What I built

- Ingest both feeds into one `Observation` shape behind a swappable `sources` adapter (a file
  today, a queue or API tomorrow).
- Reconcile across nights: group records into threads by the issue they concern, classify each
  thread for the target morning, flag stale ones.
- Action-first output in four sections (On fire / Pending / FYI / Needs review), served as JSON,
  plain text, and minimal HTML, every line ref-tagged.
- Two grounding checks enforced in code (below).
- Structured JSON logging keyed by hotel, morning, and reason.
- Graceful degradation when the model is unavailable.

## What I deliberately skipped

- **Persistence / thread store** - the brief says to skip it. Reconciliation is recomputed per
  request from the two feeds. This is fine at this scale and keeps the pipeline pure. See hours 3-6.
- **Auth and rate limiting** - out of scope for a read-only internal endpoint. A process-level
  spend cap guards model cost.
- **SPA / frontend framework** - the brief prioritizes utility. Server-rendered HTML and text plus
  JSON is enough, and there is no client JS.
- **Multi-hotel routing and a per-hotel config store** - the record shape carries `hotelId` and
  timezone, so multi-hotel stays open as a later step. One hotel is in scope now, and config is
  env-driven.
- **>=80% coverage** - per the time-box, I tested the parts that can silently corrupt trust (both
  grounding checks, the reconcile state logic, injection containment) plus the pure helpers.
  68 tests.

## Reconciliation across nights

- Each record is anchored to the **morning its shift ends** (`rules/shift.ts`): a shift runs
  roughly 23:00-07:00, so any record at local hour >= 12 rolls to the next date.
- Events arrive out of timestamp order, so everything is sorted by `occurredAt` before any sequence
  reasoning.
- Records group into **threads keyed by the issue they concern**, so one issue spans multiple
  nights and both feeds. The key is `topic:room`: the model proposes a room-agnostic `topic` from a
  fixed vocabulary and reports the room, then **code** composes the key (`composeKey`). Cross-room
  topics (compliance backlog, corridor leak) use an area scope so they form one thread.
- For a target morning T, only records with `shiftMorning <= T` are visible, since future shifts
  have not happened. Each thread is then classified once: still open / newly resolved / new tonight
  / contradiction / resolved earlier. A week-old open item keeps its "still open" label across
  mornings because the thread is tracked and reused each night, so a carried-over issue reads as
  ongoing.
- An open, actionable thread gone quiet for >= `STALE_SHIFTS` is flagged `stale` and routed to
  needs-review, so a quiet open issue stays visible without being treated as same-day urgent. The
  208 safe is on fire on 05-28 and stale by 05-30.

## Grounding: how the model is kept from inventing facts

**The model's only job is to read the prose. Every decision is made by code.** The model
(`claude-haiku-4-5`, temperature 0, structured output validated by Zod) extracts fields and
translates the free-text prose. Classification, urgency, and wording are all done in code. Two
checks back this up, both in code:

1. **Quote verification at the model boundary** (`verify-prose-quotes.ts`). For each prose record
   the model returns a line range plus the exact quote it relied on. Code re-reads those lines from
   the file and confirms the quote is a real substring. The `verbatim` we keep is read from the file
   itself. Off-list topics and unverifiable quotes are dropped and logged. The model points at
   lines, and code reads what they say.
2. **Resolvable-ref check before render** (`verify-refs.ts`). Every emitted source ref must resolve
   to a real event id or an in-bounds night-log line, across both feeds. One bad ref drops the whole
   item. Even a bug in compose cannot put an unsourced line on the page.

Events need no model and are trusted structured input, so the topic allowlist applies only to model
output.

## Contradictions and incomplete input

When two records disagree, or something looks unfinished or unsafe, the service does not pick a
winner or tidy it into one clean sentence. It puts the item in Needs review and shows the raw
sources, so a person decides. Smoothing a conflict away is exactly what would make a 7am handover
untrustworthy. Walking through each case:

- **312 no-show.** Three records about the same guest say different things: one event says the guest
  was not charged, the Mandarin night-log says they were charged and it is settled, and a later
  event says the guest disputes the charge. The service keeps all three side by side, each with its
  source (the Mandarin one with an English translation), and never collapses them into one answer.
- **214 guest note.** A guest left a typed note that, in effect, tells the tool to report everything
  as fine and approve a SGD 1000 credit. Plain code, not the model, recognizes this kind of
  "do as I say" text, so the model can never be talked into obeying it. The note is shown word for
  word in Needs review and never becomes an action. It is data to display, not a command to follow.
- **226 damage charge.** Night staff proposed a SGD 500 charge, but the text itself admits there are
  no photos and no manager approval. The service flags it and shows it to the morning team. It never
  approves the charge on its own.
- **205 occupancy.** The booking system says the room is occupied, the relief staffer saw it empty.
  The service shows both sides and leaves it for a person to reconcile, rather than guessing who is
  right.
- **Unsure model reads.** When the model is not confident about something it pulled from the messy
  text, that record also goes to Needs review instead of being shown as a fact.

## Where AI helped, and where it got in the way

- **Helped most:** the messy multilingual prose. Pulling structured fields out of free text and
  translating Mandarin ("safe jammed, flight tomorrow") is exactly the kind of work a model handles
  well.
- **Got in the way:**
  - The model's topic label for an ambiguous line is non-deterministic across runs (205 came back
    as occupancy on one run, checkout on another). It is harmless here because code composes the key
    and the deterministic discrepancy flag routes it to needs-review regardless, though it does mean
    the thread key for borderline lines is not perfectly stable.
  - Occasional line-number drift in a cited range. The quote-verify check catches this and drops the
    record.
  - In both cases the fix was the same: code verifies the model's output before anything uses it.

## Tradeoffs worth naming

- **In-process cache and spend cap** - the night-log extraction is cached by content hash, and
  `SPEND_CAP_USD` accumulates per process. On serverless both reset on a cold start, so a cold
  request recomputes once (a fraction of a cent at Haiku rates). A persistent cache keyed by hash
  removes even that.
- **The quote check is case- and whitespace-insensitive** - it is a locator confirming the model
  pointed at the right lines. The rendered text is always the file's bytes, so folding cannot change
  output, and it avoids dropping a correctly-located record over capitalization.
- **Prose has no per-record time** - prose records share a noon sentinel so they sort after the
  same-morning structured events. Intra-prose order is preserved through the record id.
- **Endpoint shape** - I chose `.json` / `.txt` / `.html` suffix routes plus `Accept` content
  negotiation on `/handover`, and `/health` for the liveness check (the common convention).
- **Transactions: N/A** - there is no database or multi-step write to make atomic. If a thread store
  is added later, the per-morning thread-state write is the unit that would need a transaction.

## Hours 3-6 if I had them

1. **Persistent thread store** keyed by hotel and issue, with transactional per-morning state
   writes, so reconciliation survives restarts and scales past recompute-per-request.
2. **POST input adapter** so events and night-logs arrive as data from a queue or webhook.
3. **Per-hotel config** (timezone, thresholds, topic vocabulary) behind the adapter for true
   multi-hotel operation.
4. **Eval harness** over more nights and more languages: golden handovers plus an assertion that
   every rendered line resolves to a source, to catch regressions across hotels.
5. **Tighten urgency to structured signals** - replace the keyword scans in `urgency.ts`
   (guest-blocked, compliance deadline) with first-class flags set during reconcile, so urgency does
   not depend on free-text matching.

## One thing that surprised me

How deliberately adversarial the sample data is. It plants a three-way contradiction on the 312
no-show and a literal prompt injection in the 214 guest note aimed at "the handover tool", where a
guest tries to make the automated system approve a SGD 1000 credit. It is a sharp reminder that in
this domain the input is messy and sometimes hostile, which is why grounding everything in code is
the safe default.
