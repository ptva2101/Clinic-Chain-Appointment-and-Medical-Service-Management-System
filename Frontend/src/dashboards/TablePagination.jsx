import { getCurrentPage, TABLE_PAGE_SIZE } from './tablePagination.js'

export default function TablePagination({ page, total, label, onPageChange, disabled = false, pageSize = TABLE_PAGE_SIZE }) {
  if (total <= 0) return null

  const currentPage = getCurrentPage(page, total, pageSize)
  return (
    <div className="admin-patient-pagination">
      <span>Hiển thị {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, total)} / {total} {label}</span>
      <div className="admin-actions-row">
        <button type="button" className="admin-secondary-button" disabled={disabled || currentPage === 0} onClick={() => onPageChange(currentPage - 1)}>Trang trước</button>
        <button type="button" className="admin-secondary-button" disabled={disabled || (currentPage + 1) * pageSize >= total} onClick={() => onPageChange(currentPage + 1)}>Trang sau</button>
      </div>
    </div>
  )
}
