import { useEffect, useEffectEvent, useState } from 'react'
import { LogOut } from 'lucide-react'
import { EMPTY_CATALOG_DATA } from '../shared/catalog.js'
import { acceptTest, getTests, updateResult } from '../api/laboratory.js'
import TablePagination from './TablePagination.jsx'
import { getPageRows } from './tablePagination.js'

export default function TechnicianDashboard({ user, identityAccessToken, onLogout, onChangePassword, showNotification, catalogData = EMPTY_CATALOG_DATA }) {
  const [activeTab, setActiveTab] = useState('pending')
  const [pendingPage, setPendingPage] = useState(0)
  const [completedPage, setCompletedPage] = useState(0)
  const [paymentModal, setPaymentModal] = useState(null)
  const [resultModal, setResultModal] = useState(null)
  const [resultText, setResultText] = useState('')
  const [feedback, setFeedback] = useState('')
  const [labApiRows, setLabApiRows] = useState([])
  const [hasLoadedLabRows, setHasLoadedLabRows] = useState(true)
  const [labRowsLoading, setLabRowsLoading] = useState(false)
  const [labRowsError, setLabRowsError] = useState('')
  const [labActionLoading, setLabActionLoading] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const notify = (message, type = 'success') => {
    setFeedback(message)
    showNotification?.(message, type)
  }
  const [patients] = useState([])
  const [bookings] = useState([])
  const [visitRecords] = useState([])
  const [labDetails, setLabDetails] = useState([])
  const [technicianProfile] = useState({
    MaXNV: user?.MaXNV || user?.id || '',
    HoTen: user?.HoTen || user?.name || user?.id || 'Xét nghiệm viên',
    MaChiNhanh: user?.MaChiNhanh || '',
  })

  const effectiveBranches = catalogData?.branches || []
  const effectiveServices = catalogData?.services || []
  const effectiveBhytCategories = catalogData?.bhyt || []
  const allKnownServices = effectiveServices

  const maChiNhanh = technicianProfile.MaChiNhanh
  const currentBranch = effectiveBranches.find((branch) => branch.MaChiNhanh === maChiNhanh)
  const normalizeLabApiRow = (row) => {
    const giaGoc = Number(row.GiaGoc || 0)
    const bhytRate = Number(row.TyLeHuong || 0)
    const bhytAmount = Number(row.BHYTGiamTru || Math.round(giaGoc * bhytRate))
    const finalAmount = Number(row.GiaCuoi || row.GiaCuoiThucTra || Math.max(0, giaGoc - bhytAmount))

    return {
      lab: {
        MaChiTietXN: row.MaChiTietXN,
        MaLuotKham: row.MaLuotKham,
        MaDichVu: row.MaDichVu,
        PaymentToken: row.PaymentToken || '',
        GiaCuoi: finalAmount,
        KetQuaXetNghiem: row.KetQuaXetNghiem || '',
        MaXNV: row.MaXNV || '',
        TrangThaiXetNghiem: row.TrangThaiXetNghiem || 'Chưa thực hiện',
      },
      visit: {
        MaLuotKham: row.MaLuotKham,
        MaLichHen: row.MaLichHen,
        ChanDoanSoBo: row.TenBacSi ? `Chỉ định bởi ${row.TenBacSi}` : '',
      },
      booking: {
        MaLichHen: row.MaLichHen,
        MaBenhAn: row.MaBenhAn,
        MaChiNhanh: row.MaChiNhanh,
        NgayKham: row.NgayKham || '',
        CaKham: row.CaKham || '',
        MaBacSi: row.MaBacSi || '',
      },
      patient: {
        MaBenhAn: row.MaBenhAn,
        HoTen: row.HoTen || row.TenBenhNhan || 'Chưa rõ',
        CCCD: row.CCCD || '',
        SDT: row.SDT || '',
        KyTuDauBHYT: row.KyTuDauBHYT || '',
        BHYTVerified: Boolean(row.BHYTVerified),
      },
      service: {
        MaDichVu: row.MaDichVu,
        TenDichVu: row.TenDichVu || row.MaDichVu,
        GiaGoc: giaGoc,
      },
      bhytRate,
      bhytAmount,
      finalAmount,
    }
  }

  const loadLabRows = async () => {
    if (!maChiNhanh) return

    setLabRowsLoading(true)
    setLabRowsError('')

    try {
      const response = await getTests(maChiNhanh, identityAccessToken)
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể tải danh sách xét nghiệm.')
      }

      setLabApiRows(Array.isArray(result.data) ? result.data.map(normalizeLabApiRow) : [])
      setHasLoadedLabRows(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách xét nghiệm.'
      setLabRowsError(message)
      console.warn('LAB_ROWS_LOAD_FAILED', message)
    } finally {
      setLabRowsLoading(false)
    }
  }

  const onLoadLabRows = useEffectEvent(() => { void loadLabRows() })
  useEffect(() => {
    const timer = window.setTimeout(() => onLoadLabRows(), 0)
    return () => window.clearTimeout(timer)
  }, [maChiNhanh, identityAccessToken])

  const getPatient = (maBenhAn) =>
    patients.find((patient) => patient.MaBenhAn === maBenhAn) || {
      MaBenhAn: maBenhAn,
      HoTen: 'Chưa rõ',
      KyTuDauBHYT: '',
    }

  const getService = (maDichVu) =>
    allKnownServices.find((service) => service.MaDichVu === maDichVu) || {
      MaDichVu: maDichVu,
      TenDichVu: maDichVu,
      GiaGoc: 0,
    }

  const getVisit = (maLuotKham) => visitRecords.find((visit) => visit.MaLuotKham === maLuotKham)

  const getBooking = (maLichHen) => bookings.find((booking) => booking.MaLichHen === maLichHen)

  const getBhytRate = (patient) => patient.BHYTVerified
    ? effectiveBhytCategories.find((category) => category.KyTuDauBHYT === patient.KyTuDauBHYT)?.TyLeHuong || 0
    : 0

  const formatMoney = (value) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)

  const buildLabRows = () => {
    if (hasLoadedLabRows) {
      return labApiRows
    }

    return labDetails
      .map((lab) => {
        const visit = getVisit(lab.MaLuotKham)
        const booking = getBooking(visit?.MaLichHen)
        const patient = getPatient(booking?.MaBenhAn)
        const service = getService(lab.MaDichVu)
        const bhytRate = getBhytRate(patient)
        const bhytAmount = Math.round(service.GiaGoc * bhytRate)
        const finalAmount = Math.max(0, service.GiaGoc - bhytAmount)

        return {
          lab,
          visit,
          booking,
          patient,
          service,
          bhytRate,
          bhytAmount,
          finalAmount,
        }
      })
      .filter((row) => row.booking?.MaChiNhanh === maChiNhanh)
  }

  const labRows = buildLabRows()
  const currentTechnicianId = technicianProfile.MaXNV
  const pendingRows = labRows.filter((row) => row.lab.TrangThaiXetNghiem === 'Chưa thực hiện')
  const completedRows = labRows.filter(
    (row) =>
      row.lab.TrangThaiXetNghiem === 'Đã có kết quả' &&
      (!row.lab.MaXNV || row.lab.MaXNV === currentTechnicianId),
  )

  const handleOpenPayment = (row) => {
    setPaymentModal(row)
  }

  const handleConfirmPayment = async () => {
    if (!paymentModal) return

    setLabActionLoading(paymentModal.lab.MaChiTietXN)

    try {
      if (hasLoadedLabRows) {
        const formData = new FormData()
        formData.append('MaChiTietXN', paymentModal.lab.MaChiTietXN)
        formData.append('MaChiNhanh', maChiNhanh)

        const response = await acceptTest({
          method: 'POST',
          body: formData,
        }, identityAccessToken)
        const result = await response.json()

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || 'Không thể ghi nhận thanh toán xét nghiệm.')
        }

        const paymentToken = result.data?.PaymentToken || paymentModal.lab.PaymentToken
        const finalAmount = Number(result.data?.GiaCuoi || paymentModal.finalAmount)
        setLabApiRows((current) =>
          current.map((row) =>
            row.lab.MaChiTietXN === paymentModal.lab.MaChiTietXN
              ? {
                  ...row,
                  finalAmount,
                  lab: {
                    ...row.lab,
                    PaymentToken: paymentToken,
                    GiaCuoi: finalAmount,
                  },
                }
              : row,
          ),
        )
        notify(`Đã ghi nhận thanh toán ${paymentToken} cho ${paymentModal.service.TenDichVu}.`)
      } else {
        const paymentToken = `PAY_LAB_${Math.floor(100000 + Math.random() * 900000)}`
        setLabDetails((current) =>
          current.map((lab) =>
            lab.MaChiTietXN === paymentModal.lab.MaChiTietXN
              ? { ...lab, PaymentToken: paymentToken }
              : lab,
          ),
        )
        notify(`Đã ghi nhận thanh toán ${paymentToken} cho ${paymentModal.service.TenDichVu}.`)
      }

      setPaymentModal(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể ghi nhận thanh toán xét nghiệm.'
      notify(message, 'error')
    } finally {
      setLabActionLoading('')
    }
  }

  const handleOpenResultModal = (row) => {
    setResultModal(row)
    setResultText(row.lab.KetQuaXetNghiem || '')
  }

  const handleCloseResultModal = () => {
    setResultModal(null)
    setResultText('')
  }

  const handleSaveResult = async () => {
    if (!resultModal) return

    const trimmedResult = resultText.trim()
    if (!trimmedResult) {
      notify('Vui lòng nhập nội dung kết quả xét nghiệm.', 'error')
      return
    }

    setLabActionLoading(resultModal.lab.MaChiTietXN)

    try {
      if (hasLoadedLabRows) {
        const formData = new FormData()
        formData.append('MaChiTietXN', resultModal.lab.MaChiTietXN)
        formData.append('KetQuaXetNghiem', trimmedResult)
        formData.append('MaXNV', currentTechnicianId)
        formData.append('MaChiNhanh', maChiNhanh)

        const response = await updateResult({
          method: 'POST',
          body: formData,
        }, identityAccessToken)
        const result = await response.json()

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || 'Không thể cập nhật kết quả xét nghiệm.')
        }

        setLabApiRows((current) =>
          current.map((row) =>
            row.lab.MaChiTietXN === resultModal.lab.MaChiTietXN
              ? {
                  ...row,
                  lab: {
                    ...row.lab,
                    KetQuaXetNghiem: trimmedResult,
                    MaXNV: currentTechnicianId,
                    TrangThaiXetNghiem: 'Đã có kết quả',
                  },
                }
              : row,
          ),
        )
      } else {
        setLabDetails((current) =>
          current.map((lab) =>
            lab.MaChiTietXN === resultModal.lab.MaChiTietXN
              ? {
                  ...lab,
                  KetQuaXetNghiem: trimmedResult,
                  MaXNV: currentTechnicianId,
                  TrangThaiXetNghiem: 'Đã có kết quả',
                }
              : lab,
          ),
        )
      }

      notify(`Đã trả kết quả xét nghiệm cho lượt khám ${resultModal.lab.MaLuotKham}.`)
      setActiveTab('completed')
      handleCloseResultModal()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể cập nhật kết quả xét nghiệm.'
      notify(message, 'error')
    } finally {
      setLabActionLoading('')
    }
  }

  const handlePasswordFormChange = (field, value) => {
    setPasswordForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleCancelPasswordChange = () => {
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    })
    setShowPasswordForm(false)
  }

  const handleChangePassword = async (event) => {
    event.preventDefault()
    if (passwordForm.newPassword.length < 6) {
      notify('Mật khẩu mới phải có ít nhất 6 ký tự.', 'error')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      notify('Mật khẩu mới và xác nhận mật khẩu không khớp.', 'error')
      return
    }

    try {
      await onChangePassword(passwordForm.currentPassword, passwordForm.newPassword)
      handleCancelPasswordChange()
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Không đổi được mật khẩu.', 'error')
    }
  }

  return (
    <main className="technician-shell">
      <header className="technician-topbar">
        <div>
          <span className="technician-kicker">Medicare Laboratory</span>
          <h1>TRUNG TÂM XÉT NGHIỆM & CHẨN ĐOÁN HÌNH ẢNH - Medicare {currentBranch?.TenChiNhanh || 'Chưa có chi nhánh'}</h1>
          <p>
            Xét nghiệm viên: <strong>{technicianProfile.HoTen}</strong> · Mã tài khoản:{' '}
            <strong>{technicianProfile.MaXNV}</strong> · Chi nhánh:{' '}
            <strong>{currentBranch?.MaChiNhanh || 'Chưa có chi nhánh'}</strong>
          </p>
        </div>
        <button type="button" className="technician-logout-button" onClick={onLogout}>
          <LogOut size={18} />
          Đăng xuất
        </button>
      </header>

      {feedback && <p className="technician-feedback">{feedback}</p>}
      {labRowsLoading && <p className="technician-feedback">Đang tải chỉ định xét nghiệm từ hệ thống...</p>}
      {labRowsError && <p className="technician-feedback">{labRowsError}</p>}

      <section className="technician-card">
        <div className="technician-section-header">
          <div>
            <h2>Quản lý chỉ định cận lâm sàng</h2>
            <p>Dữ liệu được lọc theo chi nhánh của lượt khám gốc và tính giá cuối sau giảm trừ BHYT tại chỗ.</p>
          </div>
          <div className="technician-tab-row">
            <button
              type="button"
              className={activeTab === 'pending' ? 'active' : ''}
              onClick={() => setActiveTab('pending')}
            >
              Chỉ định chờ thực hiện ({pendingRows.length})
            </button>
            <button
              type="button"
              className={activeTab === 'completed' ? 'active' : ''}
              onClick={() => setActiveTab('completed')}
            >
              Nhật ký đã trả kết quả ({completedRows.length})
            </button>
            <button
              type="button"
              className={activeTab === 'account' ? 'active' : ''}
              onClick={() => setActiveTab('account')}
            >
              Cài đặt tài khoản
            </button>
          </div>
        </div>

        {activeTab === 'pending' ? (
          <>
          <div className="technician-table-wrap">
            <table className="technician-table">
              <thead>
                <tr>
                  <th>Mã lượt khám</th>
                  <th>Họ tên bệnh nhân</th>
                  <th>Tên dịch vụ</th>
                  <th>Giá gốc</th>
                  <th>BHYT giảm trừ</th>
                  <th>Giá cuối thực trả</th>
                  <th>Trạng thái thanh toán</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {getPageRows(pendingRows, pendingPage).map((row) => (
                  <tr key={row.lab.MaChiTietXN}>
                    <td>
                      <strong>{row.lab.MaLuotKham}</strong>
                      <span>{row.visit?.ChanDoanSoBo}</span>
                    </td>
                    <td>
                      <strong>{row.patient.HoTen}</strong>
                      <span>{row.patient.MaBenhAn}</span>
                    </td>
                    <td>{row.service.TenDichVu}</td>
                    <td>{formatMoney(row.service.GiaGoc)}</td>
                    <td>
                      {formatMoney(row.bhytAmount)}
                      <span>{Math.round(row.bhytRate * 100)}%</span>
                    </td>
                    <td>
                      <strong>{formatMoney(row.finalAmount)}</strong>
                    </td>
                    <td>
                      <span className={`technician-payment-pill ${row.lab.PaymentToken ? 'paid' : 'unpaid'}`}>
                        {row.lab.PaymentToken ? 'Đã thanh toán' : 'Chưa thanh toán'}
                      </span>
                      {row.lab.PaymentToken && <small>{row.lab.PaymentToken}</small>}
                    </td>
                    <td>
                      {row.lab.PaymentToken ? (
                        <button
                          type="button"
                          className="technician-primary-button compact"
                          disabled={labActionLoading === row.lab.MaChiTietXN}
                          onClick={() => handleOpenResultModal(row)}
                        >
                          {labActionLoading === row.lab.MaChiTietXN ? 'Đang xử lý...' : 'Nhập kết quả'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="technician-pay-button compact"
                          disabled={labActionLoading === row.lab.MaChiTietXN}
                          onClick={() => handleOpenPayment(row)}
                        >
                          {labActionLoading === row.lab.MaChiTietXN ? 'Đang xử lý...' : 'Ghi nhận thanh toán'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {pendingRows.length === 0 && (
                  <tr>
                    <td colSpan="8" className="technician-empty-cell">
                      Không còn chỉ định chờ thực hiện tại chi nhánh này.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination page={pendingPage} total={pendingRows.length} label="chỉ định" onPageChange={setPendingPage} />
          </>
        ) : activeTab === 'completed' ? (
          <>
          <div className="technician-table-wrap">
            <table className="technician-table technician-result-table">
              <thead>
                <tr>
                  <th>Mã lượt khám</th>
                  <th>Họ tên bệnh nhân</th>
                  <th>Tên dịch vụ</th>
                  <th>Nội dung kết quả đã trả</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {getPageRows(completedRows, completedPage).map((row) => (
                  <tr key={row.lab.MaChiTietXN}>
                    <td>
                      <strong>{row.lab.MaLuotKham}</strong>
                      <span>{row.booking?.NgayKham}</span>
                    </td>
                    <td>
                      <strong>{row.patient.HoTen}</strong>
                      <span>{row.patient.MaBenhAn}</span>
                    </td>
                    <td>{row.service.TenDichVu}</td>
                    <td className="technician-result-text">{row.lab.KetQuaXetNghiem}</td>
                    <td>
                      <button
                        type="button"
                        className="technician-secondary-button compact"
                        disabled={labActionLoading === row.lab.MaChiTietXN}
                        onClick={() => handleOpenResultModal(row)}
                      >
                        {labActionLoading === row.lab.MaChiTietXN ? 'Đang xử lý...' : 'Sửa kết quả'}
                      </button>
                    </td>
                  </tr>
                ))}
                {completedRows.length === 0 && (
                  <tr>
                    <td colSpan="5" className="technician-empty-cell">
                      Chưa có kết quả nào do tài khoản này trả trong ngày hôm nay.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination page={completedPage} total={completedRows.length} label="kết quả" onPageChange={setCompletedPage} />
          </>
        ) : (
          <div className="technician-account-panel">
            <section className="technician-profile-summary">
              <div>
                <span>Mã XNV</span>
                <strong>{technicianProfile.MaXNV}</strong>
              </div>
              <div>
                <span>Họ tên</span>
                <strong>{technicianProfile.HoTen}</strong>
              </div>
              <div>
                <span>Chi nhánh phụ trách</span>
                <strong>
                  {currentBranch?.TenChiNhanh || 'Chưa có chi nhánh'} ({currentBranch?.MaChiNhanh || '—'})
                </strong>
              </div>
            </section>

            <div className="technician-account-actions">
              <button
                type="button"
                className="technician-primary-button"
                onClick={() => setShowPasswordForm((current) => !current)}
              >
                🔑 Đổi mật khẩu
              </button>
              {showPasswordForm && (
                <form className="technician-password-form" onSubmit={handleChangePassword}>
                  <label>
                    Mật khẩu hiện tại
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(event) => handlePasswordFormChange('currentPassword', event.target.value)}
                      placeholder="Nhập mật khẩu hiện tại"
                    />
                  </label>
                  <label>
                    Mật khẩu mới
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(event) => handlePasswordFormChange('newPassword', event.target.value)}
                      placeholder="Nhập mật khẩu mới"
                    />
                  </label>
                  <label>
                    Xác nhận mật khẩu mới
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(event) => handlePasswordFormChange('confirmPassword', event.target.value)}
                      placeholder="Nhập lại mật khẩu mới"
                    />
                  </label>
                  <div className="technician-password-actions">
                    <button type="submit" className="technician-primary-button">
                      Lưu mật khẩu mới
                    </button>
                    <button type="button" className="technician-secondary-button" onClick={handleCancelPasswordChange}>
                      Hủy bỏ
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </section>

      {paymentModal && (
        <div className="technician-modal-overlay">
          <section className="technician-payment-modal">
            <button
              type="button"
              className="technician-modal-close"
              onClick={() => setPaymentModal(null)}
              disabled={labActionLoading === paymentModal.lab.MaChiTietXN}
              aria-label="Đóng modal thanh toán"
            >
              ×
            </button>
            <span className="technician-kicker">Thanh toán phòng xét nghiệm</span>
            <h2>Ghi nhận thanh toán xét nghiệm</h2>
            <div className="technician-invoice-grid">
              <span>Bệnh nhân</span>
              <strong>{paymentModal.patient.HoTen}</strong>
              <span>Dịch vụ</span>
              <strong>{paymentModal.service.TenDichVu}</strong>
              <span>Giá gốc</span>
              <strong>{formatMoney(paymentModal.service.GiaGoc)}</strong>
              <span>BHYT giảm</span>
              <strong>{formatMoney(paymentModal.bhytAmount)}</strong>
              <span>Giá cuối thực trả</span>
              <strong>{formatMoney(paymentModal.finalAmount)}</strong>
            </div>
            <p className="technician-payment-note">Thao tác này ghi nhận thanh toán trong hệ thống, không thực hiện chuyển tiền qua ngân hàng.</p>
            <button
              type="button"
              className="technician-pay-button"
              onClick={handleConfirmPayment}
              disabled={labActionLoading === paymentModal.lab.MaChiTietXN}
            >
              {labActionLoading === paymentModal.lab.MaChiTietXN ? 'Đang xác nhận...' : 'Xác nhận ghi nhận thanh toán'}
            </button>
          </section>
        </div>
      )}

      {resultModal && (
        <div className="technician-modal-overlay">
          <section className="technician-result-modal">
            <button
              type="button"
              className="technician-modal-close"
              onClick={handleCloseResultModal}
              disabled={labActionLoading === resultModal.lab.MaChiTietXN}
              aria-label="Đóng form nhập kết quả"
            >
              ×
            </button>
            <span className="technician-kicker">Cập nhật kết quả</span>
            <h2>Cập nhật kết quả cận lâm sàng - Bệnh nhân {resultModal.patient.HoTen}</h2>
            <div className="technician-result-summary">
              <span>{resultModal.lab.MaLuotKham}</span>
              <strong>{resultModal.service.TenDichVu}</strong>
            </div>
            <textarea
              value={resultText}
              onChange={(event) => setResultText(event.target.value)}
              placeholder="Nhập kết quả chi tiết bằng văn bản (Ví dụ: Bạch cầu trong giới hạn bình thường, hình ảnh siêu âm gan thô...)."
              autoFocus
            />
            <div className="technician-result-actions">
              <button
                type="button"
                className="technician-primary-button"
                onClick={handleSaveResult}
                disabled={labActionLoading === resultModal.lab.MaChiTietXN}
              >
                {labActionLoading === resultModal.lab.MaChiTietXN ? 'Đang lưu...' : 'Xác nhận & Trả kết quả'}
              </button>
              <button
                type="button"
                className="technician-secondary-button"
                onClick={handleCloseResultModal}
                disabled={labActionLoading === resultModal.lab.MaChiTietXN}
              >
                Hủy bỏ
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
