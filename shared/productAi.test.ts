import { describe, expect, it } from "vitest";
import {
  PRODUCT_EXPORT_COLUMNS,
  buildProductExportRows,
  buildTemuEnglishTitlePrompt,
  buildTemuMainImagePrompt,
} from "./productAi";

describe("product AI helpers", () => {
  it("builds the Temu English title prompt with supplied fields and constraints", () => {
    const prompt = buildTemuEnglishTitlePrompt({
      productName: "Foldable Storage Basket",
      mainSellingPoints: "Space saving lightweight breathable",
      existingEnglishTitle: "Storage basket for home",
    });

    expect(prompt).toContain("商品名称：Foldable Storage Basket");
    expect(prompt).toContain("主要卖点：Space saving lightweight breathable");
    expect(prompt).toContain("现有标题：Storage basket for home");
    expect(prompt).toContain("不要使用逗号");
    expect(prompt).toContain("不需要解释");
  });

  it("fills missing values with explicit placeholders in the image prompt", () => {
    const prompt = buildTemuMainImagePrompt({
      productName: "Silicone Sink Organizer",
    });

    expect(prompt).toContain("商品名称：Silicone Sink Organizer");
    expect(prompt).toContain("核心卖点：未提供");
    expect(prompt).toContain("目标人群：未提供");
    expect(prompt).toContain("Temu 平台的主图");
  });

  it("maps export records to labeled worksheet rows in column order", () => {
    const rows = buildProductExportRows([
      {
        recordCode: "240415-001",
        listingDate: "2026-04-15",
        productName: "Drawer Organizer",
        sourceCollectionUrl: "https://source.example/item",
        supplierUrl: "https://supplier.example/item",
        purchaseUnitPrice: "12.5",
        firstLegShippingFee: "1.24",
        lastLegShippingFee: "28",
        overseasWarehouseFee: "4",
        costPrice: "45.74",
        salePrice: "79.9",
        weight: "200",
        mainSellingPoints: "Stackable compact",
        coreSellingPoint: "Textured anti-slip finish",
        targetAudience: "US apartment renters",
        existingEnglishTitle: "Drawer organizer tray",
        optimizedEnglishTitle: "Stackable Drawer Organizer Tray for Kitchen and Vanity Storage",
        originalImageUrl: "https://cdn.example/original.png",
        optimizedMainImageUrl: "https://cdn.example/optimized.png",
        note: "test note",
        createdAt: "2026/4/15 10:00:00",
        updatedAt: "2026/4/15 10:30:00",
      },
    ]);

    expect(Object.keys(rows[0])).toEqual(PRODUCT_EXPORT_COLUMNS.map((column) => column.label));
    expect(rows[0]["AI 优化英文标题"]).toContain("Stackable Drawer Organizer Tray");
    expect(rows[0]["AI 优化主图链接"]).toBe("https://cdn.example/optimized.png");
  });
});
