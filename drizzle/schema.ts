import { index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/** 店铺：上新与在售数据按店铺隔离。 */
export const shops = mysqlTable("shops", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  /** JSON：按店铺的头程/尾程/海外仓核算规则，见 shared/shopCostRules.ts */
  costRulesJson: text("costRulesJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const productRecords = mysqlTable(
  "product_records",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    shopId: varchar("shopId", { length: 64 }).notNull().default("default-shop"),
    /** general=普货，special=特货；决定套用 shops.costRulesJson 中哪套运费公式 */
    cargoType: varchar("cargoType", { length: 16 }).notNull().default("general"),
    productName: varchar("productName", { length: 255 }).notNull(),
    sourceCollectionUrl: text("sourceCollectionUrl").notNull(),
    supplierUrl: text("supplierUrl").notNull(),
    listingDate: varchar("listingDate", { length: 10 }).notNull(),
    purchaseUnitPrice: varchar("purchaseUnitPrice", { length: 32 }).default("").notNull(),
    firstLegShippingFee: varchar("firstLegShippingFee", { length: 32 }).default("").notNull(),
    lastLegShippingFee: varchar("lastLegShippingFee", { length: 32 }).default("").notNull(),
    overseasWarehouseFee: varchar("overseasWarehouseFee", { length: 32 }).default("").notNull(),
    costPrice: varchar("costPrice", { length: 32 }).default("").notNull(),
    salePrice: varchar("salePrice", { length: 32 }).default("").notNull(),
    weight: varchar("weight", { length: 32 }).default("").notNull(),
    mainSellingPoints: text("mainSellingPoints").notNull(),
    coreSellingPoint: text("coreSellingPoint").notNull(),
    targetAudience: text("targetAudience").notNull(),
    existingEnglishTitle: varchar("existingEnglishTitle", { length: 255 }).default("").notNull(),
    optimizedEnglishTitle: varchar("optimizedEnglishTitle", { length: 255 }).default("").notNull(),
    optimizedMainImageUrl: text("optimizedMainImageUrl").notNull(),
    note: text("note").notNull(),
    imageUrlsJson: text("imageUrlsJson").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    shopIdx: index("product_records_shop_idx").on(table.shopId),
  }),
);

/** 已通过核价、按店铺 + SPU 唯一管理的在售台账。 */
export const liveProductListings = mysqlTable(
  "live_product_listings",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    shopId: varchar("shopId", { length: 64 }).notNull().default("default-shop"),
    spuId: varchar("spuId", { length: 64 }).notNull(),
    productName: varchar("productName", { length: 255 }).notNull(),
    supplier1688Url: text("supplier1688Url").notNull(),
    weight: varchar("weight", { length: 32 }).default("").notNull(),
    purchaseUnitPrice: varchar("purchaseUnitPrice", { length: 32 }).default("").notNull(),
    firstLegShippingFee: varchar("firstLegShippingFee", { length: 32 }).default("").notNull(),
    lastLegShippingFee: varchar("lastLegShippingFee", { length: 32 }).default("").notNull(),
    overseasWarehouseFee: varchar("overseasWarehouseFee", { length: 32 }).default("").notNull(),
    declaredPrice: varchar("declaredPrice", { length: 32 }).default("").notNull(),
    subsidySellingPrice: varchar("subsidySellingPrice", { length: 32 }).default("").notNull(),
    totalCost: varchar("totalCost", { length: 32 }).default("").notNull(),
    grossProfit: varchar("grossProfit", { length: 32 }).default("").notNull(),
    profitMarginPercent: varchar("profitMarginPercent", { length: 32 }).default("").notNull(),
    sourceProductRecordId: varchar("sourceProductRecordId", { length: 64 }).default("").notNull(),
    note: text("note").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    shopSpuUnique: uniqueIndex("live_product_listings_shop_spu_unique").on(table.shopId, table.spuId),
  }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ProductRecordRow = typeof productRecords.$inferSelect;
export type InsertProductRecordRow = typeof productRecords.$inferInsert;
export type ShopRow = typeof shops.$inferSelect;
export type InsertShopRow = typeof shops.$inferInsert;
export type LiveProductListingRow = typeof liveProductListings.$inferSelect;
export type InsertLiveProductListingRow = typeof liveProductListings.$inferInsert;
