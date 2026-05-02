import { describe, expect, it } from "vitest";
import { findLiveListingHeaderRowIndex, parseLiveListingImportMatrix } from "./liveListingImportParse";

describe("liveListingImportParse", () => {
  it("finds header row like 美区TEMU核价表 template", () => {
    const matrix: unknown[][] = [
      ["美区TEMU核价表"],
      ["核价表"],
      ["日期", "产品图片", "产品名称", "SPU ID", "1688商品链接", "重量(g)", "商品采购单价", "头程重量运费", "核定尾程运费", "海外仓操作费", "总成本", "申报核价（元）", "运费补贴售价"],
      [46126, "", "美国4个国徽", 8005934020, "https://1688.example/a", 50, 10, 3.1, 21, 4, 38.1, 24, 45],
      ["", "", "重复SPU", 8005934020, "", 50, 11, 3.1, 21, 4, 39.1, 25, 46],
    ];
    expect(findLiveListingHeaderRowIndex(matrix)).toBe(2);
    const { rows, duplicateCountInFile } = parseLiveListingImportMatrix(matrix);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.spuId).toBe("8005934020");
    expect(rows[0]?.productName).toBe("重复SPU");
    expect(rows[0]?.purchaseUnitPrice).toBe("11");
    expect(duplicateCountInFile).toBe(1);
  });
});
