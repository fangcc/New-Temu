import crypto from "node:crypto";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { computeLiveListingMetrics } from "../shared/liveListingMath";
import { liveProductListings, type InsertLiveProductListingRow } from "../drizzle/schema";
import { getDb, getProductRecordById } from "./db";

export type LiveListing = {
  id: string;
  shopId: string;
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
  totalCost: string;
  grossProfit: string;
  profitMarginPercent: string;
  sourceProductRecordId: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type LiveListingInput = {
  shopId?: string;
  spuId: string;
  productName: string;
  supplier1688Url?: string;
  weight?: string;
  purchaseUnitPrice?: string;
  firstLegShippingFee?: string;
  lastLegShippingFee?: string;
  overseasWarehouseFee?: string;
  declaredPrice?: string;
  subsidySellingPrice?: string;
  sourceProductRecordId?: string;
  note?: string;
};

export type LiveListingBulkRow = Omit<LiveListingInput, "shopId">;

function toRowString(value: string | undefined) {
  return (value ?? "").trim();
}

function toSerializable(row: typeof liveProductListings.$inferSelect): LiveListing {
  return {
    id: row.id,
    shopId: row.shopId,
    spuId: row.spuId,
    productName: row.productName,
    supplier1688Url: row.supplier1688Url,
    weight: row.weight,
    purchaseUnitPrice: row.purchaseUnitPrice,
    firstLegShippingFee: row.firstLegShippingFee,
    lastLegShippingFee: row.lastLegShippingFee,
    overseasWarehouseFee: row.overseasWarehouseFee,
    declaredPrice: row.declaredPrice,
    subsidySellingPrice: row.subsidySellingPrice,
    totalCost: row.totalCost,
    grossProfit: row.grossProfit,
    profitMarginPercent: row.profitMarginPercent,
    sourceProductRecordId: row.sourceProductRecordId,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildRowValues(input: LiveListingInput, id: string, shopId: string): InsertLiveProductListingRow {
  const purchaseUnitPrice = toRowString(input.purchaseUnitPrice);
  const firstLegShippingFee = toRowString(input.firstLegShippingFee);
  const lastLegShippingFee = toRowString(input.lastLegShippingFee);
  const overseasWarehouseFee = toRowString(input.overseasWarehouseFee);
  const subsidySellingPrice = toRowString(input.subsidySellingPrice);
  const metrics = computeLiveListingMetrics({
    purchaseUnitPrice,
    firstLegShippingFee,
    lastLegShippingFee,
    overseasWarehouseFee,
    subsidySellingPrice,
  });

  return {
    id,
    shopId,
    spuId: toRowString(input.spuId),
    productName: toRowString(input.productName),
    supplier1688Url: toRowString(input.supplier1688Url),
    weight: toRowString(input.weight),
    purchaseUnitPrice,
    firstLegShippingFee,
    lastLegShippingFee,
    overseasWarehouseFee,
    declaredPrice: toRowString(input.declaredPrice),
    subsidySellingPrice,
    totalCost: metrics.totalCost,
    grossProfit: metrics.grossProfit,
    profitMarginPercent: metrics.profitMarginPercent,
    sourceProductRecordId: toRowString(input.sourceProductRecordId),
    note: toRowString(input.note),
  };
}

export async function listLiveListings(shopId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("数据库当前不可用，请稍后再试");
  }

  const sid = shopId.trim();
  if (!sid) {
    throw new Error("请选择店铺");
  }

  const rows = await db
    .select()
    .from(liveProductListings)
    .where(eq(liveProductListings.shopId, sid))
    .orderBy(desc(liveProductListings.updatedAt));
  return rows.map(toSerializable);
}

export async function createLiveListing(input: LiveListingInput) {
  const db = await getDb();
  if (!db) {
    throw new Error("数据库当前不可用，请稍后再试");
  }

  const shopId = toRowString(input.shopId);
  if (!shopId) {
    throw new Error("请选择店铺");
  }

  const spuId = toRowString(input.spuId);
  const dup = await db
    .select({ id: liveProductListings.id })
    .from(liveProductListings)
    .where(and(eq(liveProductListings.shopId, shopId), eq(liveProductListings.spuId, spuId)))
    .limit(1);
  if (dup[0]) {
    throw new Error("该 SPU 在当前店铺已在售表中存在，请勿重复添加");
  }

  const id = crypto.randomUUID();
  const values = buildRowValues({ ...input, spuId }, id, shopId);
  await db.insert(liveProductListings).values(values);

  const row = await db.select().from(liveProductListings).where(eq(liveProductListings.id, id)).limit(1);
  if (!row[0]) {
    throw new Error("保存成功但读取失败");
  }
  return toSerializable(row[0]);
}

export async function updateLiveListing(id: string, input: LiveListingInput) {
  const db = await getDb();
  if (!db) {
    throw new Error("数据库当前不可用，请稍后再试");
  }

  const existingRows = await db.select().from(liveProductListings).where(eq(liveProductListings.id, id)).limit(1);
  if (!existingRows[0]) {
    throw new Error("记录不存在或已被删除");
  }

  const existingShopId = existingRows[0].shopId;
  const spuId = toRowString(input.spuId);
  const conflict = await db
    .select({ id: liveProductListings.id })
    .from(liveProductListings)
    .where(
      and(
        eq(liveProductListings.shopId, existingShopId),
        eq(liveProductListings.spuId, spuId),
        ne(liveProductListings.id, id),
      ),
    )
    .limit(1);
  if (conflict[0]) {
    throw new Error("该 SPU 已被当前店铺下其他在售记录占用");
  }

  const values = buildRowValues({ ...input, spuId }, id, existingShopId);
  await db.update(liveProductListings).set(values).where(eq(liveProductListings.id, id));

  const row = await db.select().from(liveProductListings).where(eq(liveProductListings.id, id)).limit(1);
  if (!row[0]) {
    throw new Error("更新成功但读取失败");
  }
  return toSerializable(row[0]);
}

export async function deleteLiveListing(id: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("数据库当前不可用，请稍后再试");
  }

  const existingRows = await db.select().from(liveProductListings).where(eq(liveProductListings.id, id)).limit(1);
  if (!existingRows[0]) {
    return { success: true } as const;
  }

  await db.delete(liveProductListings).where(eq(liveProductListings.id, id));
  return { success: true } as const;
}

export async function bulkImportLiveListings(
  shopId: string,
  rows: LiveListingBulkRow[],
): Promise<{
  created: number;
  updated: number;
  failed: number;
  errors: Array<{ spuId: string; message: string }>;
}> {
  const db = await getDb();
  if (!db) {
    throw new Error("数据库当前不可用，请稍后再试");
  }

  const sid = shopId.trim();
  if (!sid) {
    throw new Error("请选择店铺");
  }

  const lastBySpu = new Map<string, LiveListingInput>();
  for (const r of rows) {
    const spuId = toRowString(r.spuId);
    const productName = toRowString(r.productName);
    if (!spuId || !productName) {
      continue;
    }
    lastBySpu.set(spuId, { ...r, shopId: sid, spuId, productName });
  }

  const list = Array.from(lastBySpu.values());
  if (list.length === 0) {
    return { created: 0, updated: 0, failed: 0, errors: [] };
  }

  const spuIds = list.map((r) => r.spuId);
  const existingRows = await db
    .select()
    .from(liveProductListings)
    .where(and(eq(liveProductListings.shopId, sid), inArray(liveProductListings.spuId, spuIds)));
  const idBySpu = new Map(existingRows.map((row) => [row.spuId, row.id]));

  let created = 0;
  let updated = 0;
  const errors: Array<{ spuId: string; message: string }> = [];

  for (const input of list) {
    try {
      const existingId = idBySpu.get(input.spuId);
      if (existingId) {
        await updateLiveListing(existingId, input);
        updated += 1;
      } else {
        await createLiveListing(input);
        created += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ spuId: input.spuId, message });
    }
  }

  return {
    created,
    updated,
    failed: errors.length,
    errors: errors.slice(0, 80),
  };
}

