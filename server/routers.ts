import { z } from "zod";
import { COOKIE_NAME } from "../shared/const";
import { buildTemuEnglishTitlePrompt, buildTemuMainImagePrompt } from "../shared/productAi";
import { createProductRecord, deleteProductRecord, listProductRecords, updateProductRecord } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";
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

const titleOptimizationInputSchema = z.object({
  productName: z.string().min(1, "请先填写产品名称"),
  mainSellingPoints: z.string().min(1, "请补充主要卖点"),
  existingEnglishTitle: z.string().optional().default(""),
});

const imageOptimizationInputSchema = z.object({
  productName: z.string().min(1, "请先填写产品名称"),
  coreSellingPoint: z.string().min(1, "请补充核心卖点"),
  targetAudience: z.string().min(1, "请补充目标人群"),
  sourceImage: z.string().min(1, "请先上传至少一张商品图片"),
});

function sanitizeOptimizedTitle(raw: string) {
  return raw
    .replace(/^[\s"'“”]+|[\s"'“”]+$/g, "")
    .replace(/,+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 255);
}

function buildImageSourcePayload(sourceImage: string) {
  if (sourceImage.startsWith("data:")) {
    const match = sourceImage.match(/^data:(.+?);base64,(.+)$/);
    if (!match) {
      throw new Error("图片内容无法识别，请重新上传后再试");
    }

    return {
      b64Json: match[2],
      mimeType: match[1],
    };
  }

  return {
    url: sourceImage,
    mimeType: "image/png",
  };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
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
    optimizeEnglishTitle: protectedProcedure.input(titleOptimizationInputSchema).mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          {
            role: "user",
            content: buildTemuEnglishTitlePrompt(input),
          },
        ],
        max_tokens: 180,
      });

      const content = response.choices[0]?.message.content;
      const text = typeof content === "string" ? content : "";
      const title = sanitizeOptimizedTitle(text);

      if (!title) {
        throw new Error("英文标题生成失败，请稍后重试");
      }

      return { title };
    }),
    optimizeMainImage: protectedProcedure.input(imageOptimizationInputSchema).mutation(async ({ input }) => {
      const result = await generateImage({
        prompt: buildTemuMainImagePrompt(input),
        originalImages: [buildImageSourcePayload(input.sourceImage)],
      });

      if (!result.url) {
        throw new Error("主图优化失败，请稍后重试");
      }

      return { imageUrl: result.url };
    }),
  }),
});

export type AppRouter = typeof appRouter;
