import {
  DEFAULT_SHOP_COST_RULES,
  type ShopCostRules,
} from "./shopCostRules";

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const normalized = value.trim();
  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function formatMoney(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return roundToTwo(value).toFixed(2).replace(/\.00$/, "").replace(/(\.\d*[1-9])0$/, "$1");
}

export function calculateFirstLegShippingFee(
  weight: string | number,
  rules: ShopCostRules = DEFAULT_SHOP_COST_RULES,
) {
  const grams = toNumber(weight);
  if (grams <= 0) {
    return 0;
  }

  return roundToTwo((grams * rules.firstLeg.ratePerKg) / 1000);
}

export function calculateLastLegShippingFee(
  weight: string | number,
  rules: ShopCostRules = DEFAULT_SHOP_COST_RULES,
) {
  const grams = toNumber(weight);

  for (const tier of rules.lastLeg.tiers) {
    if (grams >= tier.minGrams && grams <= tier.maxGrams) {
      return tier.fee;
    }
  }

  return 0;
}

export function calculateOverseasWarehouseFee(rules: ShopCostRules = DEFAULT_SHOP_COST_RULES) {
  return rules.overseas.amount;
}

export function calculateProductCostBreakdown(
  input: {
    purchaseUnitPrice?: string | number | null;
    weight?: string | number | null;
  },
  rules: ShopCostRules = DEFAULT_SHOP_COST_RULES,
) {
  const purchaseUnitPrice = toNumber(input.purchaseUnitPrice);
  const firstLegShippingFee = calculateFirstLegShippingFee(input.weight ?? 0, rules);
  const lastLegShippingFee = calculateLastLegShippingFee(input.weight ?? 0, rules);
  const overseasWarehouseFee = calculateOverseasWarehouseFee(rules);
  const totalCostPrice = roundToTwo(
    purchaseUnitPrice + firstLegShippingFee + lastLegShippingFee + overseasWarehouseFee,
  );

  return {
    purchaseUnitPrice,
    firstLegShippingFee,
    lastLegShippingFee,
    overseasWarehouseFee,
    totalCostPrice,
  };
}

export function buildProductCostFields(
  input: {
    purchaseUnitPrice?: string | number | null;
    weight?: string | number | null;
  },
  rules: ShopCostRules = DEFAULT_SHOP_COST_RULES,
) {
  const breakdown = calculateProductCostBreakdown(input, rules);

  return {
    purchaseUnitPrice: formatMoney(breakdown.purchaseUnitPrice),
    firstLegShippingFee: formatMoney(breakdown.firstLegShippingFee),
    lastLegShippingFee: formatMoney(breakdown.lastLegShippingFee),
    overseasWarehouseFee: formatMoney(breakdown.overseasWarehouseFee),
    totalCostPrice: formatMoney(breakdown.totalCostPrice),
  };
}

export function getProductCostKeywordParts(input: {
  purchaseUnitPrice?: string | number | null;
  firstLegShippingFee?: string | number | null;
  lastLegShippingFee?: string | number | null;
  overseasWarehouseFee?: string | number | null;
  totalCostPrice?: string | number | null;
}) {
  return [
    input.purchaseUnitPrice,
    input.firstLegShippingFee,
    input.lastLegShippingFee,
    input.overseasWarehouseFee,
    input.totalCostPrice,
  ]
    .map((item) => (item ?? "").toString())
    .filter(Boolean);
}

/** @deprecated 使用当前店铺 rules；保留便于旧 UI 引用默认头程单价 */
export const PRODUCT_COST_CONSTANTS = {
  fixedOverseasWarehouseFee: DEFAULT_SHOP_COST_RULES.overseas.amount,
  firstLegRatePerKg: DEFAULT_SHOP_COST_RULES.firstLeg.ratePerKg,
} as const;
