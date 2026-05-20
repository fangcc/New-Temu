import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import * as XLSX from "xlsx";
import { Download, ExternalLink, FileSpreadsheet, LayoutList, Loader2, Pencil, Plus, Search, Store, Trash2, Weight } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { inverseActivityDeclaredForTargetMargin, simulateActivityPricing } from "@shared/liveListingActivitySim";
import { findLiveListingHeaderRowIndex, parseLiveListingImportMatrix } from "@shared/liveListingImportParse";
import { computeLiveListingMetrics } from "@shared/liveListingMath";
import {
  getPageLabel,
  getRecordPaginationState,
  LIVE_LISTINGS_RECORDS_PER_PAGE,
  shouldRenderPaginationEllipsis,
} from "@shared/productRecords";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ShopToolbar } from "@/components/ShopToolbar";
import { trpc } from "@/lib/trpc";
import { useSelectedShop } from "@/lib/useSelectedShop";

type LiveListing = {
  id: string;
  shopId: string;
  spuId: string;
  productName: string;
  supplier1688Url: string;
  weight: string;
  purchaseUnitPrice: string;
  firstLegShippingFee: string;
  lastLegShippingFee: string;
  overseasWarehouseFee: string;
  declaredPrice: string;
  subsidySellingPrice: string;
  totalCost: string;
  grossProfit: string;
  profitMarginPercent: string;
  sourceProductRecordId: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

type LiveForm = {
  spuId: string;
  productName: string;
  supplier1688Url: string;
  weight: string;
  purchaseUnitPrice: string;
  firstLegShippingFee: string;
  lastLegShippingFee: string;
  overseasWarehouseFee: string;
  declaredPrice: string;
  subsidySellingPrice: string;
  sourceProductRecordId: string;
  note: string;
};

const emptyForm: LiveForm = {
  spuId: "",
  productName: "",
  supplier1688Url: "",
  weight: "",
  purchaseUnitPrice: "",
  firstLegShippingFee: "",
  lastLegShippingFee: "",
  overseasWarehouseFee: "4",
  declaredPrice: "",
  subsidySellingPrice: "",
  sourceProductRecordId: "",
  note: "",
};

function currency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function parsePercent(s: string) {
  const n = Number(String(s).trim());
  return Number.isFinite(n) ? n : 0;
}

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function parseWorkbookToImportRows(buf: ArrayBuffer): {
  sheetName: string;
  rows: ReturnType<typeof parseLiveListingImportMatrix>["rows"];
  skippedEmpty: number;
  duplicateCountInFile: number;
} {
  const wb = XLSX.read(buf, { type: "array" });
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) {
      continue;
    }
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
    if (findLiveListingHeaderRowIndex(matrix) >= 0) {
      const parsed = parseLiveListingImportMatrix(matrix);
      return { sheetName, ...parsed };
    }
  }
  throw new Error("未识别到核价表：请确认工作表中有「产品名称」与「SPU ID」表头行（如美区TEMU核价表模板）");
}

