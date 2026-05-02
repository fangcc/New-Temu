import { z } from "zod";
import { createProductRecord, deleteProductRecord, listProductRecords, updateProductRecord } from "./db";
import { clearAuthCookies } from "./_core/authCookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const productRecordInputSchema = z.object({
  productName: z.string().min(1, "请先填写产品名称"),
  sourceCollectionUrl: z.string().min(1, "请补充源采集平台链接"),
  supplierUrl: z.string().min(1, "请补充货源平台链接"),
  listingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "请选择有效的上新日期"),
  purchaseUnitPrice: z.string().optional().default(""),
  costPrice: z.string().optional().default(""),
  salePrice: z.string().optional().default(""),
  weight: z.string().optional().default(""),
  mainSellingPoints: z.string().optional().default(""),
  coreSellingPoint: z.string().optional().default(""),
  targetAudience: z.string().optional().default(""),
  existingEnglishTitle: z.string().optional().default(""),
  optimizedEnglishTitle: z.string().optional().default(""),
  optimizedMainImageUrl: z.string().optional().default(""),
  note: z.string().optional().default(""),
  images: z.array(z.string()).max(4, "最多上传 4 张图片").optional().default([]),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      clearAuthCookies(ctx.req, ctx.res);
      return {
        success: true,
      } as const;
    }),
  }),
  productRecords: router({
    list: protectedProcedure.query(async () => {
      return listProductRecords();
    }),
    create: protectedProcedure.input(productRecordInputSchema).mutation(async ({ input }) => {
      return createProductRecord(input);
    }),
    update: protectedProcedure
      .input(
        z.object({
          id: z.string().min(1, "缺少记录 ID"),
          data: productRecordInputSchema,
        }),
      )
      .mutation(async ({ input }) => {
        return updateProductRecord(input.id, input.data);
      }),
    delete: protectedProcedure
      .input(
        z.object({
          id: z.string().min(1, "缺少记录 ID"),
        }),
      )
      .mutation(async ({ input }) => {
        return deleteProductRecord(input.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;
