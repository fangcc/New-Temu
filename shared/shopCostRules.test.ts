import { describe, expect, it } from "vitest";
import { DEFAULT_SHOP_COST_RULES, parseShopCostRules, serializeShopCostRules } from "./shopCostRules";

describe("shopCostRules", () => {
  it("空值时使用默认规则", () => {
    expect(parseShopCostRules(null)).toEqual(DEFAULT_SHOP_COST_RULES);
  });

  it("解析并保存自定义规则", () => {
    const custom = {
      ...DEFAULT_SHOP_COST_RULES,
      firstLeg: { type: "per_kg" as const, ratePerKg: 70 },
      overseas: { type: "fixed" as const, amount: 5 },
    };
    const json = serializeShopCostRules(custom);
    const parsed = parseShopCostRules(json);
    expect(parsed.firstLeg.ratePerKg).toBe(70);
    expect(parsed.overseas.amount).toBe(5);
  });
});
