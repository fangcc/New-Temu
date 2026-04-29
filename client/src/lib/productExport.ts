import * as XLSX from "xlsx";
import { PRODUCT_EXPORT_COLUMNS, buildProductExportRows, type ProductExportRecord } from "@shared/productAi";

function safeSheetName(value: string) {
  return value.replace(/[\\/*?:\[\]]/g, "-").slice(0, 31) || "产品记录";
}

export function exportProductRecordsToWorkbook(options: {
  records: ProductExportRecord[];
  fileName: string;
  sheetName: string;
}) {
  const rows = buildProductExportRows(options.records);
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: PRODUCT_EXPORT_COLUMNS.map((item) => item.label),
  });

  const columnWidths = PRODUCT_EXPORT_COLUMNS.map((column) => ({
    wch: Math.max(
      column.label.length + 2,
      ...rows.map((row) => String(row[column.label] ?? "").slice(0, 48).length + 2),
    ),
  }));

  worksheet["!cols"] = columnWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(options.sheetName));
  XLSX.writeFile(workbook, options.fileName, { compression: true });
}
