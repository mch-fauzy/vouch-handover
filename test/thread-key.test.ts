import { describe, it, expect } from "vitest";
import { deriveEventKey, TOPICS } from "../src/domain/normalize/rules/thread-key";

describe("deriveEventKey", () => {
  it("keys compliance/passport by topic, ignoring room", () => {
    expect(deriveEventKey("compliance", "204", "Passport not scanned")).toBe("compliance:passport-scan");
    expect(deriveEventKey("compliance", null, "3 passports could not be scanned")).toBe("compliance:passport-scan");
  });
  it("keys deposit and no-show by room", () => {
    expect(deriveEventKey("deposit_issue", "309", "Card declined for deposit")).toBe("deposit:309");
    expect(deriveEventKey("no_show", "312", "Did not arrive")).toBe("noshow:312");
  });
  it("keys a 312 finance note about the no-show charge onto the no-show thread", () => {
    expect(deriveEventKey("finance_note", "312", "Re: the no-show charge")).toBe("noshow:312");
  });
  it("keys aircon maintenance by room", () => {
    expect(deriveEventKey("maintenance", "112", "Aircon not cooling")).toBe("aircon:112");
  });
  it("keys a booking-name mismatch as booking, not compliance, despite the word passport", () => {
    expect(deriveEventKey("check_in_issue", "309", "Booking name 'J. Suthar' did not match passport")).toBe("booking:309");
  });
  it("keys a smooth check-in by type, not as a deposit, when it merely mentions a deposit", () => {
    expect(deriveEventKey("check_in", "204", "Late check-in, smooth. Deposit SGD 100 taken on card.")).toBe("checkin:204");
  });
  it("keys an early checkout request by room", () => {
    expect(deriveEventKey("early_checkout_request", "220", "Guest leaving 05:30, requested deposit refund")).toBe("checkout:220");
  });
  it("falls back to a per-event topic:room key for generic items", () => {
    expect(deriveEventKey("check_in", "204", "Late check-in")).toBe("checkin:204");
  });
  it("keys a corridor leak by area, ignoring the room, so events and prose join", () => {
    expect(deriveEventKey("facilities", null, "Water leak in 2nd floor corridor near room 215")).toBe("leak:corridor");
  });
  it("exposes a room-agnostic topic vocabulary for the model", () => {
    expect(TOPICS).toContain("safe");
    expect(TOPICS).not.toContain("safe:208");
    expect(TOPICS.length).toBeGreaterThan(5);
  });
});
