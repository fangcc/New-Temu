import { Loader2, PackagePlus } from "lucide-react";

type Shop = { id: string; name: string };

type Props = {
  secondaryButtonClass: string;
  shopId: string;
  shops: Shop[];
  shopsLoading: boolean;
  onShopChange: (id: string) => void;
  onCreateShop: () => void;
  createPending: boolean;
};

export function ShopToolbar({
  secondaryButtonClass,
  shopId,
  shops,
  shopsLoading,
  onShopChange,
  onCreateShop,
  createPending,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.75rem] border border-black/6 bg-white/80 px-4 py-3 shadow-[0_8px_24px_rgba(30,23,15,0.04)]">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-[0.2em] text-slate-500">当前店铺</span>
        {shopsLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        ) : shops.length === 0 ? (
          <span className="text-sm text-amber-800">暂无店铺。请执行数据库迁移 0005，或点击「新建店铺」。</span>
        ) : (
          <select
            value={shopId}
            onChange={(e) => onShopChange(e.target.value)}
            className="min-w-[12rem] rounded-full border border-black/10 bg-[#fbfaf7] px-4 py-2 text-sm text-slate-800 outline-none focus:border-[#798a79]"
          >
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <button
        type="button"
        onClick={onCreateShop}
        disabled={createPending || shopsLoading}
        className={secondaryButtonClass + " disabled:cursor-not-allowed disabled:opacity-50"}
      >
        {createPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
        新建店铺
      </button>
    </div>
  );
}
