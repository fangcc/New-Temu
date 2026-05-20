import crypto from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { shops } from "../drizzle/schema";
import {
  cloneRulesConfig,
  DEFAULT_SHOP_COST_RULES_CONFIG,
  parseShopCostRules,
  serializeShopCostRules,
  type ShopCostRulesConfig,
} from "../shared/shopCostRules";
import { getDb } from "./db";

export type Shop = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

const lastLegTierSchema = z.object({
  minGrams: z.number().finite().min(0),
  maxGrams: z.number().finite().min(0),
  fee: z.number().finite().min(0),
});

const shopCostRuleSetSchema = z.object({
  firstLeg: z.object({
    type: z.literal("per_kg"),
    ratePerKg: z.number().finite().positive("头程单价须大于 0"),
  }),
  lastLeg: z.object({
    type: z.literal("weight_tiers"),
    tiers: z.array(lastLegTierSchema).min(1, "至少保留一个尾程重量区间"),
  }),
  overseas: z.object({
    type: z.literal("fixed"),
    amount: z.number().finite().min(0, "海外仓费用不能为负"),
  }),
});

export const shopCostRulesInputSchema = z.object({
  general: shopCostRuleSetSchema,
  special: shopCostRuleSetSchema,
});

function validateTierRanges(config: ShopCostRulesConfig) {
  for (const label of ["普货", "特货"] as const) {
    const key = label === "普货" ? "general" : "special";
    for (const tier of config[key].lastLeg.tiers) {
      if (tier.minGrams > tier.maxGrams) {
        throw new Error(`${label}尾程区间 ${tier.minGrams}–${tier.maxGrams}g 无效：最小重量不能大于最大重量`);
      }
    }
  }
}

export async function getShopCostRules(shopId: string): Promise<ShopCostRulesConfig> {
  const db = await getDb();
  if (!db) {
    return cloneRulesConfig(DEFAULT_SHOP_COST_RULES_CONFIG);
  }
  const row = await db.select({ costRulesJson: shops.costRulesJson }).from(shops).where(eq(shops.id, shopId)).limit(1);
  return parseShopCostRules(row[0]?.costRulesJson ?? null);
}

export async function updateShopCostRules(shopId: string, rules: ShopCostRulesConfig): Promise<ShopCostRulesConfig> {
  const db = await getDb();
  if (!db) {
    throw new Error("数据库当前不可用，请稍后再试");
  }
  const parsed = shopCostRulesInputSchema.safeParse(rules);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "运费规则无效");
  }
  validateTierRanges(parsed.data);

  await db
    .update(shops)
    .set({ costRulesJson: serializeShopCostRules(parsed.data) })
    .where(eq(shops.id, shopId));

  return parsed.data;
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
  await db.insert(shops).values({ id, name: trimmed, costRulesJson: null });
  const row = await db.select().from(shops).where(eq(shops.id, id)).limit(1);
  if (!row[0]) {
    throw new Error("店铺创建成功但读取失败");
  }
  return toSerializable(row[0]);
}

function toSerializable(row: typeof shops.$inferSelect): Shop {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
