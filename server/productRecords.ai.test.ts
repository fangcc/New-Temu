import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const { invokeLLMMock, generateImageMock } = vi.hoisted(() => ({
  invokeLLMMock: vi.fn(),
  generateImageMock: vi.fn(),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: invokeLLMMock,
}));

vi.mock("./_core/imageGeneration", () => ({
  generateImage: generateImageMock,
}));

import { appRouter } from "./routers";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("productRecords AI procedures", () => {
  beforeEach(() => {
    invokeLLMMock.mockReset();
    generateImageMock.mockReset();
  });

  it("returns a sanitized Temu English title", async () => {
    invokeLLMMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: '  "Foldable Laundry Basket with Handles Space Saving Storage Bin for Bedroom Bathroom"  ',
          },
        },
      ],
    });

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.productRecords.optimizeEnglishTitle({
      productName: "Laundry Basket",
      mainSellingPoints: "Foldable space saving built-in handles",
      existingEnglishTitle: "laundry basket",
    });

    expect(invokeLLMMock).toHaveBeenCalledTimes(1);
    expect(result.title).toBe("Foldable Laundry Basket with Handles Space Saving Storage Bin for Bedroom Bathroom");
    expect(result.title).not.toContain(",");
  });

  it("passes the source image and prompt into the image generation service", async () => {
    generateImageMock.mockResolvedValue({
      url: "https://cdn.example/temu-main-image.png",
    });

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.productRecords.optimizeMainImage({
      productName: "Kitchen Sink Caddy",
      coreSellingPoint: "Keeps the countertop dry and organized",
      targetAudience: "US apartment renters",
      sourceImage: "data:image/png;base64,QUJDREVGRw==",
    });

    expect(generateImageMock).toHaveBeenCalledTimes(1);
    expect(generateImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("商品名称：Kitchen Sink Caddy"),
        originalImages: [
          expect.objectContaining({
            mimeType: "image/png",
            b64Json: "QUJDREVGRw==",
          }),
        ],
      }),
    );
    expect(result).toEqual({ imageUrl: "https://cdn.example/temu-main-image.png" });
  });
});
