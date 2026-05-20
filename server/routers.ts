import { z } from "zod";
import { createProductRecord, deleteProductRecord, listProductRecords, updateProductRecord } from "./db";
import {
  bulkImportLiveListings,
  createLiveListing,
  deleteLiveListing,
  listLiveListings,
  updateLiveListing,
  upsertLiveListingFromProductRecord,
} from "./liveListingsDb";
import { createShop, getShopCostRules, listShops, shopCostRulesInputSchema, updateShopCostRules } from "./shopsDb";
import { clearAuthCookies } from "./_core/authCookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const shopIdSchema = z.object({
  shopId: z.string().min(1, "请选择店铺"),
});

const productRecordInputSchema = z.object({
  productName: z.string().min(1, "请先填写产品名称"),
  sourceCollectionUrl: z.string().min(1, "请补充源采集平台链接"),
  supplierUrl: z.string().min(1, "请补充货源平台链接"),
  listingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "请选择有效的上新日期"),
  purchaseUnitPrice: z.string().optional().default(""),
  costPrice: z.string().optional().default(""),
  salePrice: z.string().optional().default(""),
  weight: z.string().optional().default(""),
  cargoType: z.enum(["general", "special"]).optional().default("general"),
  mainSellingPoints: z.string().optional().default(""),
  coreSellingPoint: z.string().optional().default(""),
  targetAudience: z.string().optional().default(""),
  existingEnglishTitle: z.string().optional().default(""),
  optimizedEnglishTitle: z.string().optional().default(""),
  optimizedMainImageUrl: z.string().optional().default(""),
  note: z.string().optional().default(""),
  images: z.array(z.string()).max(4, "最多上传 4 张图片").optional().default([]),
});

const productRecordCreateSchema = productRecordInputSchema.extend({
  shopId: z.string().min(1, "请选择店铺"),
});

const liveListingRowSchema = z.object({
  spuId: z.string().min(1, "请填写 SPU"),
  productName: z.string().min(1, "请填写产品名称"),
  supplier1688Url: z.string().optional().default(""),
  weight: z.string().optional().default(""),
  purchaseUnitPrice: z.string().optional().default(""),
  firstLegShippingFee: z.string().optional().default(""),
  lastLegShippingFee: z.string().optional().default(""),
  overseasWarehouseFee: z.string().optional().default(""),
  declaredPrice: z.string().optional().default(""),
  subsidySellingPrice: z.string().optional().default(""),
  sourceProductRecordId: z.string().optional().default(""),
  note: z.string().optional().default(""),
});

const liveListingInputSchema = liveListingRowSchema.extend({
  shopId: z.string().min(1, "请选择店铺"),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      clearAuthCookies(ctx.req, ctx.res);
      return { success: true } as const;
    }),
  }),
  shops: router({
    list: protectedProcedure.query(async () => listShops()),
    create: protectedProcedure
      .input(z.object({ name: z.string().min(1, "请填写店铺名称").max(128) }))
      .mutation(async ({ input }) => createShop(input.name)),
    getCostRules: protectedProcedure.input(shopIdSchema).query(async ({ input }) => getShopCostRules(input.shopId)),
    updateCostRules: protectedProcedure
      .input(z.object({ shopId: z.string().min(1), rules: shopCostRulesInputSchema }))
      .mutation(async ({ input }) => updateShopCostRules(input.shopId, input.rules)),
  }),
  productRecords: router({
    list: protectedProcedure.input(shopIdSchema).query(async ({ input }) => listProductRecords(input.shopId)),
    create: protectedProcedure.input(productRecordCreateSchema).mutation(async ({ input }) => {
      const { shopId, ...rest } = input;
      return createProductRecord({ ...rest, shopId });
    }),
    update: protectedProcedure
      .input(
        z.object({
          id: z.string().min(1, "缺少记录 ID"),
          data: productRecordInputSchema,
        }),
      )
      .mutation(async ({ input }) => updateProductRecord(input.id, input.data)),
    delete: protectedProcedure
      .input(z.object({ id: z.string().min(1, "缺少记录 ID") }))
      .mutation(async ({ input }) => deleteProductRecord(input.id)),
  }),
  liveListings: router({
    list: protectedProcedure.input(shopIdSchema).query(async ({ input }) => listLiveListings(input.shopId)),
    create: protectedProcedure.input(liveListingInputSchema).mutation(async ({ input }) => createLiveListing(input)),
    update: protectedProcedure
      .input(
        z.object({
          id: z.string().min(1, "缺少记录 ID"),
          data: liveListingInputSchema,
        }),
      )
      .mutation(async ({ input }) => updateLiveListing(input.id, input.data)),
    delete: protectedProcedure
      .input(z.object({ id: z.string().min(1, "缺少记录 ID") }))
      .mutation(async ({ input }) => deleteLiveListing(input.id)),
    bulkImport: protectedProcedure
      .input(
        z.object({
          shopId: z.string().min(1, "请选择店铺"),
          rows: z.array(liveListingRowSchema).max(5000),
        }),
      )
      .mutation(async ({ input }) => bulkImportLiveListings(input.shopId, input.rows)),
    syncFromProductRecord: protectedProcedure
      .input(
        z.object({
          productRecordId: z.string().min(1, "缺少上新记录 ID"),
          spuId: z.string().min(1, "请填写 SPU"),
          declaredPrice: z.string().optional().default(""),
          subsidySellingPrice: z.string().optional().default(""),
        }),
      )
      .mutation(async ({ input }) => upsertLiveListingFromProductRecord(input)),
  }),
});

export type AppRouter = typeof appRouter;
