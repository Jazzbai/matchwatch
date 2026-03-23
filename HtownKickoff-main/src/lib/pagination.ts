export const ITEMS_PER_PAGE = 12;

export function getTotalPages(totalItems: number, pageSize = ITEMS_PER_PAGE) {
  const safeTotal = Number.isFinite(totalItems) ? Math.max(0, totalItems) : 0;
  return Math.max(1, Math.ceil(safeTotal / pageSize));
}

export function clampPage(page: number, totalPages: number) {
  const safePage = Number.isFinite(page) ? Math.floor(page) : 1;
  return Math.min(Math.max(safePage, 1), Math.max(totalPages, 1));
}

export function parsePageParam(value: string | null | undefined) {
  if (!value) return 1;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

export function paginateItems<T>(items: T[], page: number, pageSize = ITEMS_PER_PAGE) {
  const totalPages = getTotalPages(items.length, pageSize);
  const currentPage = clampPage(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;

  return {
    currentPage,
    totalPages,
    pageItems: items.slice(startIndex, startIndex + pageSize),
  };
}
