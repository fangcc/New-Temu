import { describe, expect, it } from "vitest";
import { computeLiveListingMetrics } from "./liveListingMath";

describe("computeLiveListingMetrics", () => {
  it("matches spreadsheet-style row (45 sale, 38.1 cost -> ~15.33% margin)", () => {
    const result = computeLiveListingMetrics({
      purchaseUnitPrice: "10",
      firstLegShippingFee: "3.1",
      lastLegShippingFee: "21",
      overseasWarehouseFee: "4",
      subsidySellingPrice: "45",
    });
    expect(result.totalCost).toBe("38.1");
    expect(result.grossProfit).toBe("6.9");
    expect(result.profitMarginPercent).toBe("15.33");
  });

  it("returns empty strings when sale price is zero", () => {
    const result = computeLiveListingMetrics({
      purchaseUnitPrice: "1",
      firstLegShippingFee: "1",
      lastLegShippingFee: "1",
      overseasWarehouseFee: "1",
      subsidySellingPrice: "",
    });
    expect(result.totalCost).toBe("4");
    expect(result.grossProfit).toBe("-4");
    expect(result.profitMarginPercent).toBe("");
  });
});
