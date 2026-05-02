export type ProductExportRecord = {
  recordCode: string;
  listingDate: string;
  productName: string;
  sourceCollectionUrl: string;
  supplierUrl: string;
  purchaseUnitPrice: string;
  firstLegShippingFee: string;
  lastLegShippingFee: string;
  overseasWarehouseFee: string;
  costPrice: string;
  salePrice: string;
  weight: string;
  originalImageUrl: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export const PRODUCT_EXPORT_COLUMNS: Array<{ key: keyof ProductExportRecord; label: string }> = [
  { key: "recordCode", label: "记录编号" },
  { key: "listingDate", label: "上新日期" },
  { key: "productName", label: "产品名称" },
  { key: "sourceCollectionUrl", label: "源采集平台链接" },
  { key: "supplierUrl", label: "货源平台链接" },
  { key: "purchaseUnitPrice", label: "商品采购单价（元）" },
  { key: "firstLegShippingFee", label: "头程重量运费（元）" },
  { key: "lastLegShippingFee", label: "尾程重量运费（元）" },
  { key: "overseasWarehouseFee", label: "海外仓操作费（元）" },
  { key: "costPrice", label: "总成本（元）" },
  { key: "salePrice", label: "售价（元）" },
  { key: "weight", label: "重量（g）" },
  { key: "originalImageUrl", label: "原始主图链接" },
  { key: "note", label: "备注" },
  { key: "createdAt", label: "创建时间" },
  { key: "updatedAt", label: "更新时间" },
];

export function buildProductExportRows(records: ProductExportRecord[]) {
  return records.map((record) => {
    const row: Record<string, string> = {};
    PRODUCT_EXPORT_COLUMNS.forEach((column) => {
      row[column.label] = record[column.key] ?? "";
    });
    return row;
  });
}
