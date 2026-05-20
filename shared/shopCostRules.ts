/** 按店铺配置的上新成本自动核算规则（结构化，非任意脚本）。 */

export type FirstLegCostRule = {
  type: "per_kg";
  /** 元 / kg，头程 = 重量(g) × ratePerKg ÷ 1000 */
  ratePerKg: number;
};

export type LastLegTier = {
  minGrams: number;
  maxGrams: number;
  fee: number;
};

export type LastLegCostRule = {
  type: "weight_tiers";
  tiers: LastLegTier[];
};

export type OverseasCostRule = {
  type: "fixed";
  amount: number;
};

export type ShopCostRules = {
  firstLeg: FirstLegCostRule;
  lastLeg: LastLegCostRule;
  overseas: OverseasCostRule;
};

export const DEFAULT_SHOP_COST_RULES: ShopCostRules = {
  firstLeg: { type: "per_kg", ratePerKg: 62 },
  lastLeg: {
    type: "weight_tiers",
    tiers: [
      { minGrams: 5, maxGrams: 199, fee: 21 },
      { minGrams: 200, maxGrams: 399, fee: 28 },
      { minGrams: 400, maxGrams: 5000, fee: 33 },
    ],
  },
  overseas: { type: "fixed", amount: 4 },
};

function isFinitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

function normalizeTier(raw: unknown): LastLegTier | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const t = raw as Record<string, unknown>;
  const minGrams = Number(t.minGrams);
  const maxGrams = Number(t.maxGrams);
  const fee = Number(t.fee);
  if (!isFinitePositive(minGrams) || !isFinitePositive(maxGrams) || !isFinitePositive(fee)) {
    return null;
  }
  if (minGrams > maxGrams) {
    return null;
  }
  return { minGrams, maxGrams, fee };
}

export function parseShopCostRules(json: string | null | undefined): ShopCostRules {
  if (!json?.trim()) {
    return DEFAULT_SHOP_COST_RULES;
  }
  try {
    const parsed = JSON.parse(json) as Partial<ShopCostRules>;
    const ratePerKg = Number(parsed.firstLeg?.ratePerKg);
    const overseasAmount = Number(parsed.overseas?.amount);
    const tiers = (parsed.lastLeg?.tiers ?? [])
      .map(normalizeTier)
      .filter((t): t is LastLegTier => t !== null)
      .sort((a, b) => a.minGrams - b.minGrams);

    if (!isFinitePositive(ratePerKg) || ratePerKg <= 0) {
      return DEFAULT_SHOP_COST_RULES;
    }
    if (!isFinitePositive(overseasAmount)) {
      return DEFAULT_SHOP_COST_RULES;
    }
    if (tiers.length === 0) {
      return DEFAULT_SHOP_COST_RULES;
    }

    return {
      firstLeg: { type: "per_kg", ratePerKg },
      lastLeg: { type: "weight_tiers", tiers },
      overseas: { type: "fixed", amount: overseasAmount },
    };
  } catch {
    return DEFAULT_SHOP_COST_RULES;
  }
}

export function serializeShopCostRules(rules: ShopCostRules): string {
  return JSON.stringify(rules);
}

export function describeShopCostRules(rules: ShopCostRules): string {
  const tierText = rules.lastLeg.tiers
    .map((t) => `${t.minGrams}–${t.maxGrams}g → ${t.fee}元`)
    .join("；");
  return `头程：重量 × ${rules.firstLeg.ratePerKg} ÷ 1000；尾程：${tierText}；海外仓：固定 ${rules.overseas.amount} 元`;
}
