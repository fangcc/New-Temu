import { describe, expect, it } from "vitest";
import {
  buildPaginationNumbers,
  buildRecordCodeMap,
  formatRecordCodeDate,
  getRecordPaginationState,
  RECORDS_PER_PAGE,
} from "./productRecords";

describe("product record code helpers", () => {
  it("formats listing date as yymmdd", () => {
    expect(formatRecordCodeDate("2026-04-15")).toBe("260415");
  });

  it("assigns increasing codes by listing date and creation order", () => {
    const codeMap = buildRecordCodeMap([
      {
        id: "latest-same-day",
        listingDate: "2026-04-15",
        createdAt: "2026-04-15T09:30:00.000Z",
      },
      {
        id: "first-same-day",
        listingDate: "2026-04-15",
        createdAt: "2026-04-15T08:00:00.000Z",
      },
      {
        id: "another-day",
        listingDate: "2026-04-14",
        createdAt: "2026-04-14T10:00:00.000Z",
      },
    ]);

    expect(codeMap["first-same-day"]).toBe("260415-001");
    expect(codeMap["latest-same-day"]).toBe("260415-002");
    expect(codeMap["another-day"]).toBe("260414-001");
  });
});

describe("product record pagination helpers", () => {
  it("splits records into pages of five and keeps the second page items", () => {
    const items = Array.from({ length: RECORDS_PER_PAGE + 2 }, (_, index) => ({ id: index + 1 }));
    const state = getRecordPaginationState(items, 2, RECORDS_PER_PAGE);

    expect(state.totalPages).toBe(2);
    expect(state.currentPage).toBe(2);
    expect(state.pageItems).toEqual([{ id: 6 }, { id: 7 }]);
    expect(state.summary).toMatchObject({ start: 6, end: 7, totalPages: 2 });
    expect(state.showPagination).toBe(true);
  });

  it("builds a compact pagination number set around the current page", () => {
    expect(buildPaginationNumbers(6, 4)).toEqual([1, 3, 4, 5, 6]);
    expect(buildPaginationNumbers(10, 1)).toEqual([1, 2, 10]);
  });
});
