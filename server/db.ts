import crypto from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { buildProductCostFields } from "../shared/productCosting";
import { productRecords, type InsertProductRecordRow, type InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getShopCostRules } from "./shopsDb";
import { storagePut } from "./storage";

let _db: ReturnType<typeof drizzle> | null = null;

export type ProductRecord = {
  id: string;
  shopId: string;
  productName: string;
  sourceCollectionUrl: string;
  supplierUrl: string;
  listingDate: string;
  purchaseUnitPrice: string;
  firstLegShippingFee: string;
  lastLegShippingFee: string;
  overseasWarehouseFee: string;
  costPrice: string;
  salePrice: string;
  weight: string;
  mainSellingPoints: string;
  coreSellingPoint: string;
  targetAudience: string;
  existingEnglishTitle: string;
  optimizedEnglishTitle: string;
  optimizedMainImageUrl: string;
  note: string;
  images: string[];
  createdAt: string;
  updatedAt: string;
};

export type ProductRecordInput = {
  productName: string;
  sourceCollectionUrl: string;
  supplierUrl: string;
  listingDate: string;
  purchaseUnitPrice?: string;
  costPrice?: string;
  salePrice?: string;
  weight?: string;
  mainSellingPoints?: string;
  coreSellingPoint?: string;
  targetAudience?: string;
  existingEnglishTitle?: string;
  optimizedEnglishTitle?: string;
  optimizedMainImageUrl?: string;
  note?: string;
  images?: string[];
  shopId?: string;
};

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

