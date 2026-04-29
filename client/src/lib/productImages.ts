export const MAX_PRODUCT_IMAGE_COUNT = 4;
export const DEFAULT_MAX_EDGE = 1600;
export const DEFAULT_TARGET_QUALITY = 0.78;
export const AGGRESSIVE_MAX_EDGE = 1280;
export const AGGRESSIVE_TARGET_QUALITY = 0.72;

export type CompressionPlan = {
  maxEdge: number;
  quality: number;
  shouldCompress: boolean;
};

export type OptimizedImageResult = {
  dataUrl: string;
  originalBytes: number;
  finalBytes: number;
  width: number;
  height: number;
  optimizedWidth: number;
  optimizedHeight: number;
  wasCompressed: boolean;
};

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function getDataUrlByteSize(dataUrl: string) {
  const [, base64 = ""] = dataUrl.split(",");
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function getScaledDimensions(width: number, height: number, maxEdge: number) {
  if (width <= 0 || height <= 0) {
    return { width: maxEdge, height: maxEdge };
  }

  const longestEdge = Math.max(width, height);
  if (longestEdge <= maxEdge) {
    return { width, height };
  }

  const scale = maxEdge / longestEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function buildCompressionPlan(width: number, height: number, originalBytes: number): CompressionPlan {
  const longestEdge = Math.max(width, height);
  const needsAggressiveCompression = originalBytes > 2 * 1024 * 1024 || longestEdge > 2200;
  const shouldCompress = originalBytes > 450 * 1024 || longestEdge > DEFAULT_MAX_EDGE;

  return {
    maxEdge: needsAggressiveCompression ? AGGRESSIVE_MAX_EDGE : DEFAULT_MAX_EDGE,
    quality: needsAggressiveCompression ? AGGRESSIVE_TARGET_QUALITY : DEFAULT_TARGET_QUALITY,
    shouldCompress,
  };
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`读取图片失败：${file.name}`));
    reader.readAsDataURL(file);
  });
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`加载图片失败：${file.name}`));
    };
    image.src = objectUrl;
  });
}

function canvasToDataUrl(canvas: HTMLCanvasElement, type: string, quality: number) {
  return canvas.toDataURL(type, quality);
}

export async function optimizeImageFile(file: File): Promise<OptimizedImageResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("仅支持上传图片文件");
  }

  if (file.type === "image/gif" || file.type === "image/svg+xml") {
    const originalDataUrl = await readFileAsDataUrl(file);
    const originalBytes = getDataUrlByteSize(originalDataUrl);

    return {
      dataUrl: originalDataUrl,
      originalBytes,
      finalBytes: originalBytes,
      width: 0,
      height: 0,
      optimizedWidth: 0,
      optimizedHeight: 0,
      wasCompressed: false,
    };
  }

  const [originalDataUrl, image] = await Promise.all([readFileAsDataUrl(file), loadImageFromFile(file)]);
  const originalBytes = getDataUrlByteSize(originalDataUrl);
  const plan = buildCompressionPlan(image.naturalWidth, image.naturalHeight, originalBytes);

  if (!plan.shouldCompress) {
    return {
      dataUrl: originalDataUrl,
      originalBytes,
      finalBytes: originalBytes,
      width: image.naturalWidth,
      height: image.naturalHeight,
      optimizedWidth: image.naturalWidth,
      optimizedHeight: image.naturalHeight,
      wasCompressed: false,
    };
  }

  const dimensions = getScaledDimensions(image.naturalWidth, image.naturalHeight, plan.maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("浏览器当前无法处理图片，请稍后重试");
  }

  context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
  const compressedDataUrl = canvasToDataUrl(canvas, "image/webp", plan.quality);
  const compressedBytes = getDataUrlByteSize(compressedDataUrl);

  if (compressedBytes >= originalBytes * 0.95) {
    return {
      dataUrl: originalDataUrl,
      originalBytes,
      finalBytes: originalBytes,
      width: image.naturalWidth,
      height: image.naturalHeight,
      optimizedWidth: image.naturalWidth,
      optimizedHeight: image.naturalHeight,
      wasCompressed: false,
    };
  }

  return {
    dataUrl: compressedDataUrl,
    originalBytes,
    finalBytes: compressedBytes,
    width: image.naturalWidth,
    height: image.naturalHeight,
    optimizedWidth: dimensions.width,
    optimizedHeight: dimensions.height,
    wasCompressed: true,
  };
}
