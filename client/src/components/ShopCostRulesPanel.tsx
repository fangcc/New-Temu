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
  CARGO_TYPE_OPTIONS,
  cloneRuleSet,
  cloneRulesConfig,
  DEFAULT_SHOP_COST_RULES_CONFIG,
  describeShopCostRuleSet,
  type CargoType,
  type LastLegTier,
  type ShopCostRuleSet,
  type ShopCostRulesConfig,
} from "@shared/shopCostRules";

type Props = {
  shopId: string;
  shopName: string;
  shopReady: boolean;
  secondaryButtonClass: string;
  inputClass: string;
};

function RuleSetEditor({
  label,
  draft,
  setDraft,
  inputClass,
  secondaryButtonClass,
}: {
  label: string;
  draft: ShopCostRuleSet;
  setDraft: (next: ShopCostRuleSet) => void;
  inputClass: string;
  secondaryButtonClass: string;
}) {
  const updateTier = (index: number, patch: Partial<LastLegTier>) => {
    const tiers = [...draft.lastLeg.tiers];
    tiers[index] = { ...tiers[index], ...patch };
    setDraft({ ...draft, lastLeg: { type: "weight_tiers", tiers } });
  };

  const addTier = () => {
    setDraft({
      ...draft,
      lastLeg: {
        type: "weight_tiers",
        tiers: [...draft.lastLeg.tiers, { minGrams: 0, maxGrams: 0, fee: 0 }],
      },
    });
  };

  const removeTier = (index: number) => {
    const tiers = draft.lastLeg.tiers.filter((_, i) => i !== index);
    setDraft({
      ...draft,
      lastLeg: {
        type: "weight_tiers",
        tiers: tiers.length ? tiers : [{ minGrams: 5, maxGrams: 199, fee: 21 }],
      },
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-slate-800">{label}</p>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">头程（元/kg）</label>
        <input
          inputMode="decimal"
          className={inputClass}
          value={draft.firstLeg.ratePerKg}
          onChange={(e) =>
            setDraft({ ...draft, firstLeg: { type: "per_kg", ratePerKg: Number(e.target.value) || 0 } })
          }
        />
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
            <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
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
            setDraft({ ...draft, overseas: { type: "fixed", amount: Number(e.target.value) || 0 } })
          }
        />
      </div>
      <p className="rounded-lg border border-[#d8ddd3] bg-[#f4f1eb] px-3 py-2 text-xs leading-5 text-slate-600">
        {describeShopCostRuleSet(draft)}
      </p>
      <button
        type="button"
        onClick={() => setDraft(cloneRuleSet(DEFAULT_SHOP_COST_RULES_CONFIG.general))}
        className={secondaryButtonClass}
      >
        恢复该货类为默认（美区常用）
      </button>
    </div>
  );
}

export function ShopCostRulesPanel({ shopId, shopName, shopReady, secondaryButtonClass, inputClass }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<CargoType>("general");
  const [draft, setDraft] = useState<ShopCostRulesConfig>(() => cloneRulesConfig(DEFAULT_SHOP_COST_RULES_CONFIG));
  const utils = trpc.useUtils();

  const rulesQuery = trpc.shops.getCostRules.useQuery(
    { shopId },
    { enabled: shopReady && open, staleTime: 30_000 },
  );

  const saveMutation = trpc.shops.updateCostRules.useMutation({
    onSuccess: async (saved) => {
      setDraft(cloneRulesConfig(saved));
      await utils.shops.getCostRules.invalidate({ shopId });
      toast.success("已保存本店普货/特货运费公式");
      setOpen(false);
    },
    onError: (e) => toast.error(e.message || "保存失败"),
  });

  useEffect(() => {
    if (rulesQuery.data) {
      setDraft(cloneRulesConfig(rulesQuery.data));
    }
  }, [rulesQuery.data]);

  const setRuleSet = (cargo: CargoType, next: ShopCostRuleSet) => {
    setDraft((prev) => ({ ...prev, [cargo]: next }));
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
            每个店铺可分别设置普货、特货两套公式；上新时选择货类后，头程/尾程/海外仓按对应规则自动计算。
          </DialogDescription>

          {rulesQuery.isLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载规则…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                {CARGO_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTab(opt.value)}
                    className={
                      tab === opt.value
                        ? "rounded-full bg-[#4f5f4e] px-4 py-1.5 text-sm text-white"
                        : "rounded-full border border-black/10 bg-white px-4 py-1.5 text-sm text-slate-700"
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <RuleSetEditor
                label={tab === "general" ? "普货公式" : "特货公式"}
                draft={draft[tab]}
                setDraft={(next) => setRuleSet(tab, next)}
                inputClass={inputClass}
                secondaryButtonClass={secondaryButtonClass}
              />

              <button
                type="button"
                disabled={saveMutation.isPending}
                onClick={() => void saveMutation.mutateAsync({ shopId, rules: draft })}
                className="w-full rounded-full bg-[#4f5f4e] px-5 py-2 text-sm text-white disabled:opacity-50"
              >
                {saveMutation.isPending ? <Loader2 className="inline h-4 w-4 animate-spin" /> : null}
                保存普货 + 特货到本店
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
