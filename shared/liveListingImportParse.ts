import type { LiveListingImportRow } from "./liveListingImportTypes";

export type { LiveListingImportRow };

/** 表头归一化：去首尾空白、全角括号转半角、去中间空白（便于匹配「申报核价（元）」等） */
export function normalizeHeaderLabel(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/（/g, "(")
    .replace(/）/g, ")");
}

/**
 * 识别「美区TEMU核价表」类模板：第 1 列可能是日期/空，表头行含「产品名称」与「SPU」。
 * 返回表头所在行索引（0-based）；找不到则返回 -1。
 */
export function findLiveListingHeaderRowIndex(matrix: unknown[][], maxScan = 40): number {
  const limit = Math.min(maxScan, matrix.length);
  for (let i = 0; i < limit; i++) {
    const row = matrix[i];
    if (!Array.isArray(row)) {
      continue;
    }
    const labels = row.map((c) => normalizeHeaderLabel(c));
    const joined = labels.join("|");
    if (joined.includes("产品名称") && (joined.includes("SPUID") || joined.includes("SPU"))) {
      return i;
    }
  }
  return -1;
}

type HeaderMap = Partial<Record<keyof LiveListingImportRow, number>>;

function mapHeaders(headerRow: unknown[]): HeaderMap {
  const map: HeaderMap = {};
  const synonyms: Array<{ key: keyof LiveListingImportRow; needles: string[] }> = [
    { key: "productName", needles: ["产品名称"] },
    { key: "spuId", needles: ["SPUID", "SPU_ID"] },
    { key: "supplier1688Url", needles: ["1688商品链接"] },
    { key: "weight", needles: ["重量(g)", "重量（g)"] },
    { key: "purchaseUnitPrice", needles: ["商品采购单价"] },
    { key: "firstLegShippingFee", needles: ["头程重量运费"] },
    { key: "lastLegShippingFee", needles: ["核定尾程运费"] },
    { key: "overseasWarehouseFee", needles: ["海外仓操作费"] },
    { key: "declaredPrice", needles: ["申报核价(元)", "申报核价"] },
    { key: "subsidySellingPrice", needles: ["运费补贴售价"] },
  ];

  headerRow.forEach((cell, index) => {
    const norm = normalizeHeaderLabel(cell);
    for (const { key, needles } of synonyms) {
      if (map[key] !== undefined) {
        continue;
      }
      if (needles.some((n) => norm === n || norm.startsWith(n))) {
        map[key] = index;
      }
    }
  });

  return map;
}

function cellString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "";
    }
    if (Number.isInteger(value) && Math.abs(value) > 1e12) {
      return String(BigInt(Math.trunc(value)));
    }
    return String(value);
  }
  let s = String(value).trim();
  if (s.startsWith("=")) {
    return "";
  }
  s = s.replace(/\u00a0/g, " ").trim();
  return s;
}

function cellSpu(value: unknown): string {
  const s = cellString(value);
  if (!s) {
    return "";
  }
  const digits = s.replace(/[^\d]/g, "");
  return digits.length >= 6 ? digits : s.replace(/\s/g, "");
}

/**
 * 将 `sheet_to_json(..., { header: 1 })` 得到的二维表解析为导入行。
 * 同一文件内重复 SPU：**后者覆盖前者**（与「再导一次表」一致）。
 */
export function parseLiveListingImportMatrix(matrix: unknown[][]): {
  rows: LiveListingImportRow[];
  skippedEmpty: number;
  duplicateCountInFile: number;
} {
  const headerIdx = findLiveListingHeaderRowIndex(matrix);
  if (headerIdx < 0) {
    return { rows: [], skippedEmpty: 0, duplicateCountInFile: 0 };
  }

  const headerMap = mapHeaders(matrix[headerIdx] ?? []);
  if (headerMap.spuId === undefined || headerMap.productName === undefined) {
    return { rows: [], skippedEmpty: 0, duplicateCountInFile: 0 };
  }

  const bySpu = new Map<string, LiveListingImportRow>();
  let skippedEmpty = 0;
  let rawValid = 0;

  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const line = matrix[r];
    if (!Array.isArray(line)) {
      continue;
    }
    const spuId = cellSpu(line[headerMap.spuId!]);
    const productName = cellString(line[headerMap.productName!]);
    if (!spuId || !productName) {
      skippedEmpty += 1;
      continue;
    }

    const pick = (key: keyof LiveListingImportRow) =>
      headerMap[key] === undefined ? "" : cellString(line[headerMap[key]!]);

    rawValid += 1;
    bySpu.set(spuId, {
      spuId,
      productName,
      supplier1688Url: pick("supplier1688Url"),
      weight: pick("weight"),
      purchaseUnitPrice: pick("purchaseUnitPrice"),
      firstLegShippingFee: pick("firstLegShippingFee"),
      lastLegShippingFee: pick("lastLegShippingFee"),
      overseasWarehouseFee: pick("overseasWarehouseFee"),
      declaredPrice: pick("declaredPrice"),
      subsidySellingPrice: pick("subsidySellingPrice"),
      sourceProductRecordId: "",
      note: "",
    });
  }

  return {
    rows: Array.from(bySpu.values()),
    skippedEmpty,
    duplicateCountInFile: Math.max(0, rawValid - bySpu.size),
  };
}
