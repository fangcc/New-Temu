import crypto from "node:crypto";
import { and, desc, eq, ne } from "drizzle-orm";
import { computeLiveListingMetrics } from "../shared/liveListingMath";
import { liveProductListings, type InsertLiveProductListingRow } from "../drizzle/schema";
import { getDb } from "./db";

export type LiveListing = {
  id: string;
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

function toRowString(value: string | undefined) {
  return (value ?? "").trim();
}

function toSerializable(row: typeof liveProductListings.$inferSelect): LiveListing {
  return {
    id: row.id,
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

function buildRowValues(input: LiveListingInput, id: string): InsertLiveProductListingRow {
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

export async function listLiveListings() {
  const db = await getDb();
  if (!db) {
    throw new Error("数据库当前不可用，请稍后再试");
  }

  const rows = await db.select().from(liveProductListings).orderBy(desc(liveProductListings.updatedAt));
  return rows.map(toSerializable);
}

export async function createLiveListing(input: LiveListingInput) {
  const db = await getDb();
  if (!db) {
    throw new Error("数据库当前不可用，请稍后再试");
  }

  const spuId = toRowString(input.spuId);
  const dup = await db.select({ id: liveProductListings.id }).from(liveProductListings).where(eq(liveProductListings.spuId, spuId)).limit(1);
  if (dup[0]) {
    throw new Error("该 SPU 已在售表中存在，请勿重复添加");
  }

  const id = crypto.randomUUID();
  const values = buildRowValues({ ...input, spuId }, id);
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

  const spuId = toRowString(input.spuId);
  const conflict = await db
    .select({ id: liveProductListings.id })
    .from(liveProductListings)
    .where(and(eq(liveProductListings.spuId, spuId), ne(liveProductListings.id, id)))
    .limit(1);
  if (conflict[0]) {
    throw new Error("该 SPU 已被其他在售记录占用");
  }

  const values = buildRowValues({ ...input, spuId }, id);
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
