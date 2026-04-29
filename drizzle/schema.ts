import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const productRecords = mysqlTable("product_records", {
  id: varchar("id", { length: 64 }).primaryKey(),
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
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ProductRecordRow = typeof productRecords.$inferSelect;
export type InsertProductRecordRow = typeof productRecords.$inferInsert;
