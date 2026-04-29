import { describe, expect, it } from "vitest";
import {
  buildProductCostFields,
  calculateFirstLegShippingFee,
  calculateLastLegShippingFee,
  calculateOverseasWarehouseFee,
  calculateProductCostBreakdown,
} from "./productCosting";

describe("productCosting", () => {
  it("按照重量公式计算头程重量运费并保留两位小数", () => {
    expect(calculateFirstLegShippingFee("320")).toBe(19.84);
    expect(calculateFirstLegShippingFee("0")).toBe(0);
  });

  it("按照重量区间计算尾程重量运费", () => {
    expect(calculateLastLegShippingFee("50")).toBe(21);
    expect(calculateLastLegShippingFee("320")).toBe(28);
    expect(calculateLastLegShippingFee("800")).toBe(33);
    expect(calculateLastLegShippingFee("3")).toBe(0);
  });

  it("海外仓操作费固定为 4 元", () => {
    expect(calculateOverseasWarehouseFee()).toBe(4);
  });

  it("汇总采购单价与自动费用得到总成本", () => {
    expect(
      calculateProductCostBreakdown({
        purchaseUnitPrice: "18.5",
        weight: "320",
      }),
    ).toEqual({
      purchaseUnitPrice: 18.5,
      firstLegShippingFee: 19.84,
      lastLegShippingFee: 28,
      overseasWarehouseFee: 4,
      totalCostPrice: 70.34,
    });
  });

  it("输出适合表单和数据库保存的字符串字段", () => {
    expect(
      buildProductCostFields({
        purchaseUnitPrice: "18.5",
        weight: "320",
      }),
    ).toEqual({
      purchaseUnitPrice: "18.5",
      firstLegShippingFee: "19.84",
      lastLegShippingFee: "28",
      overseasWarehouseFee: "4",
      totalCostPrice: "70.34",
    });
  });
});
