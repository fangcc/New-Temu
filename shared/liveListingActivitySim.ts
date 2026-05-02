function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : NaN;
  }
  if (typeof value !== "string") {
    return NaN;
  }
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : NaN;
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

export type ActivitySimulationResult = {
  /** 活动后申报核价 = 原申报核价 × 折扣系数 */
  newDeclaredPrice: number;
  /** 活动后补贴售价 = 活动后申报核价 + 固定加价 */
  newSubsidyPrice: number;
  grossProfit: number;
  /** 百分比数值，如 15.3 表示 15.3% */
  marginPercent: number;
};

/**
 * 活动规则（与需求一致）：
 * - 新申报核价 = 申报核价 × discountMultiplier（如 6 折 → 0.6）
 * - 新补贴售价 = 新申报核价 + subsidyAddon（如 +21）
 * - 毛利 = 新补贴售价 − 总成本（总成本为已入库的四项之和）
 * - 利润率 = 毛利 / 新补贴售价（售价基数）
 */
export function simulateActivityPricing(input: {
  declaredPrice: string;
  totalCost: string;
  discountMultiplier: number;
  subsidyAddon: number;
}): ActivitySimulationResult | null {
  const D = toNumber(input.declaredPrice);
  const T = toNumber(input.totalCost);
  const r = input.discountMultiplier;
  const f = input.subsidyAddon;
  if (!(r > 0 && r <= 1) || !Number.isFinite(D) || !Number.isFinite(T)) {
    return null;
  }
  const newDeclaredPrice = roundToTwo(D * r);
  const newSubsidyPrice = roundToTwo(newDeclaredPrice + f);
  if (!(newSubsidyPrice > 0)) {
    return null;
  }
  const grossProfit = roundToTwo(newSubsidyPrice - T);
  const marginPercent = roundToTwo((grossProfit / newSubsidyPrice) * 100);
  return { newDeclaredPrice, newSubsidyPrice, grossProfit, marginPercent };
}

/**
 * 反推：在加价 f、总成本 T 下，要使「活动后补贴售价」上的利润率恰好等于 targetMarginPercent（%），
 * 所需「活动后申报核价」d1（与列「活动申报」同一口径；折扣 r 只影响如何从表内申报核价得到 d1，不进入该式）。
 *
 * S = T/(1−m)，d1 = S − f，其中 S = d1 + f 为活动后补贴售价。
 */
export function inverseActivityDeclaredForTargetMargin(input: {
  totalCost: string;
  subsidyAddon: number;
  targetMarginPercent: number;
}): number | null {
  const T = toNumber(input.totalCost);
  const f = input.subsidyAddon;
  const m = input.targetMarginPercent / 100;
  if (!Number.isFinite(f) || f < 0 || !Number.isFinite(T) || !(m > 0 && m < 1)) {
    return null;
  }
  const denom = 1 - m;
  if (denom <= 0) {
    return null;
  }
  const S = T / denom;
  if (!Number.isFinite(S) || S <= T) {
    return null;
  }
  const d1 = S - f;
  if (!Number.isFinite(d1) || d1 <= 0) {
    return null;
  }
  return roundToTwo(d1);
}