export async function upsertLiveListingFromProductRecord(options: {
  productRecordId: string;
  spuId: string;
  declaredPrice?: string;
  subsidySellingPrice?: string;
}): Promise<LiveListing> {
  const record = await getProductRecordById(options.productRecordId);
  if (!record) {
    throw new Error("上新记录不存在或已删除");
  }

  const spuId = toRowString(options.spuId);
  if (!spuId) {
    throw new Error("请填写 SPU");
  }

  let subsidySellingPrice = toRowString(options.subsidySellingPrice);
  if (!subsidySellingPrice) {
    subsidySellingPrice = toRowString(record.salePrice);
  }
  if (!subsidySellingPrice) {
    throw new Error("请填写「运费补贴售价」，或先在上新记录中填写售价");
  }

  const noteBase = `从上新同步（${record.listingDate}）`;
  const noteExtra = toRowString(record.note);
  const note = noteExtra ? `${noteBase}。${noteExtra}` : noteBase;

  const liveInput: LiveListingInput = {
    shopId: record.shopId,
    spuId,
    productName: record.productName,
    supplier1688Url: toRowString(record.supplierUrl),
    weight: toRowString(record.weight),
    purchaseUnitPrice: toRowString(record.purchaseUnitPrice),
    firstLegShippingFee: toRowString(record.firstLegShippingFee),
    lastLegShippingFee: toRowString(record.lastLegShippingFee),
    overseasWarehouseFee: toRowString(record.overseasWarehouseFee),
    declaredPrice: toRowString(options.declaredPrice),
    subsidySellingPrice,
    sourceProductRecordId: record.id,
    note,
  };

  const db = await getDb();
  if (!db) {
    throw new Error("数据库当前不可用，请稍后再试");
  }

  const existing = await db
    .select({ id: liveProductListings.id })
    .from(liveProductListings)
    .where(and(eq(liveProductListings.shopId, record.shopId), eq(liveProductListings.spuId, spuId)))
    .limit(1);

  if (existing[0]) {
    return updateLiveListing(existing[0].id, liveInput);
  }

  return createLiveListing(liveInput);
}
