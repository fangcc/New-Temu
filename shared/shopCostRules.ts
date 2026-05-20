/** 按店铺 + 货类（普货/特货）配置的上新成本自动核算规则。 */

export type CargoType = "general" | "special";

export const CARGO_TYPE_OPTIONS: { value: CargoType; label: string }[] = [
  { value: "general", label: "普货" },
  { value: "special", label: "特货" },
];

export function cargoTypeLabel(cargoType: string | null | undefined): string {
  return cargoType === "special" ? "特货" : "普货";
}

export function normalizeCargoType(value: string | null | undefined): CargoType {
  return value === "special" ? "special" : "general";
}

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

/** 单套（普货或特货）的三项运费规则 */
export type ShopCostRuleSet = {
  firstLeg: FirstLegCostRule;
  lastLeg: LastLegCostRule;
  overseas: OverseasCostRule;
};

/** @deprecated 别名，与 ShopCostRuleSet 相同 */
export type ShopCostRules = ShopCostRuleSet;

/** 本店两套公式：普货 + 特货 */
export type ShopCostRulesConfig = {
  general: ShopCostRuleSet;
  special: ShopCostRuleSet;
};

export const DEFAULT_SHOP_COST_RULE_SET: ShopCostRuleSet = {
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

/** @deprecated 使用 DEFAULT_SHOP_COST_RULE_SET */
export const DEFAULT_SHOP_COST_RULES = DEFAULT_SHOP_COST_RULE_SET;

export const DEFAULT_SHOP_COST_RULES_CONFIG: ShopCostRulesConfig = {
  general: DEFAULT_SHOP_COST_RULE_SET,
  special: cloneRuleSet(DEFAULT_SHOP_COST_RULE_SET),
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

function normalizeRuleSet(raw: unknown): ShopCostRuleSet | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const parsed = raw as Partial<ShopCostRuleSet>;
  const ratePerKg = Number(parsed.firstLeg?.ratePerKg);
  const overseasAmount = Number(parsed.overseas?.amount);
  const tiers = (parsed.lastLeg?.tiers ?? [])
    .map(normalizeTier)
    .filter((t): t is LastLegTier => t !== null)
    .sort((a, b) => a.minGrams - b.minGrams);

  if (!isFinitePositive(ratePerKg) || ratePerKg <= 0) {
    return null;
  }
  if (!isFinitePositive(overseasAmount)) {
    return null;
  }
  if (tiers.length === 0) {
    return null;
  }

  return {
    firstLeg: { type: "per_kg", ratePerKg },
    lastLeg: { type: "weight_tiers", tiers },
    overseas: { type: "fixed", amount: overseasAmount },
  };
}

export function cloneRuleSet(rules: ShopCostRuleSet): ShopCostRuleSet {
  return {
    firstLeg: { ...rules.firstLeg },
    lastLeg: { type: "weight_tiers", tiers: rules.lastLeg.tiers.map((t) => ({ ...t })) },
    overseas: { ...rules.overseas },
  };
}

export function cloneRulesConfig(config: ShopCostRulesConfig): ShopCostRulesConfig {
  return {
    general: cloneRuleSet(config.general),
    special: cloneRuleSet(config.special),
  };
}

export function resolveCostRules(config: ShopCostRulesConfig, cargoType: CargoType): ShopCostRuleSet {
  return config[cargoType];
}

/** 兼容旧版：仅一套公式时视为普货、特货共用同一套 */
export function parseShopCostRules(json: string | null | undefined): ShopCostRulesConfig {
  if (!json?.trim()) {
    return cloneRulesConfig(DEFAULT_SHOP_COST_RULES_CONFIG);
  }
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    if (parsed.firstLeg) {
      const legacy = normalizeRuleSet(parsed);
      if (legacy) {
        return { general: legacy, special: cloneRuleSet(legacy) };
      }
    }
    const general = normalizeRuleSet(parsed.general);
    const special = normalizeRuleSet(parsed.special);
    if (general && special) {
      return { general, special };
    }
    if (general) {
      return { general, special: cloneRuleSet(general) };
    }
  } catch {
    /* fall through */
  }
  return cloneRulesConfig(DEFAULT_SHOP_COST_RULES_CONFIG);
}

export function serializeShopCostRules(config: ShopCostRulesConfig): string {
  return JSON.stringify(config);
}

export function describeShopCostRuleSet(rules: ShopCostRuleSet): string {
  const tierText = rules.lastLeg.tiers
    .map((t) => `${t.minGrams}–${t.maxGrams}g → ${t.fee}元`)
    .join("；");
  return `头程：重量 × ${rules.firstLeg.ratePerKg} ÷ 1000；尾程：${tierText}；海外仓：固定 ${rules.overseas.amount} 元`;
}

export function describeShopCostRules(rules: ShopCostRuleSet): string {
  return describeShopCostRuleSet(rules);
}

export function describeShopCostRulesConfig(config: ShopCostRulesConfig): string {
  return `普货：${describeShopCostRuleSet(config.general)}｜特货：${describeShopCostRuleSet(config.special)}`;
}
