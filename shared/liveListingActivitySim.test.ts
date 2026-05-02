import { describe, expect, it } from "vitest";
import { inverseDeclaredPriceForTargetMargin, simulateActivityPricing } from "./liveListingActivitySim";

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

describe("inverseDeclaredPriceForTargetMargin", () => {
  it("returns declared price that yields ~10% margin after 0.6 and +21", () => {
    const T = 38.1;
    const D = inverseDeclaredPriceForTargetMargin({
      totalCost: String(T),
      discountMultiplier: 0.6,
      subsidyAddon: 21,
      targetMarginPercent: 10,
    });
    expect(D).not.toBeNull();
    const sim = simulateActivityPricing({
      declaredPrice: String(D),
      totalCost: String(T),
      discountMultiplier: 0.6,
      subsidyAddon: 21,
    });
    expect(sim).not.toBeNull();
    expect(sim!.marginPercent).toBeGreaterThanOrEqual(9.99);
    expect(sim!.marginPercent).toBeLessThanOrEqual(10.01);
  });
});
