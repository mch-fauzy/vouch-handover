import express, { type Request, type Response } from "express";
import { buildHandover } from "./domain/pipeline";
import { renderText, renderHtml } from "./domain/compose/render";
import log from "./logger";

const app = express();

// Accept a morning only as a real YYYY-MM-DD date. Shape alone is not enough: an impossible
// date like 2026-13-45 must be rejected, not silently used.
function isValidMorning(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Absent morning means "this morning": the pipeline defaults to the latest. A present but
// invalid morning is a client error, so reject it rather than silently falling back.
function parseMorning(req: Request): { ok: true; morning?: string } | { ok: false } {
  const m = req.query.morning;
  if (m === undefined) return { ok: true, morning: undefined };
  if (typeof m === "string" && isValidMorning(m)) return { ok: true, morning: m };
  return { ok: false };
}

async function handle(req: Request, res: Response, format: "json" | "txt" | "html") {
  const parsed = parseMorning(req);
  if (!parsed.ok) return res.status(400).json({ error: "invalid morning, expected YYYY-MM-DD" });
  try {
    const handover = await buildHandover(parsed.morning);
    if (format === "json") return res.json(handover);
    if (format === "txt") return res.type("text/plain").send(renderText(handover));
    return res.type("html").send(renderHtml(handover));
  } catch (err) {
    log({ level: "error", event: "request_failed", reason: String(err) });
    return res.status(500).json({ error: "handover generation failed" });
  }
}

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/handover.json", (req, res) => handle(req, res, "json"));
app.get("/handover.txt", (req, res) => handle(req, res, "txt"));
app.get("/handover.html", (req, res) => handle(req, res, "html"));
app.get("/handover", (req, res) => {
  const wantsHtml = req.accepts(["json", "html"]) === "html";
  return handle(req, res, wantsHtml ? "html" : "json");
});

export default app;
