const FIXED_OVERSEAS_WAREHOUSE_FEE = 4;
const FIRST_LEG_RATE_PER_KG = 62;

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

export function calculateFirstLegShippingFee(weight: string | number) {
  const grams = toNumber(weight);
  if (grams <= 0) {
    return 0;
  }

  return roundToTwo((grams * FIRST_LEG_RATE_PER_KG) / 1000);
}

export function calculateLastLegShippingFee(weight: string | number) {
  const grams = toNumber(weight);

  if (grams >= 5 && grams <= 199) {
    return 21;
  }
  if (grams >= 200 && grams <= 399) {
    return 28;
  }
  if (grams >= 400 && grams <= 5000) {
    return 33;
  }

  return 0;
}

export function calculateOverseasWarehouseFee() {
  return FIXED_OVERSEAS_WAREHOUSE_FEE;
}

export function calculateProductCostBreakdown(input: {
  purchaseUnitPrice?: string | number | null;
  weight?: string | number | null;
}) {
  const purchaseUnitPrice = toNumber(input.purchaseUnitPrice);
  const firstLegShippingFee = calculateFirstLegShippingFee(input.weight ?? 0);
  const lastLegShippingFee = calculateLastLegShippingFee(input.weight ?? 0);
  const overseasWarehouseFee = calculateOverseasWarehouseFee();
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

export function buildProductCostFields(input: {
  purchaseUnitPrice?: string | number | null;
  weight?: string | number | null;
}) {
  const breakdown = calculateProductCostBreakdown(input);

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

export const PRODUCT_COST_CONSTANTS = {
  fixedOverseasWarehouseFee: FIXED_OVERSEAS_WAREHOUSE_FEE,
  firstLegRatePerKg: FIRST_LEG_RATE_PER_KG,
} as const;
