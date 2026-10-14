import { useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import { EMPTY_CATALOG_DATA } from '../shared/catalog.js'
import { acceptTest, getTests, updateResult } from '../api/laboratory.js'
import TablePagination from './TablePagination.jsx'
import { getPageRows } from './tablePagination.js'

export default function TechnicianDashboard({ user, onLogout, onChangePassword, showNotification, catalogData = EMPTY_CATALOG_DATA }) {
  const [activeTab, setActiveTab] = useState('pending')
  const [pendingPage, setPendingPage] = useState(0)
  const [completedPage, setCompletedPage] = useState(0)
  const [paymentModal, setPaymentModal] = useState(null)
  const [resultModal, setResultModal] = useState(null)
  const [resultText, setResultText] = useState('')
  const [feedback, setFeedback] = useState('')
  const [labApiRows, setLabApiRows] = useState([])
  const [hasLoadedLabRows, setHasLoadedLabRows] = useState(false)
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
  const [branches] = useState([
    {
      MaChiNhanh: 'CN_CG',
      TenChiNhanh: 'Medicare - Cơ sở Cầu Giấy',
      DiaChi: 'Số 1 Dịch Vọng Hậu, Cầu Giấy, Hà Nội',
    },
    {
      MaChiNhanh: 'CN_HBT',
      TenChiNhanh: 'Medicare - Cơ sở Hai Bà Trưng',
      DiaChi: 'Số 99 Đại Cồ Việt, Hai Bà Trưng, Hà Nội',
    },
  ])
  const [patients] = useState([
    {
      MaBenhAn: 'BN001',
      HoTen: 'Trần Quang Hải',
      CCCD: '001095012345',
      SDT: '0901234567',
      KyTuDauBHYT: 'DN',
    },
    {
      MaBenhAn: 'BN002',
      HoTen: 'Nguyễn Thị Mai',
      CCCD: '001200054321',
      SDT: '0907654321',
      KyTuDauBHYT: '',
    },
    {
      MaBenhAn: 'BN003',
      HoTen: 'Phạm Lê Minh',
      CCCD: '001221098765',
      SDT: '0911999888',
      KyTuDauBHYT: 'TE',
    },
    {
      MaBenhAn: 'BN004',
      HoTen: 'Lê Hoàng Nam',
      CCCD: '001186000004',
      SDT: '0904000004',
      KyTuDauBHYT: 'DN',
    },
    {
      MaBenhAn: 'BN005',
      HoTen: 'Đỗ Minh Châu',
      CCCD: '001187000005',
      SDT: '0905000005',
      KyTuDauBHYT: '',
    },
    {
      MaBenhAn: 'BN006',
      HoTen: 'Vũ Gia Hân',
      CCCD: '001188000006',
      SDT: '0906000006',
      KyTuDauBHYT: 'HT',
    },
  ])
  const [services] = useState([
    { MaDichVu: 'DV_KHAM_NOI', TenDichVu: 'Khám Nội Tổng Quát', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 150000 },
    { MaDichVu: 'DV_KHAM_TMH', TenDichVu: 'Khám Tai Mũi Họng Thông Thường', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 180000 },
    { MaDichVu: 'DV_KHAM_RANG', TenDichVu: 'Khám Răng Hàm Mặt Định Kỳ', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 200000 },
    { MaDichVu: 'XN_MAU', TenDichVu: 'Xét Nghiệm Công Thức Máu 24 Chỉ Số', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 250000 },
    { MaDichVu: 'SA_O_BUNG', TenDichVu: 'Siêu Âm Ổ Bụng Tổng Quát', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 300000 },
    { MaDichVu: 'XN_NUOC_TIEU', TenDichVu: 'Xét Nghiệm Nước Tiểu Toàn Bộ (10 Thông Số)', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 120000 },
    { MaDichVu: 'XN_SINH_HOA', TenDichVu: 'Xét Nghiệm Sinh Hóa Máu (Gan, Thận, Mỡ Máu)', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 350000 },
    { MaDichVu: 'XN_DUONG_HUYET', TenDichVu: 'Xét Nghiệm Đường Huyết Nhanh', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 80000 },
  ])
  const [bookings] = useState([
    {
      MaLichHen: 'LH_LAB_001',
      MaBenhAn: 'BN001',
      MaDichVu: 'DV_KHAM_NOI',
      MaChiNhanh: 'CN_CG',
      NgayKham: '2026-05-31',
      CaKham: 1,
      MaBacSi: 'BS001',
      TrangThai: 'Đang khám',
    },
    {
      MaLichHen: 'LH_LAB_002',
      MaBenhAn: 'BN003',
      MaDichVu: 'DV_KHAM_RANG',
      MaChiNhanh: 'CN_CG',
      NgayKham: '2026-05-31',
      CaKham: 2,
      MaBacSi: 'BS002',
      TrangThai: 'Đang khám',
    },
    {
      MaLichHen: 'LH_LAB_003',
      MaBenhAn: 'BN004',
      MaDichVu: 'DV_KHAM_TMH',
      MaChiNhanh: 'CN_CG',
      NgayKham: '2026-05-31',
      CaKham: 3,
      MaBacSi: 'BS003',
      TrangThai: 'Đang khám',
    },
    {
      MaLichHen: 'LH_LAB_004',
      MaBenhAn: 'BN002',
      MaDichVu: 'DV_KHAM_TMH',
      MaChiNhanh: 'CN_HBT',
      NgayKham: '2026-05-31',
      CaKham: 1,
      MaBacSi: 'BS015',
      TrangThai: 'Đang khám',
    },
    {
      MaLichHen: 'LH_LAB_005',
      MaBenhAn: 'BN005',
      MaDichVu: 'DV_KHAM_NOI',
      MaChiNhanh: 'CN_HBT',
      NgayKham: '2026-05-31',
      CaKham: 2,
      MaBacSi: 'BS016',
      TrangThai: 'Đang khám',
    },
    {
      MaLichHen: 'LH_LAB_006',
      MaBenhAn: 'BN006',
      MaDichVu: 'DV_KHAM_NOI',
      MaChiNhanh: 'CN_CG',
      NgayKham: '2026-05-31',
      CaKham: 4,
      MaBacSi: 'BS004',
      TrangThai: 'Đang khám',
    },
  ])
  const [visitRecords] = useState([
    { MaLuotKham: 'LK_001', MaLichHen: 'LH_LAB_001', ChanDoanSoBo: 'Theo dõi thiếu máu, đau thượng vị' },
    { MaLuotKham: 'LK_002', MaLichHen: 'LH_LAB_002', ChanDoanSoBo: 'Đau răng, cần kiểm tra chỉ số viêm' },
    { MaLuotKham: 'LK_003', MaLichHen: 'LH_LAB_003', ChanDoanSoBo: 'Viêm mũi xoang, cần xét nghiệm máu' },
    { MaLuotKham: 'LK_004', MaLichHen: 'LH_LAB_004', ChanDoanSoBo: 'Theo dõi viêm đường hô hấp' },
    { MaLuotKham: 'LK_005', MaLichHen: 'LH_LAB_005', ChanDoanSoBo: 'Tầm soát chuyển hóa' },
    { MaLuotKham: 'LK_006', MaLichHen: 'LH_LAB_006', ChanDoanSoBo: 'Đánh giá chức năng gan thận' },
  ])
  const [labDetails, setLabDetails] = useState([
    {
      MaChiTietXN: 'CTXN_001',
      MaLuotKham: 'LK_001',
      MaDichVu: 'XN_MAU',
      PaymentToken: null,
      KetQuaXetNghiem: '',
      MaXNV: '',
      TrangThaiXetNghiem: 'Chưa thực hiện',
    },
    {
      MaChiTietXN: 'CTXN_002',
      MaLuotKham: 'LK_001',
      MaDichVu: 'SA_O_BUNG',
      PaymentToken: 'PAY_LAB_100002',
      KetQuaXetNghiem: '',
      MaXNV: '',
      TrangThaiXetNghiem: 'Chưa thực hiện',
    },
    {
      MaChiTietXN: 'CTXN_003',
      MaLuotKham: 'LK_002',
      MaDichVu: 'XN_MAU',
      PaymentToken: null,
      KetQuaXetNghiem: '',
      MaXNV: '',
      TrangThaiXetNghiem: 'Chưa thực hiện',
    },
    {
      MaChiTietXN: 'CTXN_004',
      MaLuotKham: 'LK_003',
      MaDichVu: 'XN_SINH_HOA',
      PaymentToken: null,
      KetQuaXetNghiem: '',
      MaXNV: '',
      TrangThaiXetNghiem: 'Chưa thực hiện',
    },
    {
      MaChiTietXN: 'CTXN_005',
      MaLuotKham: 'LK_004',
      MaDichVu: 'XN_NUOC_TIEU',
      PaymentToken: null,
      KetQuaXetNghiem: '',
      MaXNV: '',
      TrangThaiXetNghiem: 'Chưa thực hiện',
    },
    {
      MaChiTietXN: 'CTXN_006',
      MaLuotKham: 'LK_005',
      MaDichVu: 'XN_DUONG_HUYET',
      PaymentToken: 'PAY_LAB_100006',
      KetQuaXetNghiem: 'Glucose máu mao mạch 5.8 mmol/L.',
      MaXNV: 'XNV002',
      TrangThaiXetNghiem: 'Đã có kết quả',
    },
    {
      MaChiTietXN: 'CTXN_007',
      MaLuotKham: 'LK_006',
      MaDichVu: 'XN_SINH_HOA',
      PaymentToken: null,
      KetQuaXetNghiem: '',
      MaXNV: '',
      TrangThaiXetNghiem: 'Chưa thực hiện',
    },
    {
      MaChiTietXN: 'CTXN_008',
      MaLuotKham: 'LK_003',
      MaDichVu: 'XN_DUONG_HUYET',
      PaymentToken: 'PAY_LAB_100008',
      KetQuaXetNghiem: 'Glucose máu nhanh 5.4 mmol/L, trong giới hạn bình thường.',
      MaXNV: 'XNV001',
      TrangThaiXetNghiem: 'Đã có kết quả',
    },
  ])
  const bhytCategories = [
    { KyTuDauBHYT: 'TE', DoiTuongChinhSach: 'Trẻ em dưới 6 tuổi', TyLeHuong: 1 },
    { KyTuDauBHYT: 'HT', DoiTuongChinhSach: 'Cán bộ Hưu trí', TyLeHuong: 0.95 },
    { KyTuDauBHYT: 'DN', DoiTuongChinhSach: 'Người lao động doanh nghiệp', TyLeHuong: 0.8 },
  ]
  const [technicianProfile] = useState({
    MaXNV: user?.MaXNV || user?.id || 'XNV001',
    HoTen: user?.HoTen || user?.name || user?.id || 'Xét nghiệm viên',
    MaChiNhanh: user?.MaChiNhanh || 'CN_CG',
  })

  const effectiveBranches = catalogData?.branches || []
  const effectiveServices = catalogData?.services || []
	  const effectiveBhytCategories = catalogData?.bhyt?.length ? catalogData.bhyt : bhytCategories
  const allKnownServices = effectiveServices

  const maChiNhanh = effectiveBranches.some((branch) => branch.MaChiNhanh === technicianProfile.MaChiNhanh)
    ? technicianProfile.MaChiNhanh
    : effectiveBranches[0]?.MaChiNhanh || ''
  const currentBranch = effectiveBranches.find((branch) => branch.MaChiNhanh === maChiNhanh) || effectiveBranches[0]
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
      const response = await getTests(maChiNhanh)
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

  useEffect(() => {
    loadLabRows()
  }, [maChiNhanh])

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

  const getBhytRate = (patient) =>
    effectiveBhytCategories.find((category) => category.KyTuDauBHYT === patient.KyTuDauBHYT)?.TyLeHuong || 0

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
  const currentTechnicianId = technicianProfile.MaXNV || 'XNV001'
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
        })
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
        })
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
          <h1>TRUNG TÂM XÉT NGHIỆM & CHẨN ĐOÁN HÌNH ẢNH - Medicare {currentBranch.TenChiNhanh}</h1>
          <p>
            Xét nghiệm viên: <strong>{technicianProfile.HoTen}</strong> · Mã tài khoản:{' '}
            <strong>{technicianProfile.MaXNV}</strong> · Chi nhánh:{' '}
            <strong>{currentBranch.MaChiNhanh}</strong>
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
                          {labActionLoading === row.lab.MaChiTietXN ? 'Đang xử lý...' : 'Quét QR Thanh toán'}
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
                  {currentBranch.TenChiNhanh} ({currentBranch.MaChiNhanh})
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
            <span className="technician-kicker">Cổng thanh toán phòng Lab</span>
            <h2>QR thanh toán xét nghiệm</h2>
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
            <div className="technician-qr-box">
              <div className="technician-qr-pattern" />
              <span>QR Medicare Lab</span>
            </div>
            <button
              type="button"
              className="technician-pay-button"
              onClick={handleConfirmPayment}
              disabled={labActionLoading === paymentModal.lab.MaChiTietXN}
            >
              {labActionLoading === paymentModal.lab.MaChiTietXN ? 'Đang xác nhận...' : 'Xác nhận đã chuyển khoản'}
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
