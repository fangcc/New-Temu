import { useEffect, useState } from "react";
import { Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  DEFAULT_SHOP_COST_RULES,
  describeShopCostRules,
  type LastLegTier,
  type ShopCostRules,
} from "@shared/shopCostRules";

type Props = {
  shopId: string;
  shopName: string;
  shopReady: boolean;
  secondaryButtonClass: string;
  inputClass: string;
};

function cloneRules(rules: ShopCostRules): ShopCostRules {
  return {
    firstLeg: { ...rules.firstLeg },
    lastLeg: { type: "weight_tiers", tiers: rules.lastLeg.tiers.map((t) => ({ ...t })) },
    overseas: { ...rules.overseas },
  };
}

export function ShopCostRulesPanel({ shopId, shopName, shopReady, secondaryButtonClass, inputClass }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ShopCostRules>(() => cloneRules(DEFAULT_SHOP_COST_RULES));
  const utils = trpc.useUtils();

  const rulesQuery = trpc.shops.getCostRules.useQuery(
    { shopId },
    { enabled: shopReady && open, staleTime: 30_000 },
  );

  const saveMutation = trpc.shops.updateCostRules.useMutation({
    onSuccess: async (saved) => {
      setDraft(cloneRules(saved));
      await utils.shops.getCostRules.invalidate({ shopId });
      toast.success("已保存本店运费公式");
      setOpen(false);
    },
    onError: (e) => toast.error(e.message || "保存失败"),
  });

  useEffect(() => {
    if (rulesQuery.data) {
      setDraft(cloneRules(rulesQuery.data));
    }
  }, [rulesQuery.data]);

  const updateTier = (index: number, patch: Partial<LastLegTier>) => {
    setDraft((prev) => {
      const tiers = [...prev.lastLeg.tiers];
      tiers[index] = { ...tiers[index], ...patch };
      return { ...prev, lastLeg: { type: "weight_tiers", tiers } };
    });
  };

  const addTier = () => {
    setDraft((prev) => ({
      ...prev,
      lastLeg: {
        type: "weight_tiers",
        tiers: [...prev.lastLeg.tiers, { minGrams: 0, maxGrams: 0, fee: 0 }],
      },
    }));
  };

  const removeTier = (index: number) => {
    setDraft((prev) => {
      const tiers = prev.lastLeg.tiers.filter((_, i) => i !== index);
      return { ...prev, lastLeg: { type: "weight_tiers", tiers: tiers.length ? tiers : [{ minGrams: 5, maxGrams: 199, fee: 21 }] } };
    });
  };

  const resetToDefault = () => {
    setDraft(cloneRules(DEFAULT_SHOP_COST_RULES));
  };

  return (
    <>
      <button
        type="button"
        disabled={!shopReady}
        onClick={() => setOpen(true)}
        className={secondaryButtonClass + " disabled:cursor-not-allowed disabled:opacity-50"}
      >
        <Settings2 className="h-4 w-4" />
        运费公式
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-black/10 bg-[#faf8f4]">
          <DialogTitle className="font-serif text-xl text-slate-900">「{shopName}」运费公式</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-slate-600">
            仅影响本店「上新记录」里根据重量自动算出的三项费用。不同站点可设不同头程单价、尾程区间与海外仓固定费。
          </DialogDescription>

          {rulesQuery.isLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载规则…
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">
                  头程（元/kg）
                </label>
                <input
                  inputMode="decimal"
                  className={inputClass}
                  value={draft.firstLeg.ratePerKg}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      firstLeg: { type: "per_kg", ratePerKg: Number(e.target.value) || 0 },
                    }))
                  }
                />
                <p className="mt-1 text-xs text-slate-500">头程运费 = 重量(g) × 单价 ÷ 1000，四舍五入两位小数</p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500">尾程重量区间（g）</span>
                  <button type="button" onClick={addTier} className="text-xs text-[#50604f] underline">
                    + 添加区间
                  </button>
                </div>
                <div className="space-y-2">
                  {draft.lastLeg.tiers.map((tier, index) => (
                    <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                      <input
                        inputMode="numeric"
                        placeholder="最小g"
                        className={inputClass}
                        value={tier.minGrams}
                        onChange={(e) => updateTier(index, { minGrams: Number(e.target.value) || 0 })}
                      />
                      <input
                        inputMode="numeric"
                        placeholder="最大g"
                        className={inputClass}
                        value={tier.maxGrams}
                        onChange={(e) => updateTier(index, { maxGrams: Number(e.target.value) || 0 })}
                      />
                      <input
                        inputMode="decimal"
                        placeholder="运费元"
                        className={inputClass}
                        value={tier.fee}
                        onChange={(e) => updateTier(index, { fee: Number(e.target.value) || 0 })}
                      />
                      <button
                        type="button"
                        disabled={draft.lastLeg.tiers.length <= 1}
                        onClick={() => removeTier(index)}
                        className="text-xs text-red-700 disabled:opacity-40"
                      >
                        删
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-500">重量落在区间内取对应运费；不在任何区间则为 0</p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">
                  海外仓操作费（固定/元）
                </label>
                <input
                  inputMode="decimal"
                  className={inputClass}
                  value={draft.overseas.amount}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      overseas: { type: "fixed", amount: Number(e.target.value) || 0 },
                    }))
                  }
                />
              </div>

              <p className="rounded-lg border border-[#d8ddd3] bg-[#f4f1eb] px-3 py-2 text-xs leading-5 text-slate-600">
                预览：{describeShopCostRules(draft)}
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saveMutation.isPending}
                  onClick={() => void saveMutation.mutateAsync({ shopId, rules: draft })}
                  className="rounded-full bg-[#4f5f4e] px-5 py-2 text-sm text-white disabled:opacity-50"
                >
                  {saveMutation.isPending ? <Loader2 className="inline h-4 w-4 animate-spin" /> : null}
                  保存到本店
                </button>
                <button type="button" onClick={resetToDefault} className={secondaryButtonClass}>
                  恢复默认（美区常用）
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