export default function LiveListings() {
  const utils = trpc.useUtils();
  const { shopId, setShopId, shops, ready: shopReady, shopsQuery } = useSelectedShop();

  const createShopMutation = trpc.shops.create.useMutation({
    onSuccess: async (shop) => {
      await utils.shops.list.invalidate();
      setShopId(shop.id);
      toast.success(`已切换到「${shop.name}」`);
    },
    onError: (e) => toast.error(e.message || "创建店铺失败"),
  });

  const handleCreateShop = () => {
    const name = window.prompt("请输入新店铺名称（例如：Temu 美区一号店）");
    if (!name?.trim()) {
      return;
    }
    void createShopMutation.mutateAsync({ name: name.trim() });
  };

  const excelInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<LiveForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [minMargin, setMinMargin] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  /** 活动模拟：申报核价 × 折扣 + 加价 = 活动后补贴售价 */
  const [actDiscount, setActDiscount] = useState("0.6");
  const [actFee, setActFee] = useState("21");
  /** 仅保留「活动后」利润率 ≥ 该值（%），留空不过滤 */
  const [actMinMarginAfter, setActMinMarginAfter] = useState("");
  /** 反推：达到该目标活动后利润率（%）所需的「活动申报」折后价，留空不显示列 */
  const [actInverseMargin, setActInverseMargin] = useState("");

  const listQuery = trpc.liveListings.list.useQuery(
    { shopId },
    { staleTime: 10_000, enabled: shopReady },
  );

  const createMutation = trpc.liveListings.create.useMutation({
    onSuccess: async () => {
      await utils.liveListings.list.invalidate();
      toast.success("在售记录已保存");
      resetForm();
    },
    onError: (e) => toast.error(e.message || "保存失败"),
  });

  const updateMutation = trpc.liveListings.update.useMutation({
    onSuccess: async () => {
      await utils.liveListings.list.invalidate();
      toast.success("在售记录已更新");
      resetForm();
    },
    onError: (e) => toast.error(e.message || "更新失败"),
  });

  const deleteMutation = trpc.liveListings.delete.useMutation({
    onSuccess: async () => {
      await utils.liveListings.list.invalidate();
      toast.success("已删除");
    },
    onError: (e) => toast.error(e.message || "删除失败"),
  });

  const bulkImportMutation = trpc.liveListings.bulkImport.useMutation({
    onSuccess: async (result) => {
      await utils.liveListings.list.invalidate();
      const parts = [
        `新增 ${result.created} 条`,
        `更新 ${result.updated} 条`,
        result.failed ? `失败 ${result.failed} 条` : null,
      ].filter(Boolean);
      toast.success(`导入完成：${parts.join("，")}`);
      if (result.errors.length > 0) {
        toast.error(
          `部分失败示例：${result.errors
            .slice(0, 3)
            .map((e) => `${e.spuId}: ${e.message}`)
            .join("；")}`,
          { duration: 8000 },
        );
      }
    },
    onError: (e) => toast.error(e.message || "导入失败"),
  });

  useEffect(() => {
    if (listQuery.error) {
      toast.error(listQuery.error.message || "加载失败");
    }
  }, [listQuery.error]);

  useEffect(() => {
    if (shopsQuery.error) {
      toast.error(shopsQuery.error.message || "店铺列表加载失败");
    }
  }, [shopsQuery.error]);

  const records = listQuery.data ?? [];
  const preview = useMemo(
    () =>
      computeLiveListingMetrics({
        purchaseUnitPrice: form.purchaseUnitPrice,
        firstLegShippingFee: form.firstLegShippingFee,
        lastLegShippingFee: form.lastLegShippingFee,
        overseasWarehouseFee: form.overseasWarehouseFee,
        subsidySellingPrice: form.subsidySellingPrice,
      }),
    [
      form.purchaseUnitPrice,
      form.firstLegShippingFee,
      form.lastLegShippingFee,
      form.overseasWarehouseFee,
      form.subsidySellingPrice,
    ],
  );

  const activityParams = useMemo(() => {
    const r = Number(actDiscount.trim());
    const f = Number(actFee.trim());
    const minAfter = actMinMarginAfter.trim() === "" ? null : Number(actMinMarginAfter.trim());
    const inv = actInverseMargin.trim() === "" ? null : Number(actInverseMargin.trim());
    const rOk = Number.isFinite(r) && r > 0 && r <= 1;
    const fOk = Number.isFinite(f) && f >= 0;
    return {
      discount: rOk ? r : 0.6,
      fee: fOk ? f : 21,
      rOk,
      fOk,
      useSimFilter: minAfter !== null && Number.isFinite(minAfter) && rOk && fOk,
      minAfter: minAfter ?? 0,
      showInverseCol: inv !== null && Number.isFinite(inv) && inv > 0 && inv < 100 && fOk,
      inversePct: inv ?? 0,
    };
  }, [actDiscount, actFee, actMinMarginAfter, actInverseMargin]);

  const filteredRows = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const min = Number(minMargin.trim());
    const useMin = minMargin.trim() !== "" && Number.isFinite(min);
    const { discount, fee, useSimFilter, minAfter } = activityParams;

    return records.filter((row) => {
      const margin = parsePercent(row.profitMarginPercent);
      if (useMin && margin < min) {
        return false;
      }
      if (!q) {
        // fall through to activity filter
      } else {
        const hay = [
          row.spuId,
          row.productName,
          row.supplier1688Url,
          row.note,
          row.sourceProductRecordId,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) {
          return false;
        }
      }

      if (useSimFilter) {
        const sim = simulateActivityPricing({
          declaredPrice: row.declaredPrice,
          totalCost: row.totalCost,
          discountMultiplier: discount,
          subsidyAddon: fee,
        });
        if (!sim) {
          return false;
        }
        if (sim.marginPercent + 1e-9 < minAfter) {
          return false;
        }
      }

      return true;
    });
  }, [records, keyword, minMargin, activityParams]);

  const paginationState = useMemo(
    () => getRecordPaginationState(filteredRows, currentPage, LIVE_LISTINGS_RECORDS_PER_PAGE),
    [filteredRows, currentPage],
  );
  const paginatedRows = paginationState.pageItems;

  useEffect(() => {
    setCurrentPage(1);
  }, [keyword, minMargin, actDiscount, actFee, actMinMarginAfter, actInverseMargin]);

  useEffect(() => {
    if (paginationState.currentPage !== currentPage) {
      setCurrentPage(paginationState.currentPage);
    }
  }, [currentPage, paginationState.currentPage]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.spuId.trim() || !form.productName.trim()) {
      toast.error("请至少填写 SPU 与产品名称");
      return;
    }
    const payload = {
      shopId,
      spuId: form.spuId.trim(),
      productName: form.productName.trim(),
      supplier1688Url: form.supplier1688Url.trim(),
      weight: form.weight.trim(),
      purchaseUnitPrice: form.purchaseUnitPrice.trim(),
      firstLegShippingFee: form.firstLegShippingFee.trim(),
      lastLegShippingFee: form.lastLegShippingFee.trim(),
      overseasWarehouseFee: form.overseasWarehouseFee.trim(),
      declaredPrice: form.declaredPrice.trim(),
      subsidySellingPrice: form.subsidySellingPrice.trim(),
      sourceProductRecordId: form.sourceProductRecordId.trim(),
      note: form.note.trim(),
    };
    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

  const handleEdit = (row: LiveListing) => {
    setEditingId(row.id);
    setForm({
      spuId: row.spuId,
      productName: row.productName,
      supplier1688Url: row.supplier1688Url,
      weight: row.weight,
      purchaseUnitPrice: row.purchaseUnitPrice,
      firstLegShippingFee: row.firstLegShippingFee,
      lastLegShippingFee: row.lastLegShippingFee,
      overseasWarehouseFee: row.overseasWarehouseFee || "4",
      declaredPrice: row.declaredPrice,
      subsidySellingPrice: row.subsidySellingPrice,
      sourceProductRecordId: row.sourceProductRecordId,
      note: row.note,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const busy = createMutation.isPending || updateMutation.isPending;
  const importBusy = bulkImportMutation.isPending;

  const handleExportFilteredSpuActivityDeclared = () => {
    if (!activityParams.showInverseCol) {
      toast.error("请先填写「反推：目标利润率（%）」并保证加价有效，再导出活动申报反推价");
      return;
    }
    const pct = activityParams.inversePct;
    const fee = activityParams.fee;
    const pairs: { spu: string; activityDeclared: number }[] = [];
    for (const r of filteredRows) {
      const spu = r.spuId.trim();
      if (!spu) {
        continue;
      }
      const inv = inverseActivityDeclaredForTargetMargin({
        totalCost: r.totalCost,
        subsidyAddon: fee,
        targetMarginPercent: pct,
      });
      if (inv === null) {
        continue;
      }
      pairs.push({ spu, activityDeclared: inv });
    }
    if (pairs.length === 0) {
      toast.error("当前筛选结果中没有可导出的记录（需有 SPU，且总成本可算出反推活动申报）");
      return;
    }
    const spuLine = pairs.map((p) => p.spu).join(" ");
    const declaredLine = pairs.map((p) => String(p.activityDeclared)).join(" ");
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(`在售筛选-SPU与活动申报目标${pct}pct-${stamp}.txt`, `${spuLine}\n${declaredLine}\n`);
    toast.success(`已导出 ${pairs.length} 条（第 2 行为活动申报·目标 ${pct}% 反推价，空格分隔）`);
  };

  const handleExcelSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!shopReady) {
      toast.error("请先等待店铺加载完成后再导入");
      return;
    }
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      toast.error("请上传 .xlsx 或 .xls 文件");
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const { sheetName, rows, skippedEmpty, duplicateCountInFile } = parseWorkbookToImportRows(buf);
      if (rows.length === 0) {
        toast.error("未解析到有效数据行（需要 SPU + 产品名称）");
        return;
      }
      const ok = window.confirm(
        `将从工作表「${sheetName}」导入 ${rows.length} 条（按 SPU 去重）。\n` +
          `已跳过约 ${skippedEmpty} 个空行；表内重复 SPU 已合并 ${duplicateCountInFile} 次。\n` +
          `若 SPU 已存在将更新为表格中的最新数据。是否继续？`,
      );
      if (!ok) {
        return;
      }
      await bulkImportMutation.mutateAsync({ shopId, rows });
    } catch (error) {
      const message = error instanceof Error ? error.message : "解析失败";
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5f1ea_0%,#f7f4ef_24%,#efebe5_100%)] text-slate-800">
      <div className="relative mx-auto max-w-[1400px] px-4 py-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 border-b border-black/8 pb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[#687267]">Live SKUs</p>
              <h1 className="mt-2 font-serif text-3xl text-slate-900">在售产品（SPU）</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                按店铺隔离：同一 SPU 可在不同店铺各有一条在售记录。支持活动模拟、反推活动申报价，以及 Excel 批量导入到当前店铺。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/" className={secondaryButtonClass}>
                <LayoutList className="h-4 w-4" />
                上新记录台
              </Link>
            </div>
          </div>
          <ShopToolbar
            secondaryButtonClass={secondaryButtonClass}
            shopId={shopId}
            shops={shops}
            shopsLoading={shopsQuery.isLoading}
            onShopChange={setShopId}
            onCreateShop={handleCreateShop}
            createPending={createShopMutation.isPending}
          />
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(20rem,0.42fr)_minmax(0,1fr)]">
          <section className="rounded-[1.75rem] border border-black/6 bg-[rgba(250,248,244,0.95)] p-5 shadow-[0_22px_60px_rgba(38,30,24,0.08)]">
            <div className="mb-5 flex items-center justify-between gap-2 border-b border-black/6 pb-4">
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-[#50604f]" />
                <h2 className="font-serif text-xl text-slate-900">{editingId ? "编辑在售" : "新增在售"}</h2>
              </div>
              {editingId ? (
                <button type="button" onClick={resetForm} className={secondaryButtonClass}>
                  取消编辑
                </button>
              ) : null}
            </div>

            <form className="space-y-3" onSubmit={(ev) => void handleSubmit(ev)}>
              <Field label="SPU" required>
                <input
                  value={form.spuId}
                  onChange={(e) => setForm((p) => ({ ...p, spuId: e.target.value }))}
                  placeholder="例如 8005934020"
                  className={inputClass}
                />
              </Field>
              <Field label="产品名称" required>
                <input
                  value={form.productName}
                  onChange={(e) => setForm((p) => ({ ...p, productName: e.target.value }))}
                  className={inputClass}
                />
              </Field>
              <Field label="1688 商品链接">
                <input
                  value={form.supplier1688Url}
                  onChange={(e) => setForm((p) => ({ ...p, supplier1688Url: e.target.value }))}
                  placeholder="https://detail.1688.com/..."
                  className={inputClass}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="重量（g）" icon={<Weight className="h-4 w-4" />}>
                  <input
                    inputMode="decimal"
                    value={form.weight}
                    onChange={(e) => setForm((p) => ({ ...p, weight: e.target.value }))}
                    className={inputClass}
                  />
                </Field>
                <Field label="关联上新记录 ID（可选）">
                  <input
                    value={form.sourceProductRecordId}
                    onChange={(e) => setForm((p) => ({ ...p, sourceProductRecordId: e.target.value }))}
                    placeholder="有则填 UUID，无则留空"
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="商品采购单价（元）">
                  <input inputMode="decimal" value={form.purchaseUnitPrice} onChange={(e) => setForm((p) => ({ ...p, purchaseUnitPrice: e.target.value }))} className={inputClass} />
                </Field>
                <Field label="头程重量运费（元）">
                  <input inputMode="decimal" value={form.firstLegShippingFee} onChange={(e) => setForm((p) => ({ ...p, firstLegShippingFee: e.target.value }))} className={inputClass} />
                </Field>
                <Field label="核定尾程运费（元）">
                  <input inputMode="decimal" value={form.lastLegShippingFee} onChange={(e) => setForm((p) => ({ ...p, lastLegShippingFee: e.target.value }))} className={inputClass} />
                </Field>
                <Field label="海外仓操作费（元）">
                  <input inputMode="decimal" value={form.overseasWarehouseFee} onChange={(e) => setForm((p) => ({ ...p, overseasWarehouseFee: e.target.value }))} className={inputClass} />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="申报核价（元）">
                  <input inputMode="decimal" value={form.declaredPrice} onChange={(e) => setForm((p) => ({ ...p, declaredPrice: e.target.value }))} className={inputClass} />
                </Field>
                <Field label="运费补贴售价（元）">
                  <input inputMode="decimal" value={form.subsidySellingPrice} onChange={(e) => setForm((p) => ({ ...p, subsidySellingPrice: e.target.value }))} className={inputClass} />
                </Field>
              </div>

              <div className="rounded-[1.2rem] border border-[#d8ddd3] bg-[#f4f1eb] px-4 py-3 text-sm text-slate-700">
                <p className="font-medium text-slate-800">保存前预览（与入库计算一致）</p>
                <p className="mt-1">
                  总成本 <span className="font-semibold">{preview.totalCost || "—"}</span>
                  {" · "}
                  毛利 <span className="font-semibold">{preview.grossProfit || "—"}</span>
                  {" · "}
                  利润率{" "}
                  <span className="font-semibold">
                    {preview.profitMarginPercent ? `${preview.profitMarginPercent}%` : "—"}
                  </span>
                </p>
              </div>

              <Field label="备注">
                <textarea value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} className={`${inputClass} min-h-[88px] resize-y py-3`} />
              </Field>

              <div className="flex flex-wrap gap-2 pt-2">
                <button type="submit" disabled={busy} className={primaryButtonClass}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {editingId ? "保存修改" : "添加在售"}
                </button>
              </div>
            </form>
          </section>

          <section className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-end gap-3 rounded-[1.5rem] border border-black/6 bg-[rgba(250,248,244,0.92)] p-4">
              <div className="min-w-[12rem] flex-1">
                <label className="text-xs uppercase tracking-[0.2em] text-slate-500">搜索</label>
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="SPU、名称、链接、备注…"
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>
              <div className="w-36">
                <label className="text-xs uppercase tracking-[0.2em] text-slate-500">最低利润率 %</label>
                <input
                  inputMode="decimal"
                  value={minMargin}
                  onChange={(e) => setMinMargin(e.target.value)}
                  placeholder="如 20"
                  className={`${inputClass} mt-1`}
                />
              </div>
              <p className="text-sm text-slate-500">
                共 <span className="font-semibold text-slate-800">{filteredRows.length}</span> 条
              </p>
              <div className="flex flex-col gap-1">
                <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Excel 导入</label>
                <input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="hidden"
                  onChange={(e) => void handleExcelSelected(e)}
                />
                <button
                  type="button"
                  disabled={importBusy || !shopReady}
                  onClick={() => excelInputRef.current?.click()}
                  className={secondaryButtonClass}
                >
                  {importBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                  上传核价表
                </button>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-[#c4cbbf] bg-[#eef1ea] p-4 text-sm text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
              <p className="font-medium text-slate-900">活动报名模拟（例：6 折）</p>
              <p className="mt-1 leading-6 text-slate-600">
                规则：活动后申报核价 = 申报核价 × 折扣系数；活动后补贴售价 = 活动后申报核价 + 加价；活动后毛利 = 活动后补贴售价 −
                总成本；活动后利润率 = 活动后毛利 ÷ 活动后补贴售价。用于判断能否报名某类折扣（可自行改折扣与加价，如尾程按 21 / 28
                等）。填写「反推目标利润率」后，表格会给出要达到该**活动后**利润率时，**活动申报（折后申报核价）应为多少（元）**；与折扣系数无关，仅由总成本、加价与目标利润率决定（按每条 SKU 单独计算）。
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="折扣系数（申报核价×）" required>
                  <input
                    inputMode="decimal"
                    value={actDiscount}
                    onChange={(e) => setActDiscount(e.target.value)}
                    placeholder="6 折填 0.6，7 折填 0.7"
                    className={inputClass}
                  />
                </Field>
                <Field label="活动后补贴加价（元）" required>
                  <input inputMode="decimal" value={actFee} onChange={(e) => setActFee(e.target.value)} placeholder="如 21" className={inputClass} />
                </Field>
                <Field label="筛选：活动后利润率 ≥（%）">
                  <input
                    inputMode="decimal"
                    value={actMinMarginAfter}
                    onChange={(e) => setActMinMarginAfter(e.target.value)}
                    placeholder="如 10，留空不过滤"
                    className={inputClass}
                  />
                </Field>
                <Field label="反推：目标利润率（%）">
                  <input
                    inputMode="decimal"
                    value={actInverseMargin}
                    onChange={(e) => setActInverseMargin(e.target.value)}
                    placeholder="如 10，列示活动申报(元)"
                    className={inputClass}
                  />
                </Field>
              </div>
              {(!activityParams.rOk || !activityParams.fOk) && (
                <p className="mt-2 text-xs text-amber-800">折扣需在 0～1 之间，加价需为数字；当前将按默认 0.6 与 21 参与计算展示。</p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/10 pt-4">
                <button
                  type="button"
                  onClick={handleExportFilteredSpuActivityDeclared}
                  disabled={!activityParams.showInverseCol}
                  title={activityParams.showInverseCol ? undefined : "请先填写「反推：目标利润率（%）」"}
                  className={secondaryButtonClass + " disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"}
                >
                  <Download className="h-4 w-4" />
                  导出当前筛选（SPU + 活动申报·目标{activityParams.showInverseCol ? `${activityParams.inversePct}%` : "…"}）
                </button>
                <span className="text-xs leading-5 text-slate-500">
                  生成 UTF-8 文本：第 1 行为 SPU（空格隔开），第 2 行为对应「活动申报」反推价（元·与上方目标利润率一致），顺序与第 1
                  行一致；需先填写反推目标利润率。
                </span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-[1.5rem] border border-black/6 bg-white shadow-[0_18px_50px_rgba(38,30,24,0.06)]">
              <table className="min-w-[1180px] w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-black/8 bg-[#f7f4ee] text-xs uppercase tracking-[0.12em] text-slate-500">
                    <th className="px-3 py-3">SPU</th>
                    <th className="px-3 py-3">产品名称</th>
                    <th className="px-3 py-3">总成本</th>
                    <th className="px-3 py-3">申报核价</th>
                    <th className="px-3 py-3">补贴售价</th>
                    <th className="px-3 py-3">毛利</th>
                    <th className="px-3 py-3">利润率</th>
                    <th className="px-3 py-3">活动申报</th>
                    <th className="px-3 py-3">活动补贴</th>
                    <th className="px-3 py-3">活动毛利</th>
                    <th className="px-3 py-3">活动利润率</th>
                    {activityParams.showInverseCol ? (
                      <th className="px-3 py-3">活动申报(元·目标{activityParams.inversePct}%)</th>
                    ) : null}
                    <th className="px-3 py-3">1688</th>
                    <th className="px-3 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {listQuery.isLoading ? (
                    <tr>
                      <td
                        colSpan={13 + (activityParams.showInverseCol ? 1 : 0)}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin opacity-60" />
                        加载中…
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={13 + (activityParams.showInverseCol ? 1 : 0)}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        暂无数据，或筛选条件过严
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row) => {
                      const sim = simulateActivityPricing({
                        declaredPrice: row.declaredPrice,
                        totalCost: row.totalCost,
                        discountMultiplier: activityParams.discount,
                        subsidyAddon: activityParams.fee,
                      });
                      const needActivityDeclared = activityParams.showInverseCol
                        ? inverseActivityDeclaredForTargetMargin({
                            totalCost: row.totalCost,
                            subsidyAddon: activityParams.fee,
                            targetMarginPercent: activityParams.inversePct,
                          })
                        : null;

                      return (
                        <tr key={row.id} className="border-b border-black/5 hover:bg-[#fcfbf8]">
                          <td className="px-3 py-3 font-mono text-xs text-slate-800">{row.spuId}</td>
                          <td className="max-w-[200px] px-3 py-3">
                            <span className="line-clamp-2 text-slate-800">{row.productName}</span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">{row.totalCost ? currency(Number(row.totalCost)) : "—"}</td>
                          <td className="whitespace-nowrap px-3 py-3">{row.declaredPrice ? currency(Number(row.declaredPrice)) : "—"}</td>
                          <td className="whitespace-nowrap px-3 py-3">{row.subsidySellingPrice ? currency(Number(row.subsidySellingPrice)) : "—"}</td>
                          <td className="whitespace-nowrap px-3 py-3">{row.grossProfit ? currency(Number(row.grossProfit)) : "—"}</td>
                          <td className="whitespace-nowrap px-3 py-3 font-medium text-[#50604f]">
                            {row.profitMarginPercent ? `${row.profitMarginPercent}%` : "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                            {sim ? currency(sim.newDeclaredPrice) : "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                            {sim ? currency(sim.newSubsidyPrice) : "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-slate-700">{sim ? currency(sim.grossProfit) : "—"}</td>
                          <td className="whitespace-nowrap px-3 py-3 font-medium text-[#50604f]">
                            {sim ? `${sim.marginPercent}%` : "—"}
                          </td>
                          {activityParams.showInverseCol ? (
                            <td className="whitespace-nowrap px-3 py-3 text-slate-800">
                              {needActivityDeclared === null ? "—" : currency(needActivityDeclared)}
                            </td>
                          ) : null}
                          <td className="px-3 py-3">
                            {row.supplier1688Url ? (
                              <a
                                href={row.supplier1688Url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex text-[#50604f] hover:underline"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right">
                            <button type="button" onClick={() => handleEdit(row)} className={secondaryButtonClass + " mr-1 py-1.5"}>
                              <Pencil className="h-3.5 w-3.5" />
                              编辑
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteMutation.mutateAsync({ id: row.id })}
                              disabled={deleteMutation.isPending}
                              className={dangerButtonClass + " py-1.5"}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              删除
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {paginationState.showPagination && (
              <div id="live-listings-pagination" className="rounded-[1.35rem] border border-black/6 bg-[#f7f4ee] px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-500">
                    当前显示第 {paginationState.summary.start}-{paginationState.summary.end} 条，共 {filteredRows.length}{" "}
                    条记录
                  </p>
                  <p className="text-sm font-medium text-[#50604f]">
                    第 {paginationState.currentPage} / {paginationState.totalPages} 页
                  </p>
                </div>

                <Pagination className="mt-3 justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#live-listings-pagination"
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
                              href="#live-listings-pagination"
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
                        href="#live-listings-pagination"
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
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, icon, children }: { label: string; required?: boolean; icon?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
        {icon}
        {label}
        {required ? <span className="text-red-600/80">*</span> : null}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded-[1.2rem] border border-black/8 bg-[#fbfaf7] px-4 py-3 text-sm text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] outline-none transition placeholder:text-slate-400 focus:border-[#798a79] focus:bg-white focus:ring-4 focus:ring-[#d8e2d7]";

const primaryButtonClass =
  "inline-flex items-center gap-2 rounded-full bg-[#2c332f] px-5 py-3 text-sm font-medium text-white shadow-[0_12px_30px_rgba(36,37,34,0.22)] transition hover:-translate-y-0.5 hover:bg-[#1f2621] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0";

const secondaryButtonClass =
  "inline-flex items-center gap-2 rounded-full border border-black/8 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:border-[#758675]/30 hover:bg-[#f5f4ef]";

const dangerButtonClass =
  "inline-flex items-center gap-2 rounded-full border border-[#d1b7aa] bg-[#fff7f4] px-4 py-2.5 text-sm font-medium text-[#8f4f37] transition hover:-translate-y-0.5 hover:bg-[#fff1ec]";
