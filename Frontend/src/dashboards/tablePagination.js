export const TABLE_PAGE_SIZE = 10

export function getCurrentPage(page, total, pageSize = TABLE_PAGE_SIZE) {
  return Math.min(page, Math.max(0, Math.ceil(total / pageSize) - 1))
}

export function getPageRows(rows, page, pageSize = TABLE_PAGE_SIZE) {
  const currentPage = getCurrentPage(page, rows.length, pageSize)
  return rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
}
