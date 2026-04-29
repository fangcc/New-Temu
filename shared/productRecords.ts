export type ProductRecordForCode = {
  id: string;
  listingDate: string;
  createdAt: string;
};

export function formatRecordCodeDate(listingDate: string) {
  const [year = "", month = "", day = ""] = listingDate.split("-");
  return `${year.slice(-2)}${month}${day}`;
}

export function buildRecordCodeMap(records: ProductRecordForCode[]) {
  const groups = new Map<string, ProductRecordForCode[]>();

  records.forEach((record) => {
    const current = groups.get(record.listingDate) ?? [];
    current.push(record);
    groups.set(record.listingDate, current);
  });

  const codeMap: Record<string, string> = {};

  groups.forEach((group, listingDate) => {
    const sortedGroup = [...group].sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    sortedGroup.forEach((record, index) => {
      codeMap[record.id] = `${formatRecordCodeDate(listingDate)}-${String(index + 1).padStart(3, "0")}`;
    });
  });

  return codeMap;
}

export const RECORDS_PER_PAGE = 5;

export function getSafePage(totalItems: number, pageSize: number, requestedPage: number) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return Math.min(Math.max(1, requestedPage), totalPages);
}

export function paginateRecords<T>(items: T[], currentPage: number, pageSize: number) {
  const safePage = getSafePage(items.length, pageSize, currentPage);
  const startIndex = (safePage - 1) * pageSize;

  return {
    currentPage: safePage,
    totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
    pageItems: items.slice(startIndex, startIndex + pageSize),
  };
}

export function buildPaginationNumbers(totalPages: number, currentPage: number) {
  if (totalPages <= 1) {
    return [1];
  }

  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const pages = new Set<number>([1, totalPages, safePage, safePage - 1, safePage + 1]);

  return Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
}

export function shouldShowPagination(totalItems: number, pageSize: number) {
  return totalItems > pageSize;
}

export function getPaginationSummary(totalItems: number, pageSize: number, currentPage: number) {
  const safePage = getSafePage(totalItems, pageSize, currentPage);
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = totalItems === 0 ? 0 : Math.min(totalItems, safePage * pageSize);

  return {
    start,
    end,
    currentPage: safePage,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
  };
}

export function shouldRenderPaginationEllipsis(previousPage: number, nextPage: number) {
  return nextPage - previousPage > 1;
}

export function getPageLabel(page: number) {
  return `第 ${page} 页`;
}

export function getRecordPaginationState<T>(items: T[], currentPage: number, pageSize: number) {
  const { pageItems, totalPages, currentPage: safePage } = paginateRecords(items, currentPage, pageSize);
  const numbers = buildPaginationNumbers(totalPages, safePage);
  const summary = getPaginationSummary(items.length, pageSize, safePage);

  return {
    pageItems,
    totalPages,
    currentPage: safePage,
    numbers,
    summary,
    showPagination: shouldShowPagination(items.length, pageSize),
  };
}