function parseImageUrls(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function toSerializableRecord(row: typeof productRecords.$inferSelect): ProductRecord {
  const purchaseUnitPrice = row.purchaseUnitPrice || row.costPrice;
  const hasSplitFields = Boolean(
    row.purchaseUnitPrice || row.firstLegShippingFee || row.lastLegShippingFee || row.overseasWarehouseFee,
  );
  const computed = buildProductCostFields({
    purchaseUnitPrice,
    weight: row.weight,
  });

  return {
    id: row.id,
    shopId: row.shopId,
    productName: row.productName,
    sourceCollectionUrl: row.sourceCollectionUrl,
    supplierUrl: row.supplierUrl,
    listingDate: row.listingDate,
    purchaseUnitPrice,
    firstLegShippingFee: hasSplitFields ? row.firstLegShippingFee : "",
    lastLegShippingFee: hasSplitFields ? row.lastLegShippingFee : "",
    overseasWarehouseFee: hasSplitFields ? row.overseasWarehouseFee : "",
    costPrice: hasSplitFields ? row.costPrice || computed.totalCostPrice : row.costPrice,
    salePrice: row.salePrice,
    weight: row.weight,
    mainSellingPoints: row.mainSellingPoints,
    coreSellingPoint: row.coreSellingPoint,
    targetAudience: row.targetAudience,
    existingEnglishTitle: row.existingEnglishTitle,
    optimizedEnglishTitle: row.optimizedEnglishTitle,
    optimizedMainImageUrl: row.optimizedMainImageUrl,
    note: row.note,
    images: parseImageUrls(row.imageUrlsJson),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match) {
    throw new Error("图片格式无法识别，请重新上传");
  }

  const mimeType = match[1] || "application/octet-stream";
  const base64 = match[2] || "";
  const extension = mimeType.split("/")[1] || "bin";
  return {
    mimeType,
    buffer: Buffer.from(base64, "base64"),
    extension,
  };
}

async function normalizeIncomingImages(images: string[], recordId: string) {
  const uploaded = await Promise.all(
    images.map(async (image, index) => {
      if (/^https?:\/\//.test(image)) {
        return image;
      }

      if (!image.startsWith("data:")) {
        throw new Error("图片内容无效，请重新上传图片");
      }

      const parsed = parseDataUrl(image);
      const { url } = await storagePut(
        `product-records/${recordId}/image-${index + 1}.${parsed.extension}`,
        parsed.buffer,
        parsed.mimeType,
      );
      return url;
    }),
  );

  return uploaded;
}

async function buildRecordValues(
  input: ProductRecordInput,
  images: string[],
  id: string,
  shopId: string,
): Promise<InsertProductRecordRow> {
  const purchaseUnitPrice = (input.purchaseUnitPrice ?? input.costPrice ?? "").trim();
  const weight = (input.weight ?? "").trim();
  const rules = await getShopCostRules(shopId);
  const costFields = buildProductCostFields(
    {
      purchaseUnitPrice,
      weight,
    },
    rules,
  );

  return {
    id,
    shopId,
    productName: input.productName.trim(),
    sourceCollectionUrl: input.sourceCollectionUrl.trim(),
    supplierUrl: input.supplierUrl.trim(),
    listingDate: input.listingDate,
    purchaseUnitPrice: costFields.purchaseUnitPrice,
    firstLegShippingFee: costFields.firstLegShippingFee,
    lastLegShippingFee: costFields.lastLegShippingFee,
    overseasWarehouseFee: costFields.overseasWarehouseFee,
    costPrice: costFields.totalCostPrice,
    salePrice: (input.salePrice ?? "").trim(),
    weight,
    mainSellingPoints: (input.mainSellingPoints ?? "").trim(),
    coreSellingPoint: (input.coreSellingPoint ?? "").trim(),
    targetAudience: (input.targetAudience ?? "").trim(),
    existingEnglishTitle: (input.existingEnglishTitle ?? "").trim(),
    optimizedEnglishTitle: (input.optimizedEnglishTitle ?? "").trim(),
    optimizedMainImageUrl: (input.optimizedMainImageUrl ?? "").trim(),
    note: (input.note ?? "").trim(),
    imageUrlsJson: JSON.stringify(images.slice(0, 4)),
  };
}

export async function listProductRecords(shopId: string) {
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
    .from(productRecords)
    .where(eq(productRecords.shopId, sid))
    .orderBy(desc(productRecords.listingDate), desc(productRecords.createdAt));
  return rows.map(toSerializableRecord);
}

export async function getProductRecordById(id: string): Promise<ProductRecord | undefined> {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const row = await db.select().from(productRecords).where(eq(productRecords.id, id)).limit(1);
  return row[0] ? toSerializableRecord(row[0]) : undefined;
}

export async function createProductRecord(input: ProductRecordInput) {
  const db = await getDb();
  if (!db) {
    throw new Error("数据库当前不可用，请稍后再试");
  }

  const shopId = input.shopId?.trim() ?? "";
  if (!shopId) {
    throw new Error("请选择店铺");
  }

  const id = crypto.randomUUID();
  const uploadedImages = await normalizeIncomingImages(input.images ?? [], id);
  const values = await buildRecordValues(input, uploadedImages, id, shopId);

  await db.insert(productRecords).values(values);

  const row = await db.select().from(productRecords).where(eq(productRecords.id, id)).limit(1);
  if (!row[0]) {
    throw new Error("记录保存成功，但读取失败");
  }

  return toSerializableRecord(row[0]);
}

export async function updateProductRecord(id: string, input: ProductRecordInput) {
  const db = await getDb();
  if (!db) {
    throw new Error("数据库当前不可用，请稍后再试");
  }

  const existingRows = await db.select().from(productRecords).where(eq(productRecords.id, id)).limit(1);
  const existing = existingRows[0];

  if (!existing) {
    throw new Error("要编辑的记录不存在或已被删除");
  }

  const uploadedImages = await normalizeIncomingImages(input.images ?? [], id);
  const values = await buildRecordValues(input, uploadedImages, id, existing.shopId);

  await db.update(productRecords).set(values).where(eq(productRecords.id, id));

  const row = await db.select().from(productRecords).where(eq(productRecords.id, id)).limit(1);
  if (!row[0]) {
    throw new Error("记录更新成功，但读取失败");
  }

  return toSerializableRecord(row[0]);
}

export async function deleteProductRecord(id: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("数据库当前不可用，请稍后再试");
  }

  const existingRows = await db.select().from(productRecords).where(eq(productRecords.id, id)).limit(1);
  if (!existingRows[0]) {
    return { success: true } as const;
  }

  await db.delete(productRecords).where(eq(productRecords.id, id));
  return { success: true } as const;
}
