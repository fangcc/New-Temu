import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import * as XLSX from "xlsx";
import { ExternalLink, FileSpreadsheet, LayoutList, Loader2, Pencil, Plus, Search, Store, Trash2, Weight } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { findLiveListingHeaderRowIndex, parseLiveListingImportMatrix } from "@shared/liveListingImportParse";
import { computeLiveListingMetrics } from "@shared/liveListingMath";
import { trpc } from "@/lib/trpc";

type LiveListing = {
  id: string;
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
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<LiveForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [minMargin, setMinMargin] = useState("");

  const listQuery = trpc.liveListings.list.useQuery(undefined, { staleTime: 10_000 });

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

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const min = Number(minMargin.trim());
    const useMin = minMargin.trim() !== "" && Number.isFinite(min);

    return records.filter((row) => {
      const margin = parsePercent(row.profitMarginPercent);
      if (useMin && margin < min) {
        return false;
      }
      if (!q) {
        return true;
      }
      const hay = [
        row.spuId,
        row.productName,
        row.supplier1688Url,
        row.note,
        row.sourceProductRecordId,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [records, keyword, minMargin]);

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

  const handleExcelSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
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
      await bulkImportMutation.mutateAsync({ rows });
    } catch (error) {
      const message = error instanceof Error ? error.message : "解析失败";
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5f1ea_0%,#f7f4ef_24%,#efebe5_100%)] text-slate-800">
      <div className="relative mx-auto max-w-[1400px] px-4 py-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-black/8 pb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#687267]">Live SKUs</p>
            <h1 className="mt-2 font-serif text-3xl text-slate-900">在售产品（SPU）</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
              以 SPU 为唯一键，记录核价通过后的成本与「运费补贴售价」。总成本、毛利、利润率与表格一致：毛利 ÷
              补贴售价。可不关联上新记录，便于录入店铺已有商品。支持上传与「美区TEMU核价表」相同表头的 Excel，批量新增或按 SPU
              覆盖更新。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className={secondaryButtonClass}>
              <LayoutList className="h-4 w-4" />
              上新记录台
            </Link>
          </div>
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
                共 <span className="font-semibold text-slate-800">{filtered.length}</span> 条
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
                  disabled={importBusy}
                  onClick={() => excelInputRef.current?.click()}
                  className={secondaryButtonClass}
                >
                  {importBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                  上传核价表
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-[1.5rem] border border-black/6 bg-white shadow-[0_18px_50px_rgba(38,30,24,0.06)]">
              <table className="min-w-[920px] w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-black/8 bg-[#f7f4ee] text-xs uppercase tracking-[0.12em] text-slate-500">
                    <th className="px-3 py-3">SPU</th>
                    <th className="px-3 py-3">产品名称</th>
                    <th className="px-3 py-3">总成本</th>
                    <th className="px-3 py-3">申报核价</th>
                    <th className="px-3 py-3">补贴售价</th>
                    <th className="px-3 py-3">毛利</th>
                    <th className="px-3 py-3">利润率</th>
                    <th className="px-3 py-3">1688</th>
                    <th className="px-3 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {listQuery.isLoading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                        <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin opacity-60" />
                        加载中…
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                        暂无数据，或筛选条件过严
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row) => (
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
