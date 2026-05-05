import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

const LS_KEY = "product-listing-tracker.selectedShopId";

function readStored(): string | null {
  try {
    const v = localStorage.getItem(LS_KEY)?.trim();
    return v || null;
  } catch {
    return null;
  }
}

function writeStored(id: string) {
  try {
    localStorage.setItem(LS_KEY, id);
  } catch {
    /* ignore */
  }
}

/**
 * 当前选中的店铺（上新 / 在售共用 localStorage，切换后列表按 shopId 拉取）。
 */
export function useSelectedShop() {
  const shopsQuery = trpc.shops.list.useQuery(undefined, { staleTime: 30_000 });
  const [shopId, setShopIdState] = useState<string>("");
  const shops = shopsQuery.data ?? [];

  useEffect(() => {
    if (!shopsQuery.isSuccess || shops.length === 0) {
      return;
    }
    const stored = readStored();
    const matchStored = Boolean(stored && shops.some((s) => s.id === stored));
    if (matchStored && stored) {
      if (stored !== shopId) {
        setShopIdState(stored);
      }
      return;
    }
    if (stored && !matchStored) {
      writeStored("");
    }
    if (!shopId || !shops.some((s) => s.id === shopId)) {
      const next = shops[0]?.id ?? "";
      if (next) {
        setShopIdState(next);
        writeStored(next);
      }
    }
  }, [shopsQuery.isSuccess, shops, shopId]);

  const setShopId = (id: string) => {
    setShopIdState(id);
    writeStored(id);
  };

  const ready = shopsQuery.isSuccess && shops.length > 0 && Boolean(shopId) && shops.some((s) => s.id === shopId);

  return {
    shops,
    shopId,
    setShopId,
    shopsQuery,
    ready,
  };
}
