import type { Handover, HandoverItem, Section } from "../types";

const TITLES: Record<Section, string> = {
  onFire: "ON FIRE", pending: "PENDING", fyi: "FYI", needsReview: "NEEDS REVIEW",
};
const ORDER: Section[] = ["onFire", "pending", "fyi", "needsReview"];

function line(it: HandoverItem): string {
  // For contradictions the detail already carries one [ref] per side, so the trailing refs
  // would be a duplicate. Plain items append their refs once.
  if (it.sides) return `${it.title}\n${it.detail}`;
  return `${it.title} - ${it.detail}  [${it.refs.join("; ")}]`;
}

export function renderText(h: Handover): string {
  const head = `Handover - ${h.hotelId} - morning ${h.morning}\n`;
  const banner = h.notices.length ? h.notices.map((n) => `! ${n}`).join("\n") + "\n" : "";
  const sections = ORDER.map((s) => {
    const items = h[s];
    const rows = items.length ? items.map((it) => `  ${line(it)}`).join("\n") : "  (none)";
    return `\n## ${TITLES[s]}\n${rows}`;
  }).join("\n");
  return head + banner + sections + "\n";
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Contradictions render each side as its own bullet with its own ref. Plain items show the
// detail once with their refs appended.
function htmlItem(it: HandoverItem): string {
  if (it.sides) {
    const sides = it.sides.map((s) => `<li>${esc(s.text)} <code>[${esc(s.ref)}]</code></li>`).join("");
    return `<li><strong>${esc(it.title)}</strong><ul>${sides}</ul></li>`;
  }
  return `<li><strong>${esc(it.title)}</strong> - ${esc(it.detail)} <code>[${esc(it.refs.join("; "))}]</code></li>`;
}

export function renderHtml(h: Handover): string {
  const banner = h.notices.length
    ? `<p style="background:#fde68a;padding:0.5rem 1rem;border-radius:0.25rem">` +
      h.notices.map((n) => esc(n)).join("<br>") + `</p>`
    : "";
  const sections = ORDER.map((s) => {
    const items = h[s];
    const rows = items.length ? items.map(htmlItem).join("") : "<li>(none)</li>";
    return `<h2>${TITLES[s]}</h2><ul>${rows}</ul>`;
  }).join("");
  return `<!doctype html><meta charset="utf-8"><title>Handover ${esc(h.morning)}</title>` +
    `<body style="font-family:system-ui;max-width:50rem;margin:2rem auto;white-space:pre-wrap">` +
    `<h1>${esc(h.hotelId)} - morning ${esc(h.morning)}</h1>${banner}${sections}</body>`;
}
