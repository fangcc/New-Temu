import { beforeEach, describe, expect, it, vi } from "vitest";

const { jsonToSheetMock, bookNewMock, bookAppendSheetMock, writeFileMock } = vi.hoisted(() => ({
  jsonToSheetMock: vi.fn(),
  bookNewMock: vi.fn(),
  bookAppendSheetMock: vi.fn(),
  writeFileMock: vi.fn(),
}));

vi.mock("xlsx", () => ({
  utils: {
    json_to_sheet: jsonToSheetMock,
    book_new: bookNewMock,
    book_append_sheet: bookAppendSheetMock,
  },
  writeFile: writeFileMock,
}));

import { exportProductRecordsToWorkbook } from "./productExport";

describe("exportProductRecordsToWorkbook", () => {
  beforeEach(() => {
    jsonToSheetMock.mockReset();
    bookNewMock.mockReset();
    bookAppendSheetMock.mockReset();
    writeFileMock.mockReset();

    jsonToSheetMock.mockReturnValue({});
    bookNewMock.mockReturnValue({ id: "workbook" });
  });

  it("creates an xlsx workbook with safe worksheet naming and mapped rows", () => {
    exportProductRecordsToWorkbook({
      records: [
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
      ],
      fileName: "产品记录导出-今日.xlsx",
      sheetName: "今日上新/2026:04:15",
    });

    expect(jsonToSheetMock).toHaveBeenCalledTimes(1);
    expect(bookAppendSheetMock).toHaveBeenCalledWith({ id: "workbook" }, expect.any(Object), "今日上新-2026-04-15");
    expect(writeFileMock).toHaveBeenCalledWith({ id: "workbook" }, "产品记录导出-今日.xlsx", { compression: true });
  });
});
