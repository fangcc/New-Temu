/** 与在售 tRPC 入参一致，供 Excel 解析与 bulkImport 共用 */
export type LiveListingImportRow = {
  spuId: string;
  productName: string;
  supplier1688Url: string;
  weight: string;
  purchaseUnitPrice: string;
  firstLegShippingFee: string;
  lastLegShippingFee: string;
  overseasWarehouseFee: string;
  declaredPrice: string;
  subsidySellingPrice: string;
  sourceProductRecordId: string;
  note: string;
};
