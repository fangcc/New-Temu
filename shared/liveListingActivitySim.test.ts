import { describe, expect, it } from "vitest";
import { inverseActivityDeclaredForTargetMargin, simulateActivityPricing } from "./liveListingActivitySim";

describe("simulateActivityPricing", () => {
  it("6折 +21 matches described pipeline on first spreadsheet row", () => {
    const r = simulateActivityPricing({
      declaredPrice: "24",
      totalCost: "38.1",
      discountMultiplier: 0.6,
      subsidyAddon: 21,
    });
    expect(r).not.toBeNull();
    expect(r!.newDeclaredPrice).toBe(14.4);
    expect(r!.newSubsidyPrice).toBe(35.4);
    expect(r!.grossProfit).toBe(-2.7);
    expect(r!.marginPercent).toBe(-7.63);
  });
});

describe("inverseActivityDeclaredForTargetMargin", () => {
  it("returns activity-tier declared (~31.71) for cost 47.44, +21, 10% target (matches 活动申报口径)", () => {
    const d1 = inverseActivityDeclaredForTargetMargin({
      totalCost: "47.44",
      subsidyAddon: 21,
      targetMarginPercent: 10,
    });
    expect(d1).not.toBeNull();
    expect(d1).toBeCloseTo(31.71, 2);
    const S = (d1 ?? 0) + 21;
    const marginPct = ((S - 47.44) / S) * 100;
    expect(marginPct).toBeCloseTo(10, 1);
  });

  it("forward sim with D = d1/r yields ~target margin when discount applies", () => {
    const T = 38.1;
    const d1 = inverseActivityDeclaredForTargetMargin({
      totalCost: String(T),
      subsidyAddon: 21,
      targetMarginPercent: 10,
    });
    expect(d1).not.toBeNull();
    const r = 0.6;
    const D = (d1 ?? 0) / r;
    const sim = simulateActivityPricing({
      declaredPrice: String(D),
      totalCost: String(T),
      discountMultiplier: r,
      subsidyAddon: 21,
    });
    expect(sim).not.toBeNull();
    expect(sim!.marginPercent).toBeGreaterThanOrEqual(9.99);
    expect(sim!.marginPercent).toBeLessThanOrEqual(10.01);
  });
});
