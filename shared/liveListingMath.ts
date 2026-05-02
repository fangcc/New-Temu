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
    return "";
  }
  return roundToTwo(value)
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d*[1-9])0$/, "$1");
}

export type LiveListingCostInput = {
  purchaseUnitPrice?: string | number | null;
  firstLegShippingFee?: string | number | null;
  lastLegShippingFee?: string | number | null;
  overseasWarehouseFee?: string | number | null;
  subsidySellingPrice?: string | number | null;
};

/**
 * 与运营表格一致：
 * 总成本 = 采购单价 + 头程 + 核定尾程 + 海外仓
 * 毛利 = 运费补贴售价 - 总成本
 * 利润率 = 毛利 / 运费补贴售价（售价基数）
 */
export function computeLiveListingMetrics(input: LiveListingCostInput) {
  const purchaseUnitPrice = toNumber(input.purchaseUnitPrice);
  const firstLegShippingFee = toNumber(input.firstLegShippingFee);
  const lastLegShippingFee = toNumber(input.lastLegShippingFee);
  const overseasWarehouseFee = toNumber(input.overseasWarehouseFee);
  const subsidySellingPrice = toNumber(input.subsidySellingPrice);

  const totalCost = roundToTwo(
    purchaseUnitPrice + firstLegShippingFee + lastLegShippingFee + overseasWarehouseFee,
  );
  const grossProfit = roundToTwo(subsidySellingPrice - totalCost);
  const profitMarginPercent =
    subsidySellingPrice > 0 ? roundToTwo((grossProfit / subsidySellingPrice) * 100) : null;

  return {
    totalCost: formatMoney(totalCost),
    grossProfit: formatMoney(grossProfit),
    profitMarginPercent: profitMarginPercent === null ? "" : formatMoney(profitMarginPercent),
  };
}
