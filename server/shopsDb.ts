import crypto from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { shops } from "../drizzle/schema";
import { getDb } from "./db";

export type Shop = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

function toSerializable(row: typeof shops.$inferSelect): Shop {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listShops(): Promise<Shop[]> {
  const db = await getDb();
  if (!db) {
    throw new Error("数据库当前不可用，请稍后再试");
  }
  const rows = await db.select().from(shops).orderBy(desc(shops.createdAt));
  return rows.map(toSerializable);
}

export async function createShop(name: string): Promise<Shop> {
  const db = await getDb();
  if (!db) {
    throw new Error("数据库当前不可用，请稍后再试");
  }
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("请填写店铺名称");
  }
  const id = crypto.randomUUID();
  await db.insert(shops).values({ id, name: trimmed });
  const row = await db.select().from(shops).where(eq(shops.id, id)).limit(1);
  if (!row[0]) {
    throw new Error("店铺创建成功但读取失败");
  }
  return toSerializable(row[0]);
}
