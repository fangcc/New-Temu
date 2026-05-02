/*
Design reminder for this file:
- 设计哲学：现代编辑式办公系统（Modern Editorial Workspace）
- 关键词：克制、清晰、低刺激、重层级、重效率
- 颜色：米白 / 石墨灰 / 鼠尾草绿 / 少量黄铜棕
- 版式：左侧工具导航 + 右侧工作台，避免大面积居中堆叠
- 交互：轻微动效、清晰反馈、表单优先，绝不花哨
*/
import { Fragment, useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import {
  CalendarRange,
  ChevronDown,
  ChevronRight,
  Cloud,
  Download,
  ExternalLink,
  Filter,
  ImagePlus,
  Loader2,
  Maximize2,
  PackagePlus,
  Pencil,
  Search,
  Store,
  StickyNote,
  Trash2,
  Weight,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MAX_PRODUCT_IMAGE_COUNT,
  formatBytes,
  optimizeImageFile,
} from "@/lib/productImages";
import { exportProductRecordsToWorkbook } from "@/lib/productExport";
import { trpc } from "@/lib/trpc";
import {
  buildProductCostFields,
  getProductCostKeywordParts,
  PRODUCT_COST_CONSTANTS,
} from "@shared/productCosting";
import {
  buildRecordCodeMap,
  formatRecordCodeDate,
  getPageLabel,
  getRecordPaginationState,
  RECORDS_PER_PAGE,
  shouldRenderPaginationEllipsis,
} from "@shared/productRecords";
import type { ProductExportRecord } from "@shared/productAi";

type ProductRecord = {
  id: string;
  productName: string;
  sourceCollectionUrl: string;
  supplierUrl: string;
  listingDate: string;
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
  optimizedMainImageUrl: string;
  note: string;
  images: string[];
  createdAt: string;
  updatedAt: string;
};

type ProductForm = {
  productName: string;
  sourceCollectionUrl: string;
  supplierUrl: string;
  listingDate: string;
  purchaseUnitPrice: string;
  salePrice: string;
  weight: string;
  note: string;
  images: string[];
};

type PreviewImageState = {
  src: string;
  alt: string;
  caption: string;
};

function todayString() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

const initialForm: ProductForm = {
  productName: "",
  sourceCollectionUrl: "",
  supplierUrl: "",
  listingDate: todayString(),
  purchaseUnitPrice: "",
  salePrice: "",
  weight: "",
  note: "",
  images: [],
};

const heroImage =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663528256000/6j4npnrxFB9pPpHGYSCEhv/editorial-ops-hero-mdFpu3ZUSe3Aqt8QyXN6iD.webp";
const panelImage =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663528256000/6j4npnrxFB9pPpHGYSCEhv/product-card-showcase-2qQyvpbrWFoBsJH2gUKQmi.webp";
const textureImage =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663528256000/6j4npnrxFB9pPpHGYSCEhv/quiet-texture-panel-DKn8eXno33eaQgC8Gwsd6G.webp";

function currency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export default function Home() {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<ProductForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState("");
  const [keyword, setKeyword] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState("");
  const [previewImage, setPreviewImage] = useState<PreviewImageState | null>(null);

  const recordsQuery = trpc.productRecords.list.useQuery(undefined, {
    staleTime: 10_000,
  });

  const createMutation = trpc.productRecords.create.useMutation({
    onSuccess: async () => {
      await utils.productRecords.list.invalidate();
      toast.success("产品记录已保存到云端");
    },
    onError: (error) => {
      toast.error(error.message || "云端保存失败，请稍后再试");
    },
  });

  const updateMutation = trpc.productRecords.update.useMutation({
    onSuccess: async () => {
      await utils.productRecords.list.invalidate();
      toast.success("产品记录已更新到云端");
    },
    onError: (error) => {
      toast.error(error.message || "更新失败，请稍后再试");
    },
  });

  const deleteMutation = trpc.productRecords.delete.useMutation({
    onSuccess: async () => {
      await utils.productRecords.list.invalidate();
      toast.success("记录已删除");
    },
    onError: (error) => {
      toast.error(error.message || "删除失败，请稍后再试");
    },
  });

  useEffect(() => {
    if (recordsQuery.error) {
      toast.error(recordsQuery.error.message || "记录加载失败，请稍后刷新重试");
    }
  }, [recordsQuery.error]);

  const records = recordsQuery.data ?? [];
  const selectedRecordSet = new Set(selectedRecordIds);

  const filteredRecords = useMemo(() => {
    return records.filter((item) => {
      const matchesDate = dateFilter ? item.listingDate === dateFilter : true;
      const q = keyword.trim().toLowerCase();
      const matchesKeyword = q
        ? [
            item.productName,
            item.note,
            item.sourceCollectionUrl,
            item.supplierUrl,
            item.salePrice,
            item.weight,
            ...getProductCostKeywordParts({
              purchaseUnitPrice: item.purchaseUnitPrice,
              firstLegShippingFee: item.firstLegShippingFee,
              lastLegShippingFee: item.lastLegShippingFee,
              overseasWarehouseFee: item.overseasWarehouseFee,
              totalCostPrice: item.costPrice,
            }),
          ]
            .join(" ")
            .toLowerCase()
            .includes(q)
        : true;

      return matchesDate && matchesKeyword;
    });
  }, [records, dateFilter, keyword]);

  const paginationState = useMemo(
    () => getRecordPaginationState(filteredRecords, currentPage, RECORDS_PER_PAGE),
    [filteredRecords, currentPage],
  );
  const paginatedRecords = paginationState.pageItems;

  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, keyword]);

  useEffect(() => {
    if (paginationState.currentPage !== currentPage) {
      setCurrentPage(paginationState.currentPage);
    }
  }, [currentPage, paginationState.currentPage]);

  useEffect(() => {
    if (expandedRecordId && !paginatedRecords.some((item) => item.id === expandedRecordId)) {
      setExpandedRecordId(null);
    }
  }, [expandedRecordId, paginatedRecords]);

  const stats = useMemo(() => {
    const today = todayString();
    const todayCount = records.filter((item) => item.listingDate === today).length;
    const totalCost = filteredRecords.reduce((sum, item) => sum + Number(item.costPrice || 0), 0);
    const totalSale = filteredRecords.reduce((sum, item) => sum + Number(item.salePrice || 0), 0);
    const avgWeight =
      filteredRecords.length > 0
        ? filteredRecords.reduce((sum, item) => sum + Number(item.weight || 0), 0) / filteredRecords.length
        : 0;

    return {
      total: records.length,
      todayCount,
      totalCost,
      totalSale,
      avgWeight,
    };
  }, [records, filteredRecords]);

  const recordCodeMap = useMemo(() => buildRecordCodeMap(records), [records]);
  const costPreview = useMemo(
    () =>
      buildProductCostFields({
        purchaseUnitPrice: form.purchaseUnitPrice,
        weight: form.weight,
      }),
    [form.purchaseUnitPrice, form.weight],
  );
  const remainingImageSlots = Math.max(0, MAX_PRODUCT_IMAGE_COUNT - form.images.length);
  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isFormBusy = isSubmitting || isProcessingImages;

  const resetForm = () => {
    setForm({ ...initialForm, listingDate: todayString() });
    setEditingId(null);
    setUploadFeedback("");
  };

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).slice(0, remainingImageSlots);

    if (!files.length) {
      event.target.value = "";
      toast.error(`最多只能上传 ${MAX_PRODUCT_IMAGE_COUNT} 张图片`);
      return;
    }

    setIsProcessingImages(true);
    setUploadFeedback("正在整理图片，提交时会更快一些…");

    try {
      const optimizedImages: string[] = [];
      let optimizedCount = 0;
      let reducedBytes = 0;

      for (const file of files) {
        const result = await optimizeImageFile(file);
        optimizedImages.push(result.dataUrl);

        if (result.wasCompressed) {
          optimizedCount += 1;
          reducedBytes += Math.max(0, result.originalBytes - result.finalBytes);
        }
      }

      setForm((prev) => ({
        ...prev,
        images: [...prev.images, ...optimizedImages].slice(0, MAX_PRODUCT_IMAGE_COUNT),
      }));

      if (optimizedCount > 0) {
        setUploadFeedback(`已优化 ${optimizedCount} 张图片，预计减少约 ${formatBytes(reducedBytes)} 上传体积`);
      } else {
        setUploadFeedback(`已添加 ${optimizedImages.length} 张图片，可直接提交`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "图片处理失败，请重试";
      setUploadFeedback("");
      toast.error(message);
    } finally {
      setIsProcessingImages(false);
      event.target.value = "";
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isProcessingImages) {
      toast.error("图片仍在处理中，请稍候再提交");
      return;
    }

    if (!form.productName.trim()) {
      toast.error("请先填写产品名称");
      return;
    }
    if (!form.sourceCollectionUrl.trim() || !form.supplierUrl.trim()) {
      toast.error("请补充源采集平台链接与货源平台链接");
      return;
    }
    if (!form.listingDate) {
      toast.error("请选择上新日期");
      return;
    }

    const baseline = editingId ? records.find((item) => item.id === editingId) : undefined;

    const payload = {
      productName: form.productName.trim(),
      sourceCollectionUrl: form.sourceCollectionUrl.trim(),
      supplierUrl: form.supplierUrl.trim(),
      listingDate: form.listingDate,
      purchaseUnitPrice: form.purchaseUnitPrice.trim(),
      salePrice: form.salePrice.trim(),
      weight: form.weight.trim(),
      mainSellingPoints: baseline?.mainSellingPoints ?? "",
      coreSellingPoint: baseline?.coreSellingPoint ?? "",
      targetAudience: baseline?.targetAudience ?? "",
      existingEnglishTitle: baseline?.existingEnglishTitle ?? "",
      optimizedEnglishTitle: baseline?.optimizedEnglishTitle ?? "",
      optimizedMainImageUrl: baseline?.optimizedMainImageUrl ?? "",
      note: form.note.trim(),
      images: form.images,
    };

    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }

    resetForm();
  };

  const handleEdit = (record: ProductRecord) => {
    setEditingId(record.id);
    setExpandedRecordId(record.id);
    setForm({
      productName: record.productName,
      sourceCollectionUrl: record.sourceCollectionUrl,
      supplierUrl: record.supplierUrl,
      listingDate: record.listingDate,
      purchaseUnitPrice: record.purchaseUnitPrice,
      salePrice: record.salePrice,
      weight: record.weight,
      note: record.note,
      images: record.images,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync({ id });
    setSelectedRecordIds((prev) => prev.filter((item) => item !== id));
    if (editingId === id) resetForm();
    if (expandedRecordId === id) setExpandedRecordId(null);
  };

  const toggleRecordSelection = (id: string) => {
    setSelectedRecordIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const mapRecordToExportRow = (record: ProductRecord): ProductExportRecord => ({
    recordCode: recordCodeMap[record.id] ?? `${formatRecordCodeDate(record.listingDate)}-001`,
    listingDate: record.listingDate,
    productName: record.productName,
    sourceCollectionUrl: record.sourceCollectionUrl,
    supplierUrl: record.supplierUrl,
    purchaseUnitPrice: record.purchaseUnitPrice,
    firstLegShippingFee: record.firstLegShippingFee,
    lastLegShippingFee: record.lastLegShippingFee,
    overseasWarehouseFee: record.overseasWarehouseFee,
    costPrice: record.costPrice,
    salePrice: record.salePrice,
    weight: record.weight,
    originalImageUrl: record.images[0] ?? "",
    note: record.note,
    createdAt: new Date(record.createdAt).toLocaleString(),
    updatedAt: new Date(record.updatedAt).toLocaleString(),
  });

  const handleExportRecords = (scope: "today" | "selected") => {
    const exportRecords =
      scope === "today"
        ? records.filter((item) => item.listingDate === todayString())
        : records.filter((item) => selectedRecordSet.has(item.id));

    if (exportRecords.length === 0) {
      toast.error(scope === "today" ? "今天还没有可导出的记录" : "请先勾选至少一条产品记录");
      return;
    }

    const stamp = scope === "today" ? todayString() : `${exportRecords.length}条记录`;
    exportProductRecordsToWorkbook({
      records: exportRecords.map(mapRecordToExportRow),
      fileName: `产品记录导出-${stamp}.xlsx`,
      sheetName: scope === "today" ? `今日上新-${todayString()}` : "勾选记录",
    });
    toast.success(scope === "today" ? "今日记录已导出为 Excel" : `已导出 ${exportRecords.length} 条勾选记录`);
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5f1ea_0%,#f7f4ef_24%,#efebe5_100%)] text-slate-800">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,148,128,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(123,92,66,0.07),transparent_24%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-[1580px] gap-5 px-4 py-4 lg:px-6 lg:py-6">
        <aside className="hidden w-[260px] shrink-0 flex-col justify-between rounded-[2rem] border border-black/5 bg-[#232524] px-6 py-7 text-stone-200 shadow-[0_24px_60px_rgba(24,22,18,0.18)] lg:flex">
          <div className="space-y-8">
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.35em] text-stone-400">Product Desk</p>
              <h1 className="mt-4 font-serif text-[2rem] leading-none text-stone-50">上新记录台</h1>
              <p className="mt-3 text-sm leading-6 text-stone-400">
                为日常上新、核价追踪和产品备注准备的轻量工作台。尽量弱化登录感知，打开同一网址即可查看同一份记录。
              </p>
              <Link
                href="/live"
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-medium text-stone-100 transition hover:bg-white/15"
              >
                <Store className="h-4 w-4" />
                在售产品（SPU）
              </Link>
            </div>

            <div className="space-y-3 rounded-[1.5rem] border border-white/8 bg-white/5 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.28em] text-stone-500">今日概览</p>
              <div className="space-y-3 text-sm">
                <div className="flex items-end justify-between border-b border-white/8 pb-3">
                  <span className="text-stone-400">今日上新</span>
                  <span className="text-2xl font-semibold text-stone-50">{stats.todayCount}</span>
                </div>
                <div className="flex items-end justify-between border-b border-white/8 pb-3">
                  <span className="text-stone-400">总记录</span>
                  <span className="text-lg font-semibold text-stone-100">{stats.total}</span>
                </div>
                <div className="flex items-end justify-between">
                  <span className="text-stone-400">筛选结果</span>
                  <span className="text-lg font-semibold text-[#b5c8b7]">{filteredRecords.length}</span>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[1.5rem] border border-white/8 bg-[#1b1d1c]">
              <img src={textureImage} alt="工作台纹理" className="h-40 w-full object-cover opacity-90" />
              <div className="space-y-2 p-4">
                <p className="text-xs uppercase tracking-[0.28em] text-stone-500">云端说明</p>
                <p className="text-sm leading-6 text-stone-300">
                  图片和记录会保存到云端，换设备访问同一网站仍可继续查看。若这个网址只供你自己使用，建议不要随意外传。
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/8 bg-white/5 p-4 text-sm leading-6 text-stone-400">
            这是跨设备同步版本。当前采用弱登录感知方案，尽量保持打开即用体验。
          </div>
        </aside>

        <main className="flex-1 space-y-5">
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="overflow-hidden rounded-[2rem] border border-black/5 bg-[#f7f3ee] shadow-[0_24px_70px_rgba(48,39,28,0.08)]"
          >
            <div className="grid gap-0 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="relative min-h-[320px] overflow-hidden px-6 py-7 sm:px-8 sm:py-9 lg:px-10">
                <div className="absolute inset-0">
                  <img src={heroImage} alt="产品记录系统主视觉" className="h-full w-full object-cover opacity-18" />
                  <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(247,243,238,0.95)_0%,rgba(247,243,238,0.92)_38%,rgba(247,243,238,0.72)_58%,rgba(247,243,238,0.82)_100%)]" />
                </div>
                <div className="relative max-w-2xl">
                  <span className="inline-flex rounded-full border border-[#6e7f6d]/20 bg-[#dfe6dd] px-3 py-1 text-[0.72rem] font-medium tracking-[0.18em] text-[#50604f] uppercase">
                    Cloud Listing Workspace
                  </span>
                  <h2 className="mt-5 max-w-xl font-serif text-4xl leading-tight text-slate-900 sm:text-5xl">
                    跨境电商产品上新记录系统
                  </h2>
                  <p className="mt-4 max-w-xl text-[15px] leading-7 text-slate-600 sm:text-base">
                    参考你的核价表逻辑，保留运营日常真正常用的信息字段：源采集链接、货源链接、图片、成本、售价、重量、备注，以及按日期快速筛选查看。现在已改为云端保存，换设备也能继续用。
                  </p>

                  <div className="mt-7 grid gap-3 sm:grid-cols-3">
                    {[
                      { label: "筛选总成本合计", value: currency(stats.totalCost) },
                      { label: "筛选售价合计", value: currency(stats.totalSale) },
                      { label: "平均重量", value: `${stats.avgWeight.toFixed(0)} g` },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-[1.35rem] border border-black/6 bg-white/75 p-4 shadow-[0_8px_24px_rgba(30,23,15,0.06)] backdrop-blur-sm"
                      >
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                        <p className="mt-3 text-xl font-semibold text-slate-900">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-black/5 bg-[#efeae2] p-4 sm:p-5 xl:border-l xl:border-t-0">
                <img
                  src={panelImage}
                  alt="产品上新整理静物图"
                  className="h-full min-h-[280px] w-full rounded-[1.6rem] object-cover shadow-[0_18px_45px_rgba(31,25,18,0.12)]"
                />
              </div>
            </div>
          </motion.section>

          <section className="grid items-start gap-5 xl:grid-cols-[minmax(26rem,0.95fr)_minmax(0,1.05fr)] 2xl:grid-cols-[minmax(28rem,0.93fr)_minmax(0,1.07fr)]">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08 }}
              className="min-w-0 rounded-[2rem] border border-black/5 bg-[rgba(250,248,244,0.92)] p-5 shadow-[0_22px_60px_rgba(38,30,24,0.08)] backdrop-blur-sm sm:p-6"
            >
              <div className="mb-6 flex items-start justify-between gap-3 border-b border-black/6 pb-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[#687267]">录入面板</p>
                  <h3 className="mt-3 font-serif text-2xl text-slate-900">{editingId ? "编辑产品记录" : "新增产品记录"}</h3>
                </div>
                <div className="rounded-full border border-[#7c947f]/20 bg-[#e0e7de] px-3 py-1 text-xs font-medium text-[#4f5f4e]">
                  云端同步
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="产品名称" required>
                    <input
                      value={form.productName}
                      onChange={(e) => setForm((prev) => ({ ...prev, productName: e.target.value }))}
                      placeholder="例如：厨房硅胶收纳盒"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="上新日期" required icon={<CalendarRange className="h-4 w-4" />}>
                    <input
                      type="date"
                      value={form.listingDate}
                      onChange={(e) => setForm((prev) => ({ ...prev, listingDate: e.target.value }))}
                      className={inputClass}
                    />
                  </Field>
                </div>

                <Field label="源采集平台链接" required>
                  <input
                    value={form.sourceCollectionUrl}
                    onChange={(e) => setForm((prev) => ({ ...prev, sourceCollectionUrl: e.target.value }))}
                    placeholder="粘贴源采集平台链接"
                    className={inputClass}
                  />
                </Field>

                <Field label="货源平台链接" required>
                  <input
                    value={form.supplierUrl}
                    onChange={(e) => setForm((prev) => ({ ...prev, supplierUrl: e.target.value }))}
                    placeholder="粘贴 1688 / 其他货源平台链接"
                    className={inputClass}
                  />
                </Field>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="商品采购单价（元）">
                    <input
                      inputMode="decimal"
                      value={form.purchaseUnitPrice}
                      onChange={(e) => setForm((prev) => ({ ...prev, purchaseUnitPrice: e.target.value }))}
                      placeholder="例如 18.5"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="售价（元）">
                    <input
                      inputMode="decimal"
                      value={form.salePrice}
                      onChange={(e) => setForm((prev) => ({ ...prev, salePrice: e.target.value }))}
                      placeholder="例如 49.9"
                      className={inputClass}
                    />
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="重量（g）" icon={<Weight className="h-4 w-4" />}>
                    <input
                      inputMode="decimal"
                      value={form.weight}
                      onChange={(e) => setForm((prev) => ({ ...prev, weight: e.target.value }))}
                      placeholder="例如 320"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="头程重量运费（自动）">
                    <input readOnly value={costPreview.firstLegShippingFee || "0"} className={readonlyInputClass} />
                  </Field>
                  <Field label="尾程重量运费（自动）">
                    <input readOnly value={costPreview.lastLegShippingFee || "0"} className={readonlyInputClass} />
                  </Field>
                  <Field label="海外仓操作费（固定）">
                    <input readOnly value={costPreview.overseasWarehouseFee || "0"} className={readonlyInputClass} />
                  </Field>
                </div>

                <div className="rounded-[1.25rem] border border-[#d8ddd3] bg-[#f4f1eb] px-4 py-4 text-sm text-slate-600">
                  <p className="font-medium text-slate-700">当前自动核算总成本：{currency(Number(costPreview.totalCostPrice || 0))}</p>
                  <p className="mt-2 leading-6">
                    头程按重量 × {PRODUCT_COST_CONSTANTS.firstLegRatePerKg} ÷ 1000 计算并四舍五入到两位小数；尾程按重量区间自动取值；海外仓操作费固定为 {PRODUCT_COST_CONSTANTS.fixedOverseasWarehouseFee} 元。
                  </p>
                </div>

                <Field label="商品图片（最多 4 张）" icon={<ImagePlus className="h-4 w-4" />}>
                  <label className="group flex min-h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-[1.35rem] border border-dashed border-[#7d8f7f]/30 bg-[#f3f1ec] px-4 py-5 text-center transition hover:border-[#728572]/50 hover:bg-[#eeece6]">
                    <div className="rounded-full bg-[#dfe7de] p-3 text-[#4f5f4e] transition group-hover:scale-105">
                      <ImagePlus className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">点击上传商品图片</p>
                      <p className="mt-1 text-xs text-slate-500">上传前会先自动压缩大图，减少提交等待时间，再同步到云端</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={isProcessingImages || remainingImageSlots === 0}
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>
                </Field>

                {uploadFeedback && (
                  <div className="rounded-[1.15rem] border border-[#7d8f7f]/20 bg-[#eef3eb] px-4 py-3 text-sm text-[#4f5f4e]">
                    <div className="flex items-center gap-2">
                      {isProcessingImages ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
                      <span>{uploadFeedback}</span>
                    </div>
                  </div>
                )}

                {form.images.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {form.images.map((src, index) => (
                      <div key={`${src}-${index}`} className="group relative overflow-hidden rounded-[1.2rem] border border-black/6 bg-white">
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewImage({
                              src,
                              alt: `商品图片 ${index + 1}`,
                              caption: `表单预览图 ${index + 1}`,
                            })
                          }
                          className="relative block w-full"
                        >
                          <img src={src} alt={`商品图片 ${index + 1}`} className="h-28 w-full object-cover" />
                          <span className="absolute inset-x-0 bottom-0 inline-flex items-center justify-center gap-1 bg-gradient-to-t from-black/55 to-transparent px-3 py-2 text-xs text-white opacity-0 transition group-hover:opacity-100">
                            <Maximize2 className="h-3.5 w-3.5" />
                            点击放大
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              images: prev.images.filter((_, itemIndex) => itemIndex !== index),
                            }))
                          }
                          className="absolute right-2 top-2 rounded-full bg-black/55 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
                          aria-label="删除图片"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <Field label="产品备注" icon={<StickyNote className="h-4 w-4" />}>
                  <textarea
                    value={form.note}
                    onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                    placeholder="可记录平台表现、选品判断、风险点、是否已核价等"
                    className={`${inputClass} min-h-[120px] resize-y py-3`}
                  />
                </Field>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button type="submit" disabled={isFormBusy} className={primaryButtonClass}>
                    {isFormBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
                    {isProcessingImages ? "图片处理中" : editingId ? "保存修改" : "添加记录"}
                  </button>
                  <button type="button" onClick={resetForm} className={secondaryButtonClass}>
                    重置表单
                  </button>
                </div>
              </form>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.12 }}
              className="min-w-0 space-y-5"
            >
              <section className="min-w-0 rounded-[2rem] border border-black/5 bg-[rgba(250,248,244,0.92)] p-5 shadow-[0_22px_60px_rgba(38,30,24,0.08)] backdrop-blur-sm sm:p-6">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-black/6 pb-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-[#687267]">筛选与查看</p>
                    <h3 className="mt-3 font-serif text-2xl text-slate-900">按日期回看每日上新</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => handleExportRecords("today")} className={secondaryButtonClass}>
                      <Download className="h-4 w-4" />
                      导出今日 Excel
                    </button>
                    <button type="button" onClick={() => handleExportRecords("selected")} className={secondaryButtonClass}>
                      <Download className="h-4 w-4" />
                      导出勾选 Excel
                    </button>
                    <div className="rounded-full border border-[#7c947f]/20 bg-[#e0e7de] px-3 py-1 text-xs font-medium text-[#4f5f4e]">
                      云端数据源
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr_auto]">
                  <div>
                    <label className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Filter className="h-4 w-4 text-[#50604f]" />
                      日期筛选
                    </label>
                    <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Search className="h-4 w-4 text-[#50604f]" />
                      关键词搜索
                    </label>
                    <input
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder="搜索名称、备注、链接、价格或重量"
                      className={inputClass}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        setDateFilter("");
                        setKeyword("");
                      }}
                      className={`${secondaryButtonClass} w-full justify-center lg:w-auto`}
                    >
                      清空筛选
                    </button>
                  </div>
                </div>
              </section>

              <section className="min-w-0 rounded-[2rem] border border-black/5 bg-[rgba(250,248,244,0.92)] p-4 shadow-[0_22px_60px_rgba(38,30,24,0.08)] backdrop-blur-sm sm:p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-2 pt-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-[#687267]">记录列表</p>
                      <h3 className="mt-2 font-serif text-2xl text-slate-900">产品记录</h3>
                    </div>
                    <div className="inline-flex items-center gap-2 text-sm text-slate-500">
                      <Cloud className="h-4 w-4" />共 {filteredRecords.length} 条结果 · 已勾选 {selectedRecordIds.length} 条
                    </div>
                  </div>


                {recordsQuery.isLoading ? (
                  <div className="flex min-h-64 items-center justify-center rounded-[1.6rem] border border-dashed border-[#7e907f]/30 bg-[#f5f2eb] text-slate-500">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    正在读取云端记录
                  </div>
                ) : filteredRecords.length === 0 ? (
                  <div className="overflow-hidden rounded-[1.6rem] border border-dashed border-[#7e907f]/30 bg-[#f5f2eb]">
                    <div className="grid gap-0 md:grid-cols-[0.82fr_1.18fr]">
                      <img src={textureImage} alt="空状态插图" className="h-full min-h-52 w-full object-cover" />
                      <div className="flex flex-col justify-center px-6 py-7 sm:px-8">
                        <p className="text-xs uppercase tracking-[0.24em] text-[#687267]">暂无匹配记录</p>
                        <h4 className="mt-3 font-serif text-3xl text-slate-900">先添加一条今天的新产品</h4>
                        <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">
                          记录提交后会自动保存到云端。之后你在其它设备打开同一个网址，也可以继续查看和维护这份上新清单。
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paginatedRecords.map((record, index) => {
                      const margin = Number(record.salePrice || 0) - Number(record.costPrice || 0);
                      const isExpanded = expandedRecordId === record.id;
                      const recordCode = recordCodeMap[record.id] ?? `${formatRecordCodeDate(record.listingDate)}-001`;

                      return (
                        <motion.article
                          key={record.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.24, delay: index * 0.03 }}
                          className="overflow-hidden rounded-[1.5rem] border border-black/6 bg-white/78 shadow-[0_10px_30px_rgba(31,24,18,0.05)]"
                        >
                          <button
                            type="button"
                            onClick={() => setExpandedRecordId((prev) => (prev === record.id ? null : record.id))}
                            className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-[#f6f3ed] sm:px-5"
                          >
                            <div className="flex min-w-0 items-center gap-4">
                              <label
                                className="flex h-5 w-5 shrink-0 items-center justify-center"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedRecordSet.has(record.id)}
                                  onChange={() => toggleRecordSelection(record.id)}
                                  className="h-4 w-4 rounded border-[#b9c4b6] text-[#50604f] focus:ring-[#50604f]"
                                  aria-label={`选择 ${record.productName}`}
                                />
                              </label>
                              <div className="inline-flex min-w-[8.9rem] shrink-0 items-center justify-center rounded-full border border-[#7f8f80]/20 bg-[#e2e8e0] px-3 py-3 text-[0.72rem] font-semibold tracking-[0.14em] text-[#50604f] sm:min-w-[9.5rem]">
                                {recordCode}
                              </div>
                              <div className="min-w-0 max-w-full overflow-hidden">
                                <p className="truncate font-serif text-xl text-slate-900 sm:text-2xl">{record.productName}</p>
                                <p className="mt-1 text-sm text-slate-500">点击展开查看完整记录</p>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-3">
                              <span className="hidden rounded-full border border-[#d5d8d2] bg-[#f5f3ee] px-3 py-1 text-[0.72rem] font-medium tracking-[0.16em] text-slate-500 uppercase sm:inline-flex">
                                {record.listingDate}
                              </span>
                              <span className="text-slate-500">
                                {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                              </span>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-black/6 bg-[#fcfbf8] p-4 sm:p-5">
                              <div className="overflow-hidden rounded-[1.45rem] border border-black/6 bg-white">
                                <div className="min-w-0 p-5 sm:p-6">
                                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/6 pb-4">
                                    <div>
                                      <div className="mb-3 flex flex-wrap items-center gap-2">
                                        <span className="rounded-full border border-[#7f8f80]/25 bg-[#e2e8e0] px-3 py-1 text-[0.72rem] font-medium tracking-[0.18em] text-[#50604f] uppercase">
                                          {record.listingDate}
                                        </span>
                                        <span className="rounded-full border border-[#7f8f80]/25 bg-[#edf3ea] px-3 py-1 text-[0.72rem] font-medium tracking-[0.18em] text-[#50604f] uppercase">
                                          编号 {recordCode}
                                        </span>
                                        <span className="rounded-full border border-[#b4987b]/20 bg-[#f0e8df] px-3 py-1 text-[0.72rem] font-medium tracking-[0.18em] text-[#85684c] uppercase">
                                          利差 {currency(margin)}
                                        </span>
                                      </div>
                                      <h4 className="font-serif text-2xl text-slate-900">{record.productName}</h4>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                      <button type="button" onClick={() => handleEdit(record)} className={secondaryButtonClass}>
                                        <Pencil className="h-4 w-4" />
                                        编辑
                                      </button>
                                      <button type="button" onClick={() => void handleDelete(record.id)} className={dangerButtonClass}>
                                        <Trash2 className="h-4 w-4" />
                                        删除
                                      </button>
                                    </div>
                                  </div>

                                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                    <InfoBox label={record.firstLegShippingFee || record.lastLegShippingFee || record.overseasWarehouseFee ? "商品采购单价" : "历史采购成本"} value={record.purchaseUnitPrice ? currency(Number(record.purchaseUnitPrice)) : "—"} />
                                    <InfoBox label="头程重量运费" value={record.firstLegShippingFee ? currency(Number(record.firstLegShippingFee)) : "历史记录未拆分"} />
                                    <InfoBox label="尾程重量运费" value={record.lastLegShippingFee ? currency(Number(record.lastLegShippingFee)) : "历史记录未拆分"} />
                                    <InfoBox label="海外仓操作费" value={record.overseasWarehouseFee ? currency(Number(record.overseasWarehouseFee)) : "历史记录未拆分"} />
                                    <InfoBox label={record.firstLegShippingFee || record.lastLegShippingFee || record.overseasWarehouseFee ? "总成本" : "历史总成本"} value={record.costPrice ? currency(Number(record.costPrice)) : "—"} />
                                    <InfoBox label="售价" value={record.salePrice ? currency(Number(record.salePrice)) : "—"} />
                                    <InfoBox label="重量" value={record.weight ? `${record.weight} g` : "—"} />
                                  </div>

                                  {!(record.firstLegShippingFee || record.lastLegShippingFee || record.overseasWarehouseFee) ? (
                                    <p className="mt-4 rounded-[1.1rem] border border-amber-200/70 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                                      这条历史记录创建于成本拆分改造之前，当前保留原总成本展示，自动拆分费用不会回填到旧记录中。
                                    </p>
                                  ) : null}

                                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                                    <LinkBox label="源采集平台链接" href={record.sourceCollectionUrl} />
                                    <LinkBox label="货源平台链接" href={record.supplierUrl} />
                                  </div>

                                  {(() => {
                                    const originalImage = record.images[0] ?? "";
                                    const savedImage = record.optimizedMainImageUrl ?? "";
                                    const redundantSavedImage =
                                      Boolean(originalImage && savedImage) && originalImage === savedImage;
                                    const showSavedImagePanel = Boolean(savedImage) && !redundantSavedImage;

                                    if (!originalImage && !showSavedImagePanel) {
                                      return null;
                                    }

                                    return (
                                      <div
                                        className={`mt-5 grid gap-4 ${showSavedImagePanel ? "lg:grid-cols-2" : "lg:grid-cols-1"}`}
                                      >
                                        <div className="rounded-[1.25rem] border border-black/6 bg-[#f7f4ee] p-4">
                                          <div>
                                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">商品原图</p>
                                            <p className="mt-2 text-sm leading-6 text-slate-600">保留紧凑卡片展示，点击可查看大图。</p>
                                          </div>
                                          {originalImage ? (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setPreviewImage({
                                                  src: originalImage,
                                                  alt: record.productName,
                                                  caption: `${record.productName} · 主图`,
                                                })
                                              }
                                              className="mt-4 group relative block overflow-hidden rounded-[1.2rem] border border-black/6 bg-white"
                                            >
                                              <img
                                                src={originalImage}
                                                alt={record.productName}
                                                className="aspect-square w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                                              />
                                              <span className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/60 via-black/10 to-transparent px-3 py-3 text-xs text-white opacity-0 transition group-hover:opacity-100">
                                                点击查看原图
                                              </span>
                                            </button>
                                          ) : (
                                            <div className="mt-4 flex aspect-square items-center justify-center rounded-[1.2rem] border border-dashed border-black/10 bg-[#faf7f1] px-4 text-center text-sm leading-6 text-slate-500">
                                              当前未上传图片
                                            </div>
                                          )}
                                        </div>

                                        {showSavedImagePanel ? (
                                          <div className="rounded-[1.25rem] border border-black/6 bg-[#f7f4ee] p-4">
                                            <div>
                                              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">已保存主图</p>
                                              <p className="mt-2 text-sm leading-6 text-slate-600">来自历史记录中的单独主图字段；若与首张原图重复，将自动隐藏以免重复展示。</p>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setPreviewImage({
                                                  src: savedImage,
                                                  alt: `${record.productName} 已保存主图`,
                                                  caption: `${record.productName} · 已保存主图`,
                                                })
                                              }
                                              className="mt-4 group relative block overflow-hidden rounded-[1.2rem] border border-black/6 bg-white"
                                            >
                                              <img
                                                src={savedImage}
                                                alt={`${record.productName} 已保存主图`}
                                                className="aspect-square w-full object-cover"
                                              />
                                              <span className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/60 via-black/10 to-transparent px-3 py-3 text-xs text-white opacity-0 transition group-hover:opacity-100">
                                                点击查看大图
                                              </span>
                                            </button>
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })()}

                                  {record.note && (
                                    <div className="mt-5 rounded-[1.25rem] border border-black/6 bg-[#f7f4ee] p-4">
                                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">备注</p>
                                      <p className="mt-3 text-sm leading-7 text-slate-700">{record.note}</p>
                                    </div>
                                  )}

                                  {record.images.length > 1 && (
                                    <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
                                      {record.images.slice(1).map((src, imageIndex) => (
                                        <button
                                          key={`${src}-${imageIndex}`}
                                          type="button"
                                          onClick={() =>
                                            setPreviewImage({
                                              src,
                                              alt: `${record.productName} 附图 ${imageIndex + 2}`,
                                              caption: `${record.productName} · 附图 ${imageIndex + 2}`,
                                            })
                                          }
                                          className="group relative overflow-hidden rounded-[1rem] border border-black/6"
                                        >
                                          <img
                                            src={src}
                                            alt={`${record.productName} 附图 ${imageIndex + 2}`}
                                            className="h-24 w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                                          />
                                          <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-xs font-medium text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
                                            点击放大
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </motion.article>
                      );
                    })}
                  </div>
                )}

                {paginationState.showPagination && (
                  <div className="mt-5 rounded-[1.35rem] border border-black/6 bg-[#f7f4ee] px-4 py-4 sm:px-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-slate-500">
                        当前显示第 {paginationState.summary.start}-{paginationState.summary.end} 条，共 {filteredRecords.length} 条记录
                      </p>
                      <p className="text-sm font-medium text-[#50604f]">
                        第 {paginationState.currentPage} / {paginationState.totalPages} 页
                      </p>
                    </div>

                    <Pagination className="mt-3 justify-end">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#records-pagination"
                            onClick={(event) => {
                              event.preventDefault();
                              setCurrentPage((prev) => Math.max(1, prev - 1));
                            }}
                            aria-disabled={paginationState.currentPage === 1}
                            className={paginationState.currentPage === 1 ? "pointer-events-none opacity-45" : ""}
                          />
                        </PaginationItem>

                        {paginationState.numbers.map((page, index) => {
                          const previousPage = paginationState.numbers[index - 1];
                          const needsEllipsis =
                            previousPage !== undefined && shouldRenderPaginationEllipsis(previousPage, page);

                          return (
                            <Fragment key={page}>
                              {needsEllipsis && (
                                <PaginationItem>
                                  <PaginationEllipsis />
                                </PaginationItem>
                              )}
                              <PaginationItem>
                                <PaginationLink
                                  href="#records-pagination"
                                  isActive={paginationState.currentPage === page}
                                  aria-label={getPageLabel(page)}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    setCurrentPage(page);
                                  }}
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            </Fragment>
                          );
                        })}

                        <PaginationItem>
                          <PaginationNext
                            href="#records-pagination"
                            onClick={(event) => {
                              event.preventDefault();
                              setCurrentPage((prev) => Math.min(paginationState.totalPages, prev + 1));
                            }}
                            aria-disabled={paginationState.currentPage === paginationState.totalPages}
                            className={
                              paginationState.currentPage === paginationState.totalPages
                                ? "pointer-events-none opacity-45"
                                : ""
                            }
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </section>
            </motion.div>
          </section>
        </main>
      </div>

      <Dialog open={Boolean(previewImage)} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent
          showCloseButton={false}
          className="max-w-[min(92vw,1100px)] border-black/10 bg-[#111412]/95 p-3 text-white shadow-[0_28px_80px_rgba(0,0,0,0.45)] sm:p-4"
        >
          <div className="flex items-center justify-between gap-4 px-2 pb-2 pt-1">
            <div>
              <DialogTitle className="text-base font-medium text-white">商品图片预览</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-white/70">
                {previewImage?.caption ?? "点击遮罩或右上角关闭"}
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-2 text-sm text-white transition hover:bg-white/14"
            >
              关闭预览
            </button>
          </div>

          {previewImage && (
            <div className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-black/30">
              <img src={previewImage.src} alt={previewImage.alt} className="max-h-[78vh] w-full object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  children,
  required,
  icon,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  icon?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
        {icon}
        {label}
        {required && <span className="text-[#8b6a4e]">*</span>}
      </span>
      {children}
    </label>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-black/6 bg-[#f7f4ee] p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-3 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function LinkBox({ label, href }: { label: string; href: string }) {
  return (
    <div className="rounded-[1.25rem] border border-black/6 bg-[#f7f4ee] p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-2 break-all text-sm leading-7 text-slate-700 transition hover:text-[#50604f]"
      >
        <span className="line-clamp-2">{href}</span>
        <ExternalLink className="h-4 w-4 shrink-0" />
      </a>
    </div>
  );
}

const inputClass =
  "w-full rounded-[1.2rem] border border-black/8 bg-[#fbfaf7] px-4 py-3 text-sm text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] outline-none transition placeholder:text-slate-400 focus:border-[#798a79] focus:bg-white focus:ring-4 focus:ring-[#d8e2d7]";

const readonlyInputClass =
  "w-full rounded-[1.2rem] border border-black/6 bg-[#f2efe8] px-4 py-3 text-sm text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] outline-none";

const primaryButtonClass =
  "inline-flex items-center gap-2 rounded-full bg-[#2c332f] px-5 py-3 text-sm font-medium text-white shadow-[0_12px_30px_rgba(36,37,34,0.22)] transition hover:-translate-y-0.5 hover:bg-[#1f2621] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0";

const secondaryButtonClass =
  "inline-flex items-center gap-2 rounded-full border border-black/8 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:border-[#758675]/30 hover:bg-[#f5f4ef]";

const dangerButtonClass =
  "inline-flex items-center gap-2 rounded-full border border-[#d1b7aa] bg-[#fff7f4] px-4 py-2.5 text-sm font-medium text-[#8f4f37] transition hover:-translate-y-0.5 hover:bg-[#fff1ec]";
