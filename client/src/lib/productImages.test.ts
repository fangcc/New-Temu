import { describe, expect, it } from "vitest";
import {
  AGGRESSIVE_MAX_EDGE,
  AGGRESSIVE_TARGET_QUALITY,
  DEFAULT_MAX_EDGE,
  DEFAULT_TARGET_QUALITY,
  buildCompressionPlan,
  formatBytes,
  getDataUrlByteSize,
  getScaledDimensions,
} from "./productImages";

describe("productImages helpers", () => {
  it("按比例缩放超大图片尺寸", () => {
    expect(getScaledDimensions(3200, 1600, 1600)).toEqual({ width: 1600, height: 800 });
    expect(getScaledDimensions(900, 1800, 1200)).toEqual({ width: 600, height: 1200 });
  });

  it("保留无需缩放的原始尺寸", () => {
    expect(getScaledDimensions(1200, 800, 1600)).toEqual({ width: 1200, height: 800 });
  });

  it("根据体积和边长选择常规或更激进的压缩策略", () => {
    expect(buildCompressionPlan(1200, 900, 300 * 1024)).toEqual({
      maxEdge: DEFAULT_MAX_EDGE,
      quality: DEFAULT_TARGET_QUALITY,
      shouldCompress: false,
    });

    expect(buildCompressionPlan(1800, 1400, 900 * 1024)).toEqual({
      maxEdge: DEFAULT_MAX_EDGE,
      quality: DEFAULT_TARGET_QUALITY,
      shouldCompress: true,
    });

    expect(buildCompressionPlan(2600, 1800, 3 * 1024 * 1024)).toEqual({
      maxEdge: AGGRESSIVE_MAX_EDGE,
      quality: AGGRESSIVE_TARGET_QUALITY,
      shouldCompress: true,
    });
  });

  it("能从 data url 估算原始字节数", () => {
    expect(getDataUrlByteSize("data:text/plain;base64,SGVsbG8=")).toBe(5);
  });

  it("将字节数格式化为更易读的文本", () => {
    expect(formatBytes(0)).toBe("0 KB");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(2.5 * 1024 * 1024)).toBe("2.50 MB");
  });
});
