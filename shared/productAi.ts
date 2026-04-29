export type ProductAiTextInput = {
  productName: string;
  mainSellingPoints?: string;
  existingEnglishTitle?: string;
};

export type ProductAiImageInput = {
  productName: string;
  coreSellingPoint?: string;
  targetAudience?: string;
};

export type ProductExportRecord = {
  recordCode: string;
  listingDate: string;
  productName: string;
  sourceCollectionUrl: string;
  supplierUrl: string;
  purchaseUnitPrice: string;
  firstLegShippingFee: string;
  lastLegShippingFee: string;
  overseasWarehouseFee: string;
  costPrice: string;
  salePrice: string;
  weight: string;
  mainSellingPoints: string;
  coreSellingPoint: string;
  targetAudience: string;
  existingEnglishTitle: string;
  optimizedEnglishTitle: string;
  originalImageUrl: string;
  optimizedMainImageUrl: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export const PRODUCT_EXPORT_COLUMNS: Array<{ key: keyof ProductExportRecord; label: string }> = [
  { key: "recordCode", label: "记录编号" },
  { key: "listingDate", label: "上新日期" },
  { key: "productName", label: "产品名称" },
  { key: "sourceCollectionUrl", label: "源采集平台链接" },
  { key: "supplierUrl", label: "货源平台链接" },
  { key: "purchaseUnitPrice", label: "商品采购单价（元）" },
  { key: "firstLegShippingFee", label: "头程重量运费（元）" },
  { key: "lastLegShippingFee", label: "尾程重量运费（元）" },
  { key: "overseasWarehouseFee", label: "海外仓操作费（元）" },
  { key: "costPrice", label: "总成本（元）" },
  { key: "salePrice", label: "售价（元）" },
  { key: "weight", label: "重量（g）" },
  { key: "mainSellingPoints", label: "主要卖点" },
  { key: "coreSellingPoint", label: "核心卖点" },
  { key: "targetAudience", label: "目标人群" },
  { key: "existingEnglishTitle", label: "现有英文标题" },
  { key: "optimizedEnglishTitle", label: "AI 优化英文标题" },
  { key: "originalImageUrl", label: "原始主图链接" },
  { key: "optimizedMainImageUrl", label: "AI 优化主图链接" },
  { key: "note", label: "备注" },
  { key: "createdAt", label: "创建时间" },
  { key: "updatedAt", label: "更新时间" },
];

function normalizePromptLine(label: string, value: string | undefined) {
  const normalized = (value ?? "").trim();
  return `${label}：${normalized || "未提供"}`;
}

export function buildTemuEnglishTitlePrompt(input: ProductAiTextInput) {
  return [
    "你是一名熟悉美国市场、Temu平台规则和货架电商SEO逻辑的电商文案优化专家。",
    "",
    "我是一名中国跨境电商商家，主要经营 Temu 美国站。现在我要销售一款商品。",
    "",
    normalizePromptLine("商品名称", input.productName),
    normalizePromptLine("主要卖点", input.mainSellingPoints),
    normalizePromptLine("现有标题", input.existingEnglishTitle),
    "",
    "请你基于以上信息，帮我优化生成一个更适合 Temu 美国站的英文商品标题。",
    "",
    "要求如下：",
    "1. 标题要符合美国消费者的搜索习惯和货架电商SEO流量逻辑。",
    "2. 优先突出核心关键词、高频搜索词和高转化卖点。",
    "3. 标题语句必须自然通顺，符合美国本土表达习惯。",
    "4. 标题中不要使用逗号。",
    "5. 标题总长度不要超过255个字符。",
    "6. 不要堆砌关键词，不要出现明显重复词。",
    "7. 输出1个最终优化标题即可，不需要解释。",
  ].join("\n");
}

export function buildTemuMainImagePrompt(input: ProductAiImageInput) {
  return [
    "你是一名熟悉美国市场审美、Temu平台展示逻辑和跨境电商点击率优化的商品视觉设计专家。",
    "",
    "我是一名做 Temu 美国站的中国跨境电商商家。现在我会上传一张商品原图，请你帮我把它优化成更适合 Temu 平台的主图。",
    "",
    normalizePromptLine("商品名称", input.productName),
    normalizePromptLine("核心卖点", input.coreSellingPoint),
    normalizePromptLine("目标人群", input.targetAudience),
    "",
    "要求如下：",
    "1. 保留商品真实外观，不要改变商品颜色、结构、材质和核心形态。",
    "2. 主图要突出商品主体，构图清晰，视觉中心明确。",
    "3. 背景简洁干净，整体有美国市场偏好的高级感和购买感。",
    "4. 强调商品质感、轮廓、卖点和电商点击感。",
    "5. 不要做得太杂乱，不要有廉价感，不要像低质广告图。",
    "6. 输出效果要适合作为 Temu 商品首图使用。",
    "7. 如果原图存在角度不佳、光线不足、背景杂乱等问题，请一并优化。",
  ].join("\n");
}

export function buildProductExportRows(records: ProductExportRecord[]) {
  return records.map((record) => {
    const row: Record<string, string> = {};
    PRODUCT_EXPORT_COLUMNS.forEach((column) => {
      row[column.label] = record[column.key] ?? "";
    });
    return row;
  });
}
