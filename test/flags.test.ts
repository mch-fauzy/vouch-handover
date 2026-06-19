import { describe, it, expect } from "vitest";
import { hasUnapprovedAction, hasDiscrepancy } from "../src/domain/normalize/rules/flags";

describe("hasUnapprovedAction", () => {
  it("flags a proposed charge that admits no photos and no approval", () => {
    const text =
      "Night staff proposes charging the SGD 500 damage fee to the card on file. " +
      "No photos were taken and there is no manager approval on record yet.";
    expect(hasUnapprovedAction(text)).toBe(true);
  });
  it("does not flag an ordinary settled charge", () => {
    expect(hasUnapprovedAction("Deposit SGD 100 taken on card, approved by manager.")).toBe(false);
  });
  it("does not flag a charge with no missing-evidence language", () => {
    expect(hasUnapprovedAction("Charged the no-show fee per booking terms.")).toBe(false);
  });
});

describe("hasDiscrepancy", () => {
  it("flags a system-says-occupied vs physically-empty conflict", () => {
    const text =
      "The system still shows Mr Chen in 205 as in-house, but the bed was clearly not slept in " +
      "and there was no luggage anywhere in the room.";
    expect(hasDiscrepancy(text)).toBe(true);
  });
  it("does not flag a plain occupancy note", () => {
    expect(hasDiscrepancy("System shows the room in-house until checkout Saturday morning.")).toBe(false);
  });
});
