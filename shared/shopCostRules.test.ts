import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHOP_COST_RULES_CONFIG,
  parseShopCostRules,
  resolveCostRules,
  serializeShopCostRules,
} from "./shopCostRules";

describe("shopCostRules", () => {
  it("空值时使用默认普货/特货配置", () => {
    expect(parseShopCostRules(null)).toEqual(DEFAULT_SHOP_COST_RULES_CONFIG);
  });

  it("解析普货+特货两套规则", () => {
    const custom = {
      general: {
        ...DEFAULT_SHOP_COST_RULES_CONFIG.general,
        overseas: { type: "fixed" as const, amount: 4 },
      },
      special: {
        ...DEFAULT_SHOP_COST_RULES_CONFIG.special,
        firstLeg: { type: "per_kg" as const, ratePerKg: 80 },
        overseas: { type: "fixed" as const, amount: 6 },
      },
    };
    const parsed = parseShopCostRules(serializeShopCostRules(custom));
    expect(parsed.special.firstLeg.ratePerKg).toBe(80);
    expect(parsed.special.overseas.amount).toBe(6);
  });

  it("兼容旧版单套 JSON", () => {
    const legacy = DEFAULT_SHOP_COST_RULES_CONFIG.general;
    const parsed = parseShopCostRules(JSON.stringify(legacy));
    expect(parsed.general).toEqual(legacy);
    expect(parsed.special.firstLeg.ratePerKg).toBe(legacy.firstLeg.ratePerKg);
  });

  it("按货类选取规则", () => {
    const config = parseShopCostRules(
      serializeShopCostRules({
        ...DEFAULT_SHOP_COST_RULES_CONFIG,
        special: {
          ...DEFAULT_SHOP_COST_RULES_CONFIG.special,
          firstLeg: { type: "per_kg", ratePerKg: 99 },
        },
      }),
    );
    expect(resolveCostRules(config, "special").firstLeg.ratePerKg).toBe(99);
    expect(resolveCostRules(config, "general").firstLeg.ratePerKg).toBe(62);
  });
});
