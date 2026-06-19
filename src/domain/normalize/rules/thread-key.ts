// Topic vocabulary, room-agnostic so it generalizes to any hotel. The model picks a topic
// from this list and reports the room separately. Code composes the final key, so events and
// prose join on the same key without baking sample room numbers into the vocabulary.
export const TOPICS = [
  "aircon", "deposit", "booking", "noshow", "occupancy", "safe", "medical",
  "checkout", "damage", "guest-note", "compliance", "leak", "wifi", "breakfast", "checkin",
];

// Topics whose scope is an area, not a room. The key uses a fixed sub-scope so records join
// across rooms (one corridor leak thread, one passport-scan backlog, and so on).
const GLOBAL_SCOPE: Record<string, string> = {
  compliance: "passport-scan",
  leak: "corridor",
  wifi: "unknown",
  breakfast: "general",
};

// Build a thread key from a topic and a room. Global topics ignore the room.
export function composeKey(topic: string, room: string | null): string {
  const scope = GLOBAL_SCOPE[topic] ?? room ?? "general";
  return `${topic}:${scope}`;
}

// Map a structured event to a topic. Keyword checks come first for cross-room topics, then
// event type, then a generic topic from the type for pure FYI records.
function topicForEvent(type: string, description: string): string {
  const d = description.toLowerCase();
  if (/immigration|scanner|scanned|passport[^a-z]*scan/.test(d)) return "compliance";
  if (/leak|corridor/.test(d)) return "leak";
  if (/wifi/.test(d)) return "wifi";
  if (/breakfast/.test(d)) return "breakfast";
  if (type === "no_show" || /no[-\s]?show/.test(d)) return "noshow";
  if (type === "deposit_issue") return "deposit";
  if (type === "maintenance" || /aircon/.test(d)) return "aircon";
  if (type === "damage_report") return "damage";
  if (type === "incident") return "medical";
  if (type === "check_in_issue") return "booking";
  if (type === "check_in") return "checkin";
  if (type === "early_checkout_request") return "checkout";
  if (type === "guest_message") return "guest-note";
  // A note that is about a deposit but carries no dedicated type.
  if (/deposit/.test(d)) return "deposit";
  return type.replace(/_/g, "-");
}

export function deriveEventKey(type: string, room: string | null, description: string): string {
  return composeKey(topicForEvent(type, description), room);
}
