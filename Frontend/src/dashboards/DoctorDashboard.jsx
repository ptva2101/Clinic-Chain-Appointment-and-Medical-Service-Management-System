import { useEffect, useMemo, useState } from 'react'
import { LogOut } from 'lucide-react'
import { EMPTY_CATALOG_DATA } from '../shared/catalog.js'
import { getDoctorQueue, updateAppointmentStatus } from '../api/appointment.js'
import { completeAppointment, completeTreatmentSession, getCompletedEncounters, getDoctorPatientHistory, getEncounterDetail } from '../api/clinical.js'
import TablePagination from './TablePagination.jsx'
import { getPageRows } from './tablePagination.js'

export default function DoctorDashboard({ user, onLogout, onChangePassword, showNotification, scheduleAdjustments = [], catalogData = EMPTY_CATALOG_DATA }) {
  const [doctorProfile, setDoctorProfile] = useState({
    MaBacSi: user?.MaBacSi || user?.id || 'BS001',
    HoTen: user?.HoTen || user?.name || 'Nguyễn Văn An',
    ChuyenKhoa: user?.ChuyenKhoa || 'Nội tổng quát',
    SDT: user?.SDT || '0911222333',
    MaChiNhanh: user?.MaChiNhanh || 'CN_CG',
    TenChiNhanh: user?.TenChiNhanh || 'Medicare - Cơ sở Cầu Giấy',
  })
  const [contactForm, setContactForm] = useState({ SDT: doctorProfile.SDT })
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [activeDoctorTab, setActiveDoctorTab] = useState('clinic')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [activeBookingId, setActiveBookingId] = useState('')
  const [doctorLiveRows, setDoctorLiveRows] = useState([])
  const [hasLoadedDoctorQueue, setHasLoadedDoctorQueue] = useState(false)
  const [doctorQueueLoading, setDoctorQueueLoading] = useState(false)
  const [doctorQueueError, setDoctorQueueError] = useState('')
  const [doctorActionLoading, setDoctorActionLoading] = useState('')
  const [savingExam, setSavingExam] = useState(false)
  const [selectedVisitId, setSelectedVisitId] = useState('')
  const [historyDetail, setHistoryDetail] = useState(null)
  const [queuePage, setQueuePage] = useState(0)
  const [conclusionPage, setConclusionPage] = useState(0)
  const [historyPage, setHistoryPage] = useState(0)
  const [clinicalForm, setClinicalForm] = useState({
    TrieuChung: '',
    MaBenh: '',
    LoiDan: '',
    MaThuoc: 'TH001',
    SoLuong: '10',
    LieuDung: '',
    MaXetNghiem: 'XN_MAU',
    MaDieuTri: 'DT_TRUYEN_DICH',
    TongSoBuoi: '3',
  })
  const [diagnosisSearch, setDiagnosisSearch] = useState('')
  const [medicineSearch, setMedicineSearch] = useState('Omeprazole 20mg')
  const [currentPrescription, setCurrentPrescription] = useState([])
  const [feedback, setFeedback] = useState('')
  const notify = (message, type = 'success') => {
    setFeedback(message)
    showNotification?.(message, type)
  }
  const [patients] = useState([
    {
      MaBenhAn: 'BN001',
      HoTen: 'Trần Quang Hải',
      CCCD: '001095012345',
      SDT: '0901234567',
      NgaySinh: '1995-04-12',
      DiaChi: 'Cầu Giấy, Hà Nội',
      KyTuDauBHYT: 'DN',
    },
    {
      MaBenhAn: 'BN004',
      HoTen: 'Lê Hoàng Nam',
      CCCD: '001186000004',
      SDT: '0904000004',
      NgaySinh: '1986-09-20',
      DiaChi: 'Nam Từ Liêm, Hà Nội',
      KyTuDauBHYT: 'DN',
    },
    {
      MaBenhAn: 'BN005',
      HoTen: 'Đỗ Minh Châu',
      CCCD: '001187000005',
      SDT: '0905000005',
      NgaySinh: '1987-02-15',
      DiaChi: 'Thanh Xuân, Hà Nội',
      KyTuDauBHYT: '',
    },
    {
      MaBenhAn: 'BN003',
      HoTen: 'Phạm Lê Minh',
      CCCD: '001221098765',
      SDT: '0911999888',
      NgaySinh: '2021-01-08',
      DiaChi: 'Hai Bà Trưng, Hà Nội',
      KyTuDauBHYT: 'TE',
    },
  ])
  const [services] = useState([
    { MaDichVu: 'DV_KHAM_NOI', TenDichVu: 'Khám Nội Tổng Quát', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 150000 },
    { MaDichVu: 'DV_KHAM_GIA_DINH', TenDichVu: 'Khám Sức Khỏe Gia Đình', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 250000 },
    { MaDichVu: 'DV_KHAM_TIM_MACH', TenDichVu: 'Khám Sàng Lọc Tim Mạch - Huyết Áp', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 200000 },
    { MaDichVu: 'DV_KHAM_TIEU_HOA', TenDichVu: 'Khám Tiêu Hóa - Gan Mật', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 180000 },
    { MaDichVu: 'DV_KHAM_RANG', TenDichVu: 'Khám Răng Hàm Mặt Định Kỳ', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 200000 },
    { MaDichVu: 'DV_KHAM_TMH', TenDichVu: 'Khám Tai Mũi Họng Thông Thường', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 180000 },
    { MaDichVu: 'XN_MAU', TenDichVu: 'Xét Nghiệm Công Thức Máu 24 Chỉ Số', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 250000 },
    { MaDichVu: 'SA_O_BUNG', TenDichVu: 'Siêu Âm Ổ Bụng Tổng Quát', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 300000 },
    { MaDichVu: 'XN_SINH_HOA', TenDichVu: 'Xét Nghiệm Sinh Hóa Máu (Gan, Thận, Mỡ Máu)', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 350000 },
    { MaDichVu: 'DT_TRUYEN_DICH', TenDichVu: 'Liệu trình truyền dịch giải độc, bù nước', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Điều trị', GiaGoc: 250000 },
    { MaDichVu: 'DT_RANG_TUY', TenDichVu: 'Liệu Trình Điều Trị Tủy Răng Toàn Diện', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Điều trị', GiaGoc: 1200000 },
    { MaDichVu: 'DT_KHIDUNG', TenDichVu: 'Liệu Trình Khí Dung Mũi Họng', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Điều trị', GiaGoc: 450000 },
  ])
  const doctorSchedules = catalogData?.doctorSchedules || []
  const [bookings, setBookings] = useState([
    {
      MaLichHen: 'LH_DR_001',
      MaBenhAn: 'BN001',
      MaDichVu: 'DV_KHAM_NOI',
      MaChiNhanh: 'CN_CG',
      MaBacSi: 'BS001',
      NgayKham: '2026-05-31',
      CaKham: 1,
      STT_HangDoi: 1,
      ThoiGianCheckIn: '08:05',
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_DR_002',
      MaBenhAn: 'BN004',
      MaDichVu: 'DV_KHAM_GIA_DINH',
      MaChiNhanh: 'CN_CG',
      MaBacSi: 'BS001',
      NgayKham: '2026-05-31',
      CaKham: 1,
      STT_HangDoi: 2,
      ThoiGianCheckIn: '08:14',
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_DR_003',
      MaBenhAn: 'BN005',
      MaDichVu: 'DV_KHAM_TIEU_HOA',
      MaChiNhanh: 'CN_CG',
      MaBacSi: 'BS001',
      NgayKham: '2026-05-31',
      CaKham: 1,
      STT_HangDoi: 3,
      ThoiGianCheckIn: '08:21',
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_DR_004',
      MaBenhAn: 'BN003',
      MaDichVu: 'DV_KHAM_RANG',
      MaChiNhanh: 'CN_CG',
      MaBacSi: 'BS002',
      NgayKham: '2026-05-31',
      CaKham: 2,
      STT_HangDoi: 1,
      ThoiGianCheckIn: '09:02',
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_DR_005',
      MaLuotKham: 'LK_001',
      MaBenhAn: 'BN001',
      MaDichVu: 'DV_KHAM_NOI',
      MaChiNhanh: 'CN_CG',
      MaBacSi: 'BS001',
      NgayKham: '2026-05-10',
      CaKham: 1,
      ThoiGianCheckIn: '08:10',
      TrangThai: 'Đã khám',
    },
    {
      MaLichHen: 'LH_DR_006',
      MaLuotKham: 'LK_002',
      MaBenhAn: 'BN001',
      MaDichVu: 'DV_KHAM_TIEU_HOA',
      MaChiNhanh: 'CN_CG',
      MaBacSi: 'BS001',
      NgayKham: '2026-04-18',
      CaKham: 2,
      ThoiGianCheckIn: '14:05',
      TrangThai: 'Đã khám',
    },
    {
      MaLichHen: 'LH_DR_007',
      MaLuotKham: 'LK_003',
      MaBenhAn: 'BN004',
      MaDichVu: 'DV_KHAM_TIM_MACH',
      MaChiNhanh: 'CN_CG',
      MaBacSi: 'BS001',
      NgayKham: '2026-03-22',
      CaKham: 1,
      ThoiGianCheckIn: '09:30',
      TrangThai: 'Đã khám',
    },
  ])
  const [diseases] = useState([
    { MaBenh: 'K29', TenBenh: 'Viêm dạ dày và tá tràng' },
    { MaBenh: 'K21', TenBenh: 'Trào ngược dạ dày thực quản' },
    { MaBenh: 'J01', TenBenh: 'Viêm xoang cấp' },
    { MaBenh: 'K05', TenBenh: 'Viêm nướu và bệnh nha chu' },
    { MaBenh: 'ICD_MMLL', TenBenh: 'Mệt mỏi lao lực' },
  ])
  const [visitRecords, setVisitRecords] = useState([
    {
      MaLuotKham: 'LK_001',
      MaBenhAn: 'BN001',
      NgayKham: '2026-05-10',
      MaBacSi: 'BS001',
      TrieuChung: 'Đau rát thượng vị, đầy hơi sau ăn, buồn nôn nhẹ.',
      MaBenh: 'K29',
      LoiDan: 'Ăn uống đúng giờ, kiêng đồ cay nóng, tái khám nếu đau tăng.',
    },
    {
      MaLuotKham: 'LK_002',
      MaBenhAn: 'BN001',
      NgayKham: '2026-04-18',
      MaBacSi: 'BS001',
      TrieuChung: 'Ợ nóng sau ăn, đau âm ỉ vùng thượng vị.',
      MaBenh: 'K21',
      LoiDan: 'Không nằm ngay sau ăn, chia nhỏ bữa, dùng thuốc đủ liệu trình.',
    },
    {
      MaLuotKham: 'LK_003',
      MaBenhAn: 'BN004',
      NgayKham: '2026-03-22',
      MaBacSi: 'BS001',
      TrieuChung: 'Mệt mỏi, đau đầu nhẹ, huyết áp dao động.',
      MaBenh: 'K29',
      LoiDan: 'Theo dõi huyết áp tại nhà, ngủ đủ giấc, hạn chế rượu bia.',
    },
    {
      MaLuotKham: 'LK_004',
      MaBenhAn: 'BN003',
      NgayKham: '2026-04-02',
      MaBacSi: 'BS002',
      TrieuChung: 'Chảy máu chân răng khi đánh răng, ê buốt răng hàm dưới.',
      MaBenh: 'K05',
      LoiDan: 'Vệ sinh răng miệng đúng cách, dùng chỉ nha khoa, tái khám nha chu.',
    },
  ])
  const [medicines] = useState([
    { MaThuoc: 'TH001', TenThuoc: 'Omeprazole 20mg', DonViTinh: 'Viên' },
    { MaThuoc: 'TH002', TenThuoc: 'Phosphalugel', DonViTinh: 'Gói' },
    { MaThuoc: 'TH003', TenThuoc: 'Domperidone 10mg', DonViTinh: 'Viên' },
    { MaThuoc: 'TH004', TenThuoc: 'Loratadine 10mg', DonViTinh: 'Viên' },
  ])
  const [prescriptionDetails, setPrescriptionDetails] = useState([
    { MaDonThuoc: 'DT001', MaLuotKham: 'LK_001', MaThuoc: 'TH001', SoLuong: 14, LieuDung: 'Uống 1 viên trước ăn sáng 30 phút trong 14 ngày.' },
    { MaDonThuoc: 'DT002', MaLuotKham: 'LK_001', MaThuoc: 'TH002', SoLuong: 10, LieuDung: 'Uống 1 gói khi đau hoặc nóng rát dạ dày.' },
    { MaDonThuoc: 'DT003', MaLuotKham: 'LK_002', MaThuoc: 'TH003', SoLuong: 10, LieuDung: 'Uống 1 viên trước bữa ăn khi buồn nôn hoặc đầy hơi.' },
    { MaDonThuoc: 'DT004', MaLuotKham: 'LK_003', MaThuoc: 'TH004', SoLuong: 7, LieuDung: 'Uống 1 viên mỗi tối trong 7 ngày.' },
  ])
  const [labDetails, setLabDetails] = useState([
    {
      MaChiTietXN: 'CTXN_001',
      MaLuotKham: 'LK_001',
      MaDichVu: 'XN_MAU',
      KetQuaXetNghiem: 'Bạch cầu trong giới hạn bình thường, Hemoglobin 145 g/L.',
      MaXNV: 'XNV001',
      TrangThaiXetNghiem: 'Đã có kết quả',
    },
    {
      MaChiTietXN: 'CTXN_002',
      MaLuotKham: 'LK_002',
      MaDichVu: 'SA_O_BUNG',
      KetQuaXetNghiem: 'Gan không to, nhu mô gan hơi tăng âm, túi mật không sỏi.',
      MaXNV: 'XNV001',
      TrangThaiXetNghiem: 'Đã có kết quả',
    },
    {
      MaChiTietXN: 'CTXN_003',
      MaLuotKham: 'LK_003',
      MaDichVu: 'XN_SINH_HOA',
      KetQuaXetNghiem: 'Men gan AST/ALT trong giới hạn, chức năng thận bình thường.',
      MaXNV: 'XNV001',
      TrangThaiXetNghiem: 'Đã có kết quả',
    },
  ])
  const [treatmentSchedules, setTreatmentSchedules] = useState([
    {
      MaLichTrinh: 'LTDT_OLD_001',
      MaLuotKham: 'LK_001',
      TenDichVu: 'Liệu trình Điều trị tủy răng sinh học',
      TongSoBuoi: 5,
      SoBuoiDaLam: 2,
      TrangThai: 'Đang tiến hành',
      GhiChuDieuTri: 'Răng đỡ đau, tiếp tục theo dõi và hàn kín vào buổi tới.',
    },
    {
      MaLichTrinh: 'LTDT_OLD_002',
      MaLuotKham: 'LK_003',
      TenDichVu: 'Vật lý trị liệu phục hồi chức năng',
      TongSoBuoi: 3,
      SoBuoiDaLam: 3,
      TrangThai: 'Đã hoàn thành',
      GhiChuDieuTri: 'Răng đỡ đau, tiếp tục theo dõi và hàn kín vào buổi tới.',
    },
  ])

  const effectiveServices = catalogData?.services || []
  const effectiveDiseases = catalogData?.diseases?.length ? catalogData.diseases : diseases
  const effectiveMedicines = catalogData?.medicines?.length ? catalogData.medicines : medicines
  const effectiveBranches = catalogData?.branches || []

  const getPatient = (maBenhAn) =>
    doctorPatientMap.get(maBenhAn) ||
    patients.find((patient) => patient.MaBenhAn === maBenhAn) || {
      MaBenhAn: maBenhAn,
      HoTen: 'Chưa rõ',
      SDT: 'Chưa cập nhật',
    }

  const getService = (maDichVu) =>
    effectiveServices.find((service) => service.MaDichVu === maDichVu) || {
      MaDichVu: maDichVu,
      TenDichVu: maDichVu,
    }

  const getDisease = (maBenh) =>
    effectiveDiseases.find((disease) => disease.MaBenh === maBenh) || {
      MaBenh: maBenh,
      TenBenh: 'Chưa xác định',
    }

  const getMedicine = (maThuoc) =>
    effectiveMedicines.find((medicine) => medicine.MaThuoc === maThuoc) || {
      MaThuoc: maThuoc,
      TenThuoc: maThuoc,
      DonViTinh: '',
    }

  const getShiftLabel = (caTruc) => {
    const labels = {
      1: 'Ca 1 (07:30 - 10:15)',
      2: 'Ca 2 (10:15 - 12:00)',
      3: 'Ca 3 (13:30 - 16:30)',
      4: 'Ca 4 (16:30 - 19:30)',
    }
    return labels[Number(caTruc)] || `Ca ${caTruc}`
  }

  const formatDateKey = (date) => date.toISOString().slice(0, 10)

  const addDays = (date, days) => {
    const nextDate = new Date(date)
    nextDate.setUTCDate(nextDate.getUTCDate() + days)
    return nextDate
  }

  const getWeekStart = (dateKey) => {
    const date = new Date(`${dateKey}T00:00:00Z`)
    const day = date.getUTCDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    return addDays(date, diffToMonday)
  }

  const getWeekdayLabel = (date) => {
    const labels = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
    return labels[date.getUTCDay()]
  }

  const getShortBranchName = (maChiNhanh) =>
    effectiveBranches.find((branch) => branch.MaChiNhanh === maChiNhanh)?.TenChiNhanh || maChiNhanh

  const buildCurrentVisitId = (booking) =>
    booking?.MaLuotKham || (booking ? `TEMP_VISIT_${booking.MaLichHen}` : '')

  const normalizeDoctorBooking = (booking) => ({
    MaLichHen: booking.MaLichHen,
    MaLuotKham: booking.MaLuotKham || '',
    MaBenhAn: booking.MaBenhAn || '',
    MaDichVu: booking.MaDichVu || '',
    TenDichVu: booking.TenDichVu || '',
    LoaiDichVu: booking.LoaiDichVu || '',
    MaChiNhanh: booking.MaChiNhanh || '',
    TenChiNhanh: booking.TenChiNhanh || '',
    MaBacSi: booking.MaBacSi || doctorProfile.MaBacSi,
    NgayKham: booking.NgayKham || '',
    CaKham: booking.CaKham || '',
    STT: booking.STT || booking.STT_HangDoi || '',
    STT_HangDoi: booking.STT_HangDoi || booking.STT || '',
    ThoiGianCheckIn: booking.ThoiGianCheckIn || '',
    TrangThai: booking.TrangThai || 'Chờ khám',
    GiaCuoi: booking.GiaCuoi || 0,
    PaymentToken: booking.PaymentToken || '',
    MaLeTan: booking.MaLeTan || '',
    patient: {
      MaBenhAn: booking.MaBenhAn || '',
      HoTen: booking.TenBenhNhan || booking.HoTen || 'Chưa rõ',
      CCCD: booking.CCCD || '',
      SDT: booking.SDTBenhNhan || booking.SDT || 'Chưa cập nhật',
      NgaySinh: booking.NgaySinh || '',
      DiaChi: booking.DiaChi || '',
      KyTuDauBHYT: booking.KyTuDauBHYT || '',
    },
  })

  const mergeDoctorHistoryRows = (rows) => {
    const historyRows = Array.isArray(rows) ? rows : []

    const nextVisits = historyRows.map((visit) => ({
      MaLuotKham: visit.MaLuotKham,
      MaBenhAn: visit.MaBenhAn,
      NgayKham: visit.NgayKham || '',
      MaBacSi: visit.MaBacSi || doctorProfile.MaBacSi,
      TrieuChung: visit.TrieuChung || '',
      MaBenh: visit.MaBenh || '',
      LoiDan: visit.LoiDan || '',
    }))

    const nextPrescriptions = historyRows.flatMap((visit) =>
      (visit.DonThuoc || []).map((item) => ({
        MaDonThuoc: item.MaDonThuoc,
        MaLuotKham: item.MaLuotKham || visit.MaLuotKham,
        MaThuoc: item.MaThuoc,
        SoLuong: item.SoLuong,
        LieuDung: item.LieuDung,
      })),
    )

    const nextLabs = historyRows.flatMap((visit) =>
      (visit.XetNghiem || []).map((item) => ({
        MaChiTietXN: item.MaChiTietXN,
        MaLuotKham: item.MaLuotKham || visit.MaLuotKham,
        MaDichVu: item.MaDichVu,
        KetQuaXetNghiem: item.KetQuaXetNghiem || '',
        MaXNV: item.MaXNV || '',
        PaymentToken: item.PaymentToken || '',
        GiaCuoi: item.GiaCuoi || 0,
        TrangThaiXetNghiem: item.TrangThaiXetNghiem || 'Chưa thực hiện',
      })),
    )

    const nextTreatments = historyRows.flatMap((visit) =>
      groupTreatmentResponse(visit.DieuTri || [], visit.MaLuotKham),
    )

    const nextBookings = historyRows.map((visit) =>
      normalizeDoctorBooking({
        MaLichHen: visit.MaLichHen,
        MaLuotKham: visit.MaLuotKham,
        MaBenhAn: visit.MaBenhAn,
        MaDichVu: visit.MaDichVuKham,
        TenDichVu: visit.TenDichVuKham,
        MaChiNhanh: visit.MaChiNhanh,
        TenChiNhanh: visit.TenChiNhanh,
        MaBacSi: visit.MaBacSi || doctorProfile.MaBacSi,
        NgayKham: visit.NgayKham,
        CaKham: visit.CaKham,
        STT: visit.STT,
        STT_HangDoi: visit.STT,
        TrangThai: visit.TrangThai,
        GiaCuoi: visit.GiaCuoi,
        PaymentToken: visit.PaymentToken,
        TenBenhNhan: visit.TenBenhNhan,
        CCCD: visit.CCCD,
        SDTBenhNhan: visit.SDTBenhNhan,
        NgaySinh: visit.NgaySinh,
        DiaChi: visit.DiaChi,
      }),
    )

    setVisitRecords((current) => [
      ...nextVisits,
      ...current.filter((item) => !nextVisits.some((visit) => visit.MaLuotKham === item.MaLuotKham)),
    ])
    setPrescriptionDetails((current) => [
      ...nextPrescriptions,
      ...current.filter((item) => !nextPrescriptions.some((prescription) => prescription.MaDonThuoc === item.MaDonThuoc)),
    ])
    setLabDetails((current) => [
      ...nextLabs,
      ...current.filter((item) => !nextLabs.some((lab) => lab.MaChiTietXN === item.MaChiTietXN)),
    ])
    setTreatmentSchedules((current) => [
      ...nextTreatments,
      ...current.filter((item) => !nextTreatments.some((treatment) => treatment.MaLichTrinh === item.MaLichTrinh)),
    ])
    setBookings((current) => [
      ...nextBookings,
      ...current.filter((item) => !nextBookings.some((booking) => booking.MaLichHen === item.MaLichHen)),
    ])

    return { nextVisits, nextBookings }
  }

  const loadDoctorQueue = async () => {
    if (!doctorProfile.MaBacSi) return

    setDoctorQueueLoading(true)
    setDoctorQueueError('')

    try {
      const response = await getDoctorQueue(doctorProfile.MaBacSi,
      )
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể tải hàng đợi bác sĩ.')
      }

      setDoctorLiveRows(Array.isArray(result.data) ? result.data.map(normalizeDoctorBooking) : [])
      setHasLoadedDoctorQueue(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải hàng đợi bác sĩ.'
      setDoctorQueueError(message)
      console.warn('DOCTOR_QUEUE_LOAD_FAILED', message)
    } finally {
      setDoctorQueueLoading(false)
    }
  }

  const loadDoctorCompletedEncounters = async () => {
    if (!doctorProfile.MaBacSi) return

    try {
      const response = await getCompletedEncounters(doctorProfile.MaBacSi,
      )
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể tải lịch sử đợt khám của bác sĩ.')
      }

      mergeDoctorHistoryRows(result.data)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải lịch sử đợt khám của bác sĩ.'
      console.warn('DOCTOR_COMPLETED_HISTORY_LOAD_FAILED', message)
    }
  }

  const loadPatientHistoryForDoctor = async (maBenhAn) => {
    if (!maBenhAn) return { nextVisits: [], nextBookings: [] }

    try {
      const response = await getDoctorPatientHistory(maBenhAn,
      )
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể tải lịch sử khám của bệnh nhân.')
      }

      return mergeDoctorHistoryRows(result.data)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải lịch sử khám của bệnh nhân.'
      console.warn('DOCTOR_PATIENT_HISTORY_LOAD_FAILED', message)
      return { nextVisits: [], nextBookings: [] }
    }
  }

  const updateDoctorBookingStatus = async (maLichHen, trangThai) => {
    const formData = new FormData()
    formData.append('ma_lich_hen', maLichHen)
    formData.append('trang_thai', trangThai)

    const response = await updateAppointmentStatus({
      method: 'POST',
      body: formData,
    })
    const result = await response.json()

    if (!response.ok || !result?.success) {
      throw new Error(result?.message || 'Không thể cập nhật trạng thái lịch hẹn.')
    }

    return result.data
  }

  useEffect(() => {
    loadDoctorQueue()
    loadDoctorCompletedEncounters()
  }, [doctorProfile.MaBacSi])

  const labServices = effectiveServices.filter((service) => service.LoaiDichVu === 'Xét nghiệm')
  const treatmentServices = effectiveServices.filter((service) => service.LoaiDichVu === 'Điều trị')
  const selectedLabServiceId = labServices.some((service) => service.MaDichVu === clinicalForm.MaXetNghiem)
    ? clinicalForm.MaXetNghiem
    : labServices[0]?.MaDichVu || ''
  const selectedTreatmentServiceId = treatmentServices.some((service) => service.MaDichVu === clinicalForm.MaDieuTri)
    ? clinicalForm.MaDieuTri
    : treatmentServices[0]?.MaDichVu || ''
  const filteredDiseaseSuggestions = effectiveDiseases
    .filter((disease) => {
      const keyword = diagnosisSearch.trim().toLowerCase()
      if (!keyword) return true
      return [disease.MaBenh, disease.TenBenh].join(' ').toLowerCase().includes(keyword)
    })
    .slice(0, 6)
  const filteredMedicineSuggestions = effectiveMedicines
    .filter((medicine) => {
      const keyword = medicineSearch.trim().toLowerCase()
      if (!keyword) return true
      return [medicine.MaThuoc, medicine.TenThuoc, medicine.DonViTinh].join(' ').toLowerCase().includes(keyword)
    })
    .slice(0, 6)
  const mySchedules = doctorSchedules
    .filter(
      (schedule) =>
        schedule.MaBacSi === doctorProfile.MaBacSi &&
        schedule.NgayTruc >= '2026-05-31',
    )
    .sort((a, b) => `${a.NgayTruc}-${a.CaTruc}`.localeCompare(`${b.NgayTruc}-${b.CaTruc}`))
  const weeklyScheduleGroups = (() => {
    const groupMap = new Map()

    mySchedules.forEach((schedule) => {
      const weekStartKey = formatDateKey(getWeekStart(schedule.NgayTruc))
      const current = groupMap.get(weekStartKey) || []
      groupMap.set(weekStartKey, [...current, schedule])
    })

    return Array.from(groupMap.entries())
      .map(([weekStartKey, schedules]) => {
        const weekStart = new Date(`${weekStartKey}T00:00:00Z`)
        const days = Array.from({ length: 7 }, (_, index) => {
          const date = addDays(weekStart, index)
          return {
            date,
            dateKey: formatDateKey(date),
            label: getWeekdayLabel(date),
          }
        })

        return {
          weekStartKey,
          weekEndKey: formatDateKey(addDays(weekStart, 6)),
          days,
          schedules,
        }
      })
      .sort((a, b) => a.weekStartKey.localeCompare(b.weekStartKey))
  })()
  const doctorSourceBookings = hasLoadedDoctorQueue ? doctorLiveRows : bookings
  const isDoctorOwnedBooking = (booking) =>
    booking.MaBacSi === doctorProfile.MaBacSi &&
    (hasLoadedDoctorQueue || booking.MaChiNhanh === doctorProfile.MaChiNhanh)
  const doctorPatientMap = doctorSourceBookings.reduce((patientMap, booking) => {
    if (booking.patient?.MaBenhAn) {
      patientMap.set(booking.patient.MaBenhAn, booking.patient)
    }
    return patientMap
  }, new Map())
  const doctorQueue = doctorSourceBookings
    .filter((booking) => booking.TrangThai === 'Chờ khám' && isDoctorOwnedBooking(booking))
    .sort((a, b) => Number(a.STT_HangDoi || 0) - Number(b.STT_HangDoi || 0))

  const activeBooking =
    doctorSourceBookings.find((booking) => booking.MaLichHen === activeBookingId) ||
    bookings.find((booking) => booking.MaLichHen === activeBookingId)
  const activePatient = activeBooking ? getPatient(activeBooking.MaBenhAn) : null
  const activeBookingService = activeBooking ? getService(activeBooking.MaDichVu) : null
  const activeBookingServiceType = activeBooking?.LoaiDichVu || activeBookingService?.LoaiDichVu || ''
  const isActiveTreatmentBooking = activeBookingServiceType === 'Điều trị'
  const patientVisits = activePatient
    ? visitRecords
        .filter((visit) => visit.MaBenhAn === activePatient.MaBenhAn)
        .sort((a, b) => b.NgayKham.localeCompare(a.NgayKham))
    : []
  const selectedVisit =
    patientVisits.find((visit) => visit.MaLuotKham === selectedVisitId) || patientVisits[0] || null
  const selectedPrescriptions = selectedVisit
    ? prescriptionDetails.filter((item) => item.MaLuotKham === selectedVisit.MaLuotKham)
    : []
  const selectedLabs = selectedVisit
    ? labDetails.filter((item) => item.MaLuotKham === selectedVisit.MaLuotKham)
    : []
  const selectedTreatments = selectedVisit
    ? treatmentSchedules.filter((item) => item.MaLuotKham === selectedVisit.MaLuotKham)
    : []
  const currentVisitId = buildCurrentVisitId(activeBooking)
  const currentLabOrders = activeBooking
    ? labDetails.filter((lab) => lab.MaLuotKham === currentVisitId)
    : []
  const currentTreatments = activeBooking
    ? treatmentSchedules.filter((item) => item.MaLuotKham === currentVisitId)
    : []
  const activeTreatmentSession = activeBooking
    ? treatmentSchedules.find((item) => item.MaLichHen === activeBooking.MaLichHen)
    : null
  const activeTreatmentSiblings = activeTreatmentSession
    ? treatmentSchedules
        .filter(
          (item) =>
            item.MaLuotKham === activeTreatmentSession.MaLuotKham &&
            item.MaDichVu === activeTreatmentSession.MaDichVu,
        )
        .sort((first, second) => Number(first.BuoiSo || 0) - Number(second.BuoiSo || 0))
    : []
  const activeTreatmentCompletedCount = activeTreatmentSiblings.filter((item) => item.TrangThai === 'Hoàn thành').length
  const waitingConclusionBookings = doctorSourceBookings
    .filter((booking) => booking.TrangThai === 'Chờ kết luận' && isDoctorOwnedBooking(booking))
    .sort((a, b) => Number(a.STT_HangDoi || 0) - Number(b.STT_HangDoi || 0))
  const allCurrentLabResultsReady =
    currentLabOrders.length === 0 ||
    currentLabOrders.every((lab) => lab.TrangThaiXetNghiem === 'Đã có kết quả')
  const completedEncounterRows = bookings
    .filter(
      (booking) =>
        booking.MaBacSi === doctorProfile.MaBacSi &&
        ['Hoàn thành', 'Đã khám'].includes(booking.TrangThai) &&
        booking.MaLuotKham,
    )
	    .map((booking) => {
	      const visit = visitRecords.find((item) => item.MaLuotKham === booking.MaLuotKham)
	      const patient = booking.patient?.MaBenhAn ? booking.patient : getPatient(booking.MaBenhAn)
	      const disease = visit ? getDisease(visit.MaBenh) : getDisease('')
	      return { booking, visit, patient, disease }
	    })
    .filter((row) => row.visit)
    .sort((a, b) => b.booking.NgayKham.localeCompare(a.booking.NgayKham))

  const handleUpdatePhone = (event) => {
    event.preventDefault()
    setDoctorProfile((current) => ({ ...current, SDT: contactForm.SDT.trim() }))
    notify('Đã cập nhật số điện thoại liên hệ.')
  }

  const handleChangePassword = async (event) => {
    event.preventDefault()
    if (passwordForm.newPassword.length < 6 || passwordForm.newPassword !== passwordForm.confirmPassword) {
      notify('Mật khẩu mới cần ít nhất 6 ký tự và phải khớp xác nhận.', 'error')
      return
    }
    try {
      await onChangePassword(passwordForm.oldPassword, passwordForm.newPassword)
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
      setShowPasswordForm(false)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Không đổi được mật khẩu.', 'error')
    }
  }

  const updateLocalDoctorBooking = (maLichHen, patch) => {
    setDoctorLiveRows((current) =>
      current.map((booking) => (booking.MaLichHen === maLichHen ? { ...booking, ...patch } : booking)),
    )
    setBookings((current) =>
      current.map((booking) => (booking.MaLichHen === maLichHen ? { ...booking, ...patch } : booking)),
    )
  }

  const buildExamPayload = (isDraft) => ({
    ma_lich_hen: activeBooking.MaLichHen,
    ma_bac_si: doctorProfile.MaBacSi,
    ma_benh: clinicalForm.MaBenh || null,
    trieu_chung: clinicalForm.TrieuChung.trim() || 'Bác sĩ chưa ghi nhận triệu chứng chi tiết.',
    loi_dan: clinicalForm.LoiDan.trim() || 'Theo dõi tại nhà và tái khám khi có dấu hiệu bất thường.',
    xet_nghiem: currentLabOrders.map((lab) => ({ ma_dich_vu: lab.MaDichVu })),
    don_thuoc: currentPrescription.map((item) => ({
      ma_thuoc: item.MaThuoc,
      so_luong: Number(item.SoLuong) || 1,
      lieu_dung: item.LieuDung,
    })),
    dieu_tri: currentTreatments.map((item) => ({
      ma_dich_vu: item.MaDichVu,
      so_buoi: Number(item.TongSoBuoi || item.SoBuoi || 1) || 1,
    })),
    is_draft: isDraft,
  })

  const groupTreatmentResponse = (items, maLuotKham) => {
    const treatmentMap = (items || []).reduce((currentMap, item) => {
      const key = item.MaDichVu || item.MaLichTrinh
      const current = currentMap[key] || {
        MaLichTrinh: item.MaLichTrinh,
        MaLichHen: item.MaLichHen || '',
        MaLuotKham: item.MaLuotKham || maLuotKham,
        MaDichVu: item.MaDichVu,
        TenDichVu: item.TenDichVu,
        TongSoBuoi: 0,
        SoBuoiDaLam: 0,
        TrangThai: item.TrangThai || 'Chưa đặt lịch',
      }

      current.TongSoBuoi += 1
      if (item.TrangThai === 'Hoàn thành') {
        current.SoBuoiDaLam += 1
      }
      currentMap[key] = current
      return currentMap
    }, {})

    return Object.values(treatmentMap)
  }

  const applyExamResponse = (data, status) => {
    if (!data?.MaLuotKham || !activeBooking || !activePatient) return ''

    const maLuotKham = data.MaLuotKham
    const previousVisitId = currentVisitId
    const visit = {
      MaLuotKham: maLuotKham,
      MaBenhAn: activePatient.MaBenhAn,
      NgayKham: activeBooking.NgayKham,
      MaBacSi: doctorProfile.MaBacSi,
      TrieuChung: data.TrieuChung || clinicalForm.TrieuChung.trim() || 'Bác sĩ chưa ghi nhận triệu chứng chi tiết.',
      MaBenh: data.MaBenh || clinicalForm.MaBenh,
      LoiDan: data.LoiDan || clinicalForm.LoiDan.trim() || 'Theo dõi tại nhà và tái khám khi có dấu hiệu bất thường.',
    }

    setVisitRecords((current) => [visit, ...current.filter((item) => item.MaLuotKham !== maLuotKham)])

    if (Array.isArray(data.XetNghiem)) {
      setLabDetails((current) => [
        ...current.filter((item) => item.MaLuotKham !== previousVisitId && item.MaLuotKham !== maLuotKham),
        ...data.XetNghiem.map((item) => ({
          MaChiTietXN: item.MaChiTietXN,
          MaLuotKham: maLuotKham,
          MaDichVu: item.MaDichVu,
          KetQuaXetNghiem: item.KetQuaXetNghiem || '',
          MaXNV: item.MaXNV || '',
          TrangThaiXetNghiem: item.TrangThaiXetNghiem || 'Chưa thực hiện',
        })),
      ])
    }

    if (Array.isArray(data.DonThuoc)) {
      setPrescriptionDetails((current) => [
        ...current.filter((item) => item.MaLuotKham !== previousVisitId && item.MaLuotKham !== maLuotKham),
        ...data.DonThuoc.map((item) => ({
          MaDonThuoc: item.MaDonThuoc,
          MaLuotKham: maLuotKham,
          MaThuoc: item.MaThuoc,
          SoLuong: item.SoLuong,
          LieuDung: item.LieuDung,
        })),
      ])
    }

    if (Array.isArray(data.DieuTri)) {
      const groupedTreatments = groupTreatmentResponse(data.DieuTri, maLuotKham)
      setTreatmentSchedules((current) => [
        ...current.filter((item) => item.MaLuotKham !== previousVisitId && item.MaLuotKham !== maLuotKham),
        ...groupedTreatments,
      ])
    }

    updateLocalDoctorBooking(activeBooking.MaLichHen, { MaLuotKham: maLuotKham, TrangThai: status })
    return maLuotKham
  }

  const mergeEncounterDetail = (data) => {
    const visit = data?.LuotKham
    if (!visit?.MaLuotKham) return

    setVisitRecords((current) => [
      {
        MaLuotKham: visit.MaLuotKham,
        MaBenhAn: visit.MaBenhAn,
        NgayKham: visit.NgayKham || '',
        MaBacSi: visit.MaBacSi || doctorProfile.MaBacSi,
        TrieuChung: visit.TrieuChung || '',
        MaBenh: visit.MaBenh || '',
        LoiDan: visit.LoiDan || '',
      },
      ...current.filter((item) => item.MaLuotKham !== visit.MaLuotKham),
    ])

    if (Array.isArray(data.DonThuoc)) {
      setPrescriptionDetails((current) => [
        ...current.filter((item) => item.MaLuotKham !== visit.MaLuotKham),
        ...data.DonThuoc.map((item) => ({
          MaDonThuoc: item.MaDonThuoc,
          MaLuotKham: item.MaLuotKham || visit.MaLuotKham,
          MaThuoc: item.MaThuoc,
          SoLuong: item.SoLuong,
          LieuDung: item.LieuDung,
        })),
      ])
    }

    if (Array.isArray(data.XetNghiem)) {
      setLabDetails((current) => [
        ...current.filter((item) => item.MaLuotKham !== visit.MaLuotKham),
        ...data.XetNghiem.map((item) => ({
          MaChiTietXN: item.MaChiTietXN,
          MaLuotKham: item.MaLuotKham || visit.MaLuotKham,
          MaDichVu: item.MaDichVu,
          KetQuaXetNghiem: item.KetQuaXetNghiem || '',
          MaXNV: item.MaXNV || '',
          PaymentToken: item.PaymentToken || '',
          GiaCuoi: item.GiaCuoi || 0,
          TrangThaiXetNghiem: item.TrangThaiXetNghiem || 'Chưa thực hiện',
        })),
      ])
    }

    if (Array.isArray(data.DieuTri)) {
      setTreatmentSchedules((current) => [
        ...current.filter((item) => item.MaLuotKham !== visit.MaLuotKham),
        ...groupTreatmentResponse(data.DieuTri, visit.MaLuotKham),
      ])
    }
  }

  const loadEncounterDetail = async (maLuotKham) => {
    if (!maLuotKham) return null

    const params = new URLSearchParams({
      ma_luot_kham: maLuotKham,
      ma_bac_si: doctorProfile.MaBacSi,
    })
    const response = await getEncounterDetail(params.toString())
    const result = await response.json()

    if (!response.ok || !result?.success) {
      throw new Error(result?.message || 'Không thể tải chi tiết lượt khám.')
    }

    mergeEncounterDetail(result.data)
    return result.data
  }

  const saveExamToBackend = async (isDraft) => {
    const response = await completeAppointment({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildExamPayload(isDraft)),
    })
    const result = await response.json()

    if (!response.ok || !result?.success) {
      throw new Error(result?.message || 'Không thể lưu lượt khám.')
    }

    return result.data
  }

  const handleInvitePatient = async (booking) => {
    setDoctorActionLoading(booking.MaLichHen)

    try {
      if (hasLoadedDoctorQueue && !String(booking.MaLichHen).startsWith('LH_DR_')) {
        await updateDoctorBookingStatus(booking.MaLichHen, 'Đang khám')
      }

      updateLocalDoctorBooking(booking.MaLichHen, { TrangThai: 'Đang khám' })
      setActiveBookingId(booking.MaLichHen)
      const loadedHistory = await loadPatientHistoryForDoctor(booking.MaBenhAn)
      if (booking.MaLuotKham) {
        await loadEncounterDetail(booking.MaLuotKham)
        setSelectedVisitId(booking.MaLuotKham)
      }
      const historySource = loadedHistory.nextVisits.length > 0 ? loadedHistory.nextVisits : visitRecords
      const patientHistoricalVisits = historySource
        .filter((visit) => visit.MaBenhAn === booking.MaBenhAn)
        .sort((a, b) => b.NgayKham.localeCompare(a.NgayKham))
      if (!booking.MaLuotKham) {
        setSelectedVisitId(patientHistoricalVisits[0]?.MaLuotKham || '')
      }
      notify(`Đã mời ${getPatient(booking.MaBenhAn).HoTen} vào khám.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể mời bệnh nhân vào khám.'
      notify(message, 'error')
    } finally {
      setDoctorActionLoading('')
    }
  }

  const handleClinicalFormChange = (field, value) => {
    setClinicalForm((current) => ({ ...current, [field]: value }))
  }

  const handleSelectDisease = (disease) => {
    setClinicalForm((current) => ({ ...current, MaBenh: disease.MaBenh }))
    setDiagnosisSearch(`${disease.MaBenh} - ${disease.TenBenh}`)
  }

  const handleDiagnosisSearchChange = (value) => {
    setDiagnosisSearch(value)
    setClinicalForm((current) => ({ ...current, MaBenh: '' }))
  }

  const handleSelectMedicine = (medicine) => {
    setClinicalForm((current) => ({ ...current, MaThuoc: medicine.MaThuoc }))
    setMedicineSearch(medicine.TenThuoc)
  }

  const handleAddPrescriptionItem = () => {
    const medicine = getMedicine(clinicalForm.MaThuoc)
    const quantity = Number(clinicalForm.SoLuong)
    const dosage = clinicalForm.LieuDung.trim()

    if (!medicine.MaThuoc) {
      notify('Vui lòng chọn thuốc từ danh mục gợi ý.', 'error')
      return
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      notify('Số lượng thuốc phải là số nguyên dương.', 'error')
      return
    }

    if (!dosage) {
      notify('Vui lòng nhập liều dùng/lời dặn thuốc.', 'error')
      return
    }

    setCurrentPrescription((current) => [
      ...current,
      {
        TempId: `TEMP_RX_${Date.now()}_${current.length + 1}`,
        MaThuoc: medicine.MaThuoc,
        SoLuong: quantity,
        LieuDung: dosage,
      },
    ])
    setClinicalForm((current) => ({
      ...current,
      SoLuong: '10',
      LieuDung: '',
    }))
    setMedicineSearch('')
    notify(`Đã thêm ${medicine.TenThuoc} vào đơn thuốc.`)
  }

  const handleRemovePrescriptionItem = (tempId) => {
    setCurrentPrescription((current) => current.filter((item) => item.TempId !== tempId))
  }

  const handleAddLabOrder = () => {
    if (!activeBooking) {
      notify('Vui lòng mời bệnh nhân vào khám trước khi chỉ định xét nghiệm.', 'error')
      return
    }

    if (!selectedLabServiceId) {
      notify('Không có dịch vụ xét nghiệm khả dụng trong danh mục.', 'error')
      return
    }

    const newLabOrder = {
      MaChiTietXN: `CTXN_DR_${String(labDetails.length + 1).padStart(3, '0')}`,
      MaLuotKham: currentVisitId,
      MaDichVu: selectedLabServiceId,
      KetQuaXetNghiem: '',
      MaXNV: '',
      TrangThaiXetNghiem: 'Chưa thực hiện',
      PaymentToken: null,
    }
    setLabDetails((current) => [...current, newLabOrder])
    notify(`Đã thêm chỉ định ${getService(selectedLabServiceId).TenDichVu}.`)
  }

  const handleMockLabResult = (maChiTietXN) => {
    setLabDetails((current) =>
      current.map((lab) =>
        lab.MaChiTietXN === maChiTietXN
          ? {
              ...lab,
              KetQuaXetNghiem: 'Kết quả đã được phòng Lab trả: các chỉ số trong giới hạn tham chiếu.',
              MaXNV: 'XNV001',
              TrangThaiXetNghiem: 'Đã có kết quả',
              PaymentToken: lab.PaymentToken || 'PAY_LAB_SIMULATED',
            }
          : lab,
      ),
    )
    notify('Đã mô phỏng phòng Lab trả kết quả realtime.')
  }

  const handleAddTreatmentPlan = () => {
    if (!activeBooking) {
      notify('Vui lòng mời bệnh nhân vào khám trước khi chỉ định điều trị.', 'error')
      return
    }

    if (!selectedTreatmentServiceId) {
      notify('Không có dịch vụ điều trị khả dụng trong danh mục.', 'error')
      return
    }

    const totalSessions = Number(clinicalForm.TongSoBuoi)
    if (!Number.isInteger(totalSessions) || totalSessions <= 0) {
      notify('Tổng số buổi điều trị phải là số nguyên dương.', 'error')
      return
    }

    const newTreatment = {
      MaLichTrinh: `LTDT_DR_${String(treatmentSchedules.length + 1).padStart(3, '0')}`,
      MaLuotKham: currentVisitId,
      MaDichVu: selectedTreatmentServiceId,
      TongSoBuoi: totalSessions,
      SoBuoiDaLam: 0,
      TrangThai: 'Chưa thực hiện',
    }
    setTreatmentSchedules((current) => [...current, newTreatment])
    notify(`Đã chỉ định liệu trình ${getService(selectedTreatmentServiceId).TenDichVu}.`)
  }

  const handlePauseForLab = async () => {
    if (!activeBooking) return
    if (currentLabOrders.length === 0) {
      notify('Chưa có chỉ định xét nghiệm nào để chuyển ca sang trạng thái chờ kết quả.', 'error')
      return
    }

    setSavingExam(true)

    try {
      const examData = await saveExamToBackend(true)
      applyExamResponse(examData, examData?.TrangThai || 'Chờ kết luận')

      updateLocalDoctorBooking(activeBooking.MaLichHen, {
        MaLuotKham: examData?.MaLuotKham || activeBooking.MaLuotKham,
        TrangThai: 'Chờ kết luận',
      })
      setActiveBookingId('')
      notify('Đã lưu chỉ định và chuyển bệnh nhân sang danh sách chờ kết luận.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tạm hoãn ca khám.'
      notify(message, 'error')
    } finally {
      setSavingExam(false)
    }
  }

  const handleRecallPatient = async (booking) => {
    setDoctorActionLoading(booking.MaLichHen)

    try {
      if (hasLoadedDoctorQueue && !String(booking.MaLichHen).startsWith('LH_DR_')) {
        await updateDoctorBookingStatus(booking.MaLichHen, 'Đang khám')
      }

      updateLocalDoctorBooking(booking.MaLichHen, { TrangThai: 'Đang khám' })
      setActiveBookingId(booking.MaLichHen)
      const loadedHistory = await loadPatientHistoryForDoctor(booking.MaBenhAn)
      if (booking.MaLuotKham) {
        await loadEncounterDetail(booking.MaLuotKham)
        setSelectedVisitId(booking.MaLuotKham)
      }
      const historySource = loadedHistory.nextVisits.length > 0 ? loadedHistory.nextVisits : visitRecords
      const patientHistoricalVisits = historySource
        .filter((visit) => visit.MaBenhAn === booking.MaBenhAn)
        .sort((a, b) => b.NgayKham.localeCompare(a.NgayKham))
      if (!booking.MaLuotKham) {
        setSelectedVisitId(patientHistoricalVisits[0]?.MaLuotKham || '')
      }
      notify(`Đã gọi lại ${getPatient(booking.MaBenhAn).HoTen} vào phòng để kết luận.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể gọi lại bệnh nhân.'
      notify(message, 'error')
    } finally {
      setDoctorActionLoading('')
    }
  }

  const handleCompleteExam = async () => {
    if (!activeBooking || !activePatient) return
    if (!allCurrentLabResultsReady) {
      notify('Chưa có đủ kết quả xét nghiệm để hoàn thành lượt khám.', 'error')
      return
    }

    setSavingExam(true)

    try {
      const examData = await saveExamToBackend(false)
      const maLuotKham = applyExamResponse(examData, 'Hoàn thành') || currentVisitId
      await loadDoctorCompletedEncounters()

      setDoctorLiveRows((current) => current.filter((booking) => booking.MaLichHen !== activeBooking.MaLichHen))
      setActiveBookingId('')
      setClinicalForm((current) => ({
        ...current,
        TrieuChung: '',
        LoiDan: '',
        LieuDung: '',
        SoLuong: '10',
        TongSoBuoi: '3',
      }))
      setCurrentPrescription([])
      setDiagnosisSearch('')
      setMedicineSearch('')
      notify(`Đã hoàn thành lượt khám ${maLuotKham} và lưu vào hệ thống.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể hoàn thành lượt khám.'
      notify(message, 'error')
    } finally {
      setSavingExam(false)
    }
  }

  const handleCompleteTreatmentSession = async () => {
    if (!activeBooking || !activePatient) return

    setSavingExam(true)

    try {
      const response = await completeTreatmentSession({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ma_lich_hen: activeBooking.MaLichHen,
          ma_bac_si: doctorProfile.MaBacSi,
        }),
      })
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể hoàn thành buổi điều trị.')
      }

      const completedTreatment = result.data
      updateLocalDoctorBooking(activeBooking.MaLichHen, { TrangThai: 'Hoàn thành' })
      setTreatmentSchedules((current) =>
        current.map((item) =>
          item.MaLichHen === activeBooking.MaLichHen ||
          item.MaLichTrinh === completedTreatment?.MaLichTrinh
            ? {
                ...item,
                TrangThai: 'Hoàn thành',
                MaLichHen: item.MaLichHen || activeBooking.MaLichHen,
              }
            : item,
        ),
      )
      setDoctorLiveRows((current) => current.filter((booking) => booking.MaLichHen !== activeBooking.MaLichHen))
      setActiveBookingId('')
      notify(`Đã hoàn thành buổi điều trị ${completedTreatment?.MaLichTrinh || activeBooking.MaLichHen}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể hoàn thành buổi điều trị.'
      notify(message, 'error')
    } finally {
      setSavingExam(false)
    }
  }

  return (
    <main className="doctor-shell">
      <header className="doctor-topbar">
        <div>
          <span className="doctor-kicker">Medicare Doctor Workspace</span>
          <h1>Xin chào, Bác sĩ {doctorProfile.HoTen}</h1>
          <p>
            Chuyên khoa: <strong>{doctorProfile.ChuyenKhoa}</strong> · Chi nhánh:{' '}
            <strong>{doctorProfile.TenChiNhanh}</strong>
          </p>
        </div>
        <button type="button" className="doctor-logout-button" onClick={onLogout}>
          <LogOut size={18} />
          Đăng xuất
        </button>
      </header>

      {feedback && <p className="doctor-feedback">{feedback}</p>}
      {doctorQueueLoading && <p className="doctor-feedback">Đang tải hàng đợi bác sĩ từ hệ thống...</p>}
      {doctorQueueError && <p className="doctor-feedback">{doctorQueueError}</p>}

      <nav className="doctor-tab-row">
        <button
          type="button"
          className={activeDoctorTab === 'clinic' ? 'active' : ''}
          onClick={() => setActiveDoctorTab('clinic')}
        >
          🩺 Phòng khám
        </button>
        <button
          type="button"
          className={activeDoctorTab === 'schedule' ? 'active' : ''}
          onClick={() => setActiveDoctorTab('schedule')}
        >
          📅 Lịch trực của tôi
        </button>
        <button
          type="button"
          className={activeDoctorTab === 'history' ? 'active' : ''}
          onClick={() => setActiveDoctorTab('history')}
        >
          📚 Lịch sử đợt khám
        </button>
        <button
          type="button"
          className={activeDoctorTab === 'account' ? 'active' : ''}
          onClick={() => setActiveDoctorTab('account')}
        >
          ⚙️ Cài đặt tài khoản
        </button>
      </nav>

      {activeDoctorTab === 'clinic' ? (
        <>
          <section className="doctor-grid doctor-grid-single">
        <article className="doctor-card">
          <div className="doctor-section-header">
            <div>
              <h2>Danh sách bệnh nhân đang chờ</h2>
              <p>Hàng đợi lọc theo bác sĩ và chi nhánh đang đăng nhập.</p>
            </div>
            <strong>{doctorQueue.length} ca chờ</strong>
          </div>
          <div className="doctor-table-wrap">
            <table className="doctor-table">
              <thead>
                <tr>
                  <th>STT hàng đợi</th>
                  <th>Họ tên</th>
                  <th>Ca khám</th>
                  <th>Dịch vụ đăng ký</th>
                  <th>Thời gian check-in</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {getPageRows(doctorQueue, queuePage).map((booking) => {
                  const patient = getPatient(booking.MaBenhAn)
                  const service = getService(booking.MaDichVu)
                  return (
                    <tr key={booking.MaLichHen}>
                      <td>{booking.STT_HangDoi}</td>
                      <td>
                        <strong>{patient.HoTen}</strong>
                        <span>{patient.MaBenhAn}</span>
                      </td>
                      <td>Ca {booking.CaKham}</td>
                      <td>{booking.TenDichVu || service.TenDichVu}</td>
                      <td>{booking.ThoiGianCheckIn}</td>
                      <td>
                        <button
                          type="button"
                          className="doctor-primary-button compact"
                          disabled={doctorActionLoading === booking.MaLichHen}
                          onClick={() => handleInvitePatient(booking)}
                        >
                          {doctorActionLoading === booking.MaLichHen ? 'Đang mời...' : 'Mời vào khám'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {doctorQueue.length === 0 && (
                  <tr>
                    <td colSpan="6" className="doctor-empty-cell">
                      Không còn bệnh nhân nào đang chờ bác sĩ.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination page={queuePage} total={doctorQueue.length} label="ca chờ" onPageChange={setQueuePage} />
        </article>
      </section>

      <section className="doctor-card">
        <div className="doctor-section-header">
          <div>
            <h2>Danh sách chờ kết luận</h2>
            <p>Bệnh nhân đã khám vòng 1 và đang chờ đủ kết quả cận lâm sàng.</p>
          </div>
          <strong>{waitingConclusionBookings.length} ca chờ kết luận</strong>
        </div>
        <div className="doctor-table-wrap">
          <table className="doctor-table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Họ tên</th>
                <th>Ca khám</th>
                <th>Dịch vụ</th>
                <th>Trạng thái xét nghiệm</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {getPageRows(waitingConclusionBookings, conclusionPage).map((booking) => {
                const patient = getPatient(booking.MaBenhAn)
                const currentLabs = labDetails.filter((lab) => lab.MaLuotKham === buildCurrentVisitId(booking))
                const readyCount = currentLabs.filter((lab) => lab.TrangThaiXetNghiem === 'Đã có kết quả').length
                return (
                  <tr key={booking.MaLichHen}>
                    <td>{booking.STT_HangDoi}</td>
                    <td>
                      <strong>{patient.HoTen}</strong>
                      <span>{patient.MaBenhAn}</span>
                    </td>
                    <td>Ca {booking.CaKham}</td>
                    <td>{booking.TenDichVu || getService(booking.MaDichVu).TenDichVu}</td>
                    <td>
                      {readyCount}/{currentLabs.length} kết quả
                    </td>
                    <td>
                      <button
                        type="button"
                        className="doctor-secondary-button compact"
                        disabled={doctorActionLoading === booking.MaLichHen}
                        onClick={() => handleRecallPatient(booking)}
                      >
                        {doctorActionLoading === booking.MaLichHen ? 'Đang gọi...' : 'Gọi lại vào phòng'}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {waitingConclusionBookings.length === 0 && (
                <tr>
                  <td colSpan="6" className="doctor-empty-cell">
                    Không có bệnh nhân đang chờ kết luận.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination page={conclusionPage} total={waitingConclusionBookings.length} label="ca chờ kết luận" onPageChange={setConclusionPage} />
      </section>

      <section className="doctor-card">
        <div className="doctor-section-header">
          <div>
            <h2>Hồ sơ thăm khám</h2>
            <p>Truy cập lịch sử khám bệnh, đơn thuốc và xét nghiệm cũ của bệnh nhân đang khám.</p>
          </div>
        </div>

        {!activePatient ? (
          <div className="doctor-empty-state">Chọn một bệnh nhân từ hàng đợi để mở hồ sơ thăm khám.</div>
        ) : (
          <div className="doctor-record-layout">
            <aside className="doctor-patient-summary">
              <span>Đang khám</span>
              <h3>{activePatient.HoTen}</h3>
              <p>
                {activePatient.MaBenhAn} · CCCD {activePatient.CCCD}
              </p>
              <p>
                SĐT {activePatient.SDT} · {activePatient.DiaChi}
              </p>
              <strong>Trạng thái: Đang khám</strong>
            </aside>

            <div className="doctor-record-main">
              <div className="doctor-command-panel">
                <h3>{isActiveTreatmentBooking ? 'Thực hiện buổi điều trị' : 'Lệnh lâm sàng lượt khám hiện tại'}</h3>
                {isActiveTreatmentBooking ? (
                  <div className="doctor-treatment-session-panel">
                    <div className="doctor-treatment-session-header">
                      <div>
                        <span>Dịch vụ điều trị</span>
                        <h3>{activeBooking.TenDichVu || activeBookingService?.TenDichVu || 'Dịch vụ điều trị'}</h3>
                        <p>
                          {activeBooking.TenChiNhanh || getShortBranchName(activeBooking.MaChiNhanh)} · Ngày{' '}
                          {activeBooking.NgayKham} · Ca {activeBooking.CaKham}
                        </p>
                      </div>
                      <strong>
                        Buổi {activeTreatmentSession?.BuoiSo || 'đang cập nhật'} /{' '}
                        {activeTreatmentSiblings.length || '...'}
                      </strong>
                    </div>

                    <div className="doctor-treatment-session-grid">
                      <div>
                        <span>Bệnh nhân</span>
                        <strong>{activePatient.HoTen}</strong>
                        <p>{activePatient.MaBenhAn}</p>
                      </div>
                      <div>
                        <span>Mã buổi điều trị</span>
                        <strong>{activeTreatmentSession?.MaLichTrinh || 'Đang liên kết'}</strong>
                        <p>Liên kết lịch hẹn {activeBooking.MaLichHen}</p>
                      </div>
                      <div>
                        <span>Tiến độ liệu trình</span>
                        <strong>
                          {activeTreatmentCompletedCount}/{activeTreatmentSiblings.length || 1} buổi hoàn thành
                        </strong>
                        <p>Buổi hiện tại sẽ được tính hoàn thành sau khi xác nhận.</p>
                      </div>
                      <div>
                        <span>Trạng thái hiện tại</span>
                        <strong>{activeTreatmentSession?.TrangThai || activeBooking.TrangThai}</strong>
                        <p>Không yêu cầu chẩn đoán, kê thuốc hoặc chỉ định xét nghiệm cho buổi điều trị.</p>
                      </div>
                    </div>

                    <div className="doctor-treatment-session-actions">
                      <button
                        type="button"
                        className="doctor-finish-button"
                        onClick={handleCompleteTreatmentSession}
                        disabled={savingExam}
                      >
                        {savingExam ? 'Đang lưu...' : 'Hoàn thành buổi điều trị'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="doctor-workflow-stack">
                  <section className="doctor-workflow-section">
                    <h3>1. Chỉ định Xét nghiệm & Giám sát kết quả Realtime</h3>
                    <div className="doctor-inline-order">
                      <select
                        value={selectedLabServiceId}
                        onChange={(event) => handleClinicalFormChange('MaXetNghiem', event.target.value)}
                        disabled={labServices.length === 0}
                      >
                        {labServices.length === 0 && <option value="">Không có dịch vụ xét nghiệm</option>}
                        {labServices.map((service) => (
                          <option key={service.MaDichVu} value={service.MaDichVu}>
                            {service.TenDichVu}
                          </option>
                        ))}
                      </select>
                      <button type="button" className="doctor-secondary-button" onClick={handleAddLabOrder}>
                        Thêm chỉ định CLS
                      </button>
                    </div>
                    <div className="doctor-lab-grid">
                      {currentLabOrders.map((lab) => (
                        <article key={lab.MaChiTietXN} className="doctor-lab-card">
                          <span>{getService(lab.MaDichVu).TenDichVu}</span>
                          <strong className={lab.TrangThaiXetNghiem === 'Đã có kết quả' ? 'done' : 'pending'}>
                            {lab.TrangThaiXetNghiem === 'Đã có kết quả'
                              ? 'Đã có kết quả'
                              : 'Chờ phòng Lab/Thanh toán'}
                          </strong>
                          <p>{lab.KetQuaXetNghiem || 'Chưa có kết quả từ phòng Lab.'}</p>
                          {lab.TrangThaiXetNghiem === 'Chưa thực hiện' && (
                            <button
                              type="button"
                              className="doctor-secondary-button compact"
                              onClick={() => handleMockLabResult(lab.MaChiTietXN)}
                            >
                              Mô phỏng Lab trả kết quả
                            </button>
                          )}
                        </article>
                      ))}
                      {currentLabOrders.length === 0 && (
                        <p className="doctor-empty-state compact">Chưa có chỉ định xét nghiệm mới.</p>
                      )}
                    </div>
                  </section>

                  <section className="doctor-workflow-section">
                    <h3>2. Chẩn đoán & Kê đơn thuốc</h3>
                    <div className="doctor-command-grid">
                      <label>
                        Triệu chứng
                        <textarea
                          value={clinicalForm.TrieuChung}
                          onChange={(event) => handleClinicalFormChange('TrieuChung', event.target.value)}
                          placeholder="Nhập triệu chứng lâm sàng hiện tại..."
                        />
                      </label>
                      <label className="doctor-autocomplete-field">
                        Chẩn đoán
                        <input
                          value={diagnosisSearch}
                          onChange={(event) => handleDiagnosisSearchChange(event.target.value)}
                          placeholder="Gõ mã ICD-10 hoặc tên bệnh, ví dụ: K, Viêm, Tăng..."
                        />
                        <div className="doctor-suggestion-list">
                          {filteredDiseaseSuggestions.map((disease) => (
                            <button
                              key={disease.MaBenh}
                              type="button"
                              className={clinicalForm.MaBenh === disease.MaBenh ? 'active' : ''}
                              onClick={() => handleSelectDisease(disease)}
                            >
                              <strong>{disease.MaBenh}</strong>
                              <span>{disease.TenBenh}</span>
                            </button>
                          ))}
                        </div>
                      </label>
                      <label>
                        Lời dặn
                        <textarea
                          value={clinicalForm.LoiDan}
                          onChange={(event) => handleClinicalFormChange('LoiDan', event.target.value)}
                          placeholder="Nhập lời dặn, hướng theo dõi hoặc lịch tái khám..."
                        />
                      </label>
                      <label className="doctor-autocomplete-field">
                        Kê đơn thuốc
                        <input
                          value={medicineSearch}
                          onChange={(event) => setMedicineSearch(event.target.value)}
                          placeholder="Gõ tên thuốc, ví dụ: Paracetamol, Amoxicillin..."
                        />
                        <div className="doctor-suggestion-list">
                          {filteredMedicineSuggestions.map((medicine) => (
                            <button
                              key={medicine.MaThuoc}
                              type="button"
                              className={clinicalForm.MaThuoc === medicine.MaThuoc ? 'active' : ''}
                              onClick={() => handleSelectMedicine(medicine)}
                            >
                              <strong>{medicine.TenThuoc}</strong>
                              <span>
                                {medicine.MaThuoc} · {medicine.DonViTinh}
                              </span>
                            </button>
                          ))}
                        </div>
                      </label>
                      <label>
                        Số lượng
                        <input
                          type="number"
                          min="1"
                          value={clinicalForm.SoLuong}
                          onChange={(event) => handleClinicalFormChange('SoLuong', event.target.value)}
                        />
                      </label>
                      <label className="doctor-command-wide">
                        Liều dùng
                        <input
                          value={clinicalForm.LieuDung}
                          onChange={(event) => handleClinicalFormChange('LieuDung', event.target.value)}
                          placeholder="Ví dụ: Uống 1 viên sau ăn sáng trong 7 ngày"
                        />
                      </label>
                      <div className="doctor-prescription-add">
                        <button type="button" className="doctor-secondary-button" onClick={handleAddPrescriptionItem}>
                          ➕ Thêm vào đơn
                        </button>
                      </div>
                    </div>
                    <div className="doctor-prescription-table-wrap">
                      <table className="doctor-table compact doctor-prescription-table">
                        <thead>
                          <tr>
                            <th>STT</th>
                            <th>Tên thuốc</th>
                            <th>Số lượng</th>
                            <th>Đơn vị</th>
                            <th>Liều dùng / Lời dặn thuốc</th>
                            <th>Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentPrescription.map((item, index) => {
                            const medicine = getMedicine(item.MaThuoc)
                            return (
                              <tr key={item.TempId}>
                                <td>{index + 1}</td>
                                <td>{medicine.TenThuoc}</td>
                                <td>{item.SoLuong}</td>
                                <td>{medicine.DonViTinh}</td>
                                <td>{item.LieuDung}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="doctor-danger-button compact"
                                    onClick={() => handleRemovePrescriptionItem(item.TempId)}
                                  >
                                    ❌ Xóa
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                          {currentPrescription.length === 0 && (
                            <tr>
                              <td colSpan="6" className="doctor-empty-cell">
                                Chưa có thuốc nào trong đơn tạm thời.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="doctor-workflow-section">
                    <h3>3. Chỉ định Liệu trình Điều trị Chuyên sâu</h3>
                    <div className="doctor-inline-order">
                      <select
                        value={selectedTreatmentServiceId}
                        onChange={(event) => handleClinicalFormChange('MaDieuTri', event.target.value)}
                        disabled={treatmentServices.length === 0}
                      >
                        {treatmentServices.length === 0 && <option value="">Không có dịch vụ điều trị</option>}
                        {treatmentServices.map((service) => (
                          <option key={service.MaDichVu} value={service.MaDichVu}>
                            {service.TenDichVu}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={clinicalForm.TongSoBuoi}
                        onChange={(event) => handleClinicalFormChange('TongSoBuoi', event.target.value)}
                        aria-label="Tổng số buổi chỉ định"
                      />
                      <button type="button" className="doctor-secondary-button" onClick={handleAddTreatmentPlan}>
                        ➕ Xác nhận chỉ định điều trị
                      </button>
                    </div>
                    <div className="doctor-treatment-list">
                      {currentTreatments.map((item) => (
                        <article key={item.MaLichTrinh}>
                          <strong>{getService(item.MaDichVu).TenDichVu}</strong>
                          <span>
                            {item.SoBuoiDaLam}/{item.TongSoBuoi} buổi - {item.TrangThai}
                          </span>
                        </article>
                      ))}
                      {currentTreatments.length === 0 && (
                        <p className="doctor-empty-state compact">Chưa chỉ định liệu trình điều trị.</p>
                      )}
                    </div>
                  </section>
                </div>

                <div className="doctor-exam-actions">
                  <button type="button" className="doctor-warning-button" onClick={handlePauseForLab} disabled={savingExam}>
                    {savingExam ? 'Đang lưu...' : 'Tạm hoãn - Chờ kết quả Xét nghiệm'}
                  </button>
                  <button type="button" className="doctor-finish-button" onClick={handleCompleteExam} disabled={savingExam}>
                    {savingExam ? 'Đang lưu...' : 'Hoàn thành lượt khám'}
                  </button>
                </div>
                  </>
                )}
              </div>

              <div className="doctor-history-grid">
              <div className="doctor-visit-list">
                <h3>Lịch sử đợt khám</h3>
                {patientVisits.map((visit) => {
                  const disease = getDisease(visit.MaBenh)
                  return (
                    <button
                      key={visit.MaLuotKham}
                      type="button"
                      className={selectedVisit?.MaLuotKham === visit.MaLuotKham ? 'active' : ''}
                      onClick={() => setSelectedVisitId(visit.MaLuotKham)}
                    >
                      <span>{visit.NgayKham}</span>
                      <strong>{visit.MaLuotKham}</strong>
                      <small>{disease.TenBenh}</small>
                    </button>
                  )
                })}
                {patientVisits.length === 0 && (
                  <p className="doctor-empty-state compact">Chưa có lịch sử khám cũ.</p>
                )}
              </div>

              <div className="doctor-visit-detail">
                {selectedVisit ? (
                  <>
                    <div className="doctor-clinical-box">
                      <h3>Chẩn đoán lâm sàng</h3>
                      <p>
                        <strong>Triệu chứng:</strong> {selectedVisit.TrieuChung}
                      </p>
                      <p>
                        <strong>ICD-10:</strong> {selectedVisit.MaBenh} -{' '}
                        {getDisease(selectedVisit.MaBenh).TenBenh}
                      </p>
                      <p>
                        <strong>Lời dặn:</strong> {selectedVisit.LoiDan}
                      </p>
                    </div>

                    <div className="doctor-subsection">
                      <h3>Đơn thuốc cũ</h3>
                      <table className="doctor-table compact">
                        <thead>
                          <tr>
                            <th>STT</th>
                            <th>Tên thuốc</th>
                            <th>Số lượng</th>
                            <th>Đơn vị</th>
                            <th>Liều dùng</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPrescriptions.map((item, index) => {
                            const medicine = getMedicine(item.MaThuoc)
                            return (
                              <tr key={item.MaDonThuoc}>
                                <td>{index + 1}</td>
                                <td>{medicine.TenThuoc}</td>
                                <td>{item.SoLuong}</td>
                                <td>{medicine.DonViTinh}</td>
                                <td>{item.LieuDung}</td>
                              </tr>
                            )
                          })}
                          {selectedPrescriptions.length === 0 && (
                            <tr>
                              <td colSpan="5" className="doctor-empty-cell">
                                Không có đơn thuốc trong lượt khám này.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="doctor-subsection">
                      <h3>Kết quả xét nghiệm cũ</h3>
                      <div className="doctor-lab-grid">
                        {selectedLabs.map((lab) => (
                          <article key={lab.MaChiTietXN} className="doctor-lab-card">
                            <span>{getService(lab.MaDichVu).TenDichVu}</span>
                            <strong>{lab.TrangThaiXetNghiem}</strong>
                            <p>{lab.KetQuaXetNghiem || 'Chưa có kết quả.'}</p>
                          </article>
                        ))}
                        {selectedLabs.length === 0 && (
                          <p className="doctor-empty-state compact">Không có xét nghiệm trong lượt khám này.</p>
                        )}
                      </div>
                    </div>

                    <div className="doctor-subsection">
                      <h3>Liệu trình điều trị cũ</h3>
                      <div className="doctor-treatment-history-list">
                        {selectedTreatments.map((treatment) => (
                          <article key={treatment.MaLichTrinh}>
                            <strong>{treatment.TenDichVu || getService(treatment.MaDichVu).TenDichVu}</strong>
                            <div>
                              <span>Tổng số buổi: {treatment.TongSoBuoi}</span>
                              <span>Đã làm: {treatment.SoBuoiDaLam}</span>
                              <span>{treatment.TrangThai}</span>
                            </div>
                            <p>{treatment.GhiChuDieuTri}</p>
                          </article>
                        ))}
                        {selectedTreatments.length === 0 && (
                          <p className="doctor-empty-state compact">Không có liệu trình điều trị trong lượt khám này.</p>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="doctor-empty-state">Chưa chọn đợt khám lịch sử.</div>
                )}
	              </div>
              </div>
            </div>
          </div>
        )}
      </section>
        </>
      ) : activeDoctorTab === 'schedule' ? (
        <section className="doctor-card">
          <div className="doctor-section-header">
            <div>
              <h2>Lịch trực cá nhân theo tuần</h2>
              <p>Chỉ hiển thị lịch từ ngày 2026-05-31 trở đi, gồm đủ 4 ca vận hành. Nghỉ trưa: 12:00 - 13:30.</p>
            </div>
            <strong>{mySchedules.length} ca trực</strong>
          </div>
          {weeklyScheduleGroups.length > 0 ? (
            <div className="doctor-weekly-stack">
              {weeklyScheduleGroups.map((week, index) => (
                <section key={week.weekStartKey} className="doctor-weekly-card">
                  <header>
                    <h3>{index === 0 ? 'Tuần hiện tại' : `Tuần ${index + 1}`}</h3>
                    <span>
                      {week.weekStartKey} đến {week.weekEndKey}
                    </span>
                  </header>
                  <div className="doctor-week-grid">
                    <div className="doctor-week-cell header shift">Ca trực</div>
                    {week.days.map((day) => (
                      <div key={day.dateKey} className="doctor-week-cell header">
                        <strong>{day.label}</strong>
                        <span>{day.dateKey.slice(5)}</span>
                      </div>
                    ))}
                    {[1, 2, 3, 4].map((shift) => (
                      <div key={shift} className="doctor-week-row">
                        <div className="doctor-week-cell shift-label">{getShiftLabel(shift)}</div>
                        {week.days.map((day) => {
                          const schedule = week.schedules.find(
                            (item) =>
                              item.NgayTruc === day.dateKey &&
                              Number(item.CaTruc) === Number(shift),
                          )
                          return (
                            <div key={`${day.dateKey}-${shift}`} className="doctor-week-cell">
                              {schedule ? (
                                <span className="doctor-schedule-badge">
                                  {getShortBranchName(schedule.MaChiNhanh)} ({schedule.MaChiNhanh})
                                </span>
                              ) : (
                                <span className="doctor-week-empty">-</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="doctor-empty-state">Chưa có lịch trực tương lai nào được phân cho bác sĩ.</div>
          )}
        </section>
      ) : activeDoctorTab === 'history' ? (
        <section className="doctor-card">
          <div className="doctor-section-header">
            <div>
              <h2>Lịch sử đợt khám</h2>
              <p>Các lượt khám đã hoàn thành của bác sĩ, có thể mở chi tiết đơn thuốc và xét nghiệm.</p>
            </div>
            <strong>{completedEncounterRows.length} lượt khám</strong>
          </div>
          <div className="doctor-table-wrap">
            <table className="doctor-table doctor-history-table">
              <thead>
                <tr>
                  <th>Ngày khám</th>
                  <th>Mã lượt khám</th>
                  <th>Họ tên bệnh nhân</th>
                  <th>Chẩn đoán</th>
                  <th>Triệu chứng</th>
                  <th>Lời dặn</th>
                </tr>
              </thead>
              <tbody>
                {getPageRows(completedEncounterRows, historyPage).map((row) => (
                  <tr
                    key={row.visit.MaLuotKham}
                    className="doctor-clickable-row"
                    onClick={() => setHistoryDetail(row)}
                  >
                    <td>{row.booking.NgayKham}</td>
                    <td>{row.visit.MaLuotKham}</td>
                    <td>
                      <strong>{row.patient.HoTen}</strong>
                      <span>{row.patient.MaBenhAn}</span>
                    </td>
                    <td>
                      {row.visit.MaBenh} - {row.disease.TenBenh}
                    </td>
                    <td>{row.visit.TrieuChung}</td>
                    <td>{row.visit.LoiDan}</td>
                  </tr>
                ))}
                {completedEncounterRows.length === 0 && (
                  <tr>
                    <td colSpan="6" className="doctor-empty-cell">
                      Chưa có lượt khám đã hoàn thành.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination page={historyPage} total={completedEncounterRows.length} label="lượt khám" onPageChange={setHistoryPage} />
        </section>
      ) : (
        <section className="doctor-card">
          <div className="doctor-section-header">
            <div>
              <h2>Cài đặt tài khoản</h2>
              <p>Cập nhật thông tin liên hệ và bảo mật cá nhân ngoài không gian khám bệnh.</p>
            </div>
          </div>
          <div className="doctor-account-layout">
            <section className="doctor-account-summary">
              <div>
                <span>Mã bác sĩ</span>
                <strong>{doctorProfile.MaBacSi}</strong>
              </div>
              <div>
                <span>Họ tên</span>
                <strong>Bác sĩ {doctorProfile.HoTen}</strong>
              </div>
              <div>
                <span>Chuyên khoa</span>
                <strong>{doctorProfile.ChuyenKhoa}</strong>
              </div>
              <div>
                <span>Chi nhánh mặc định</span>
                <strong>{doctorProfile.TenChiNhanh}</strong>
              </div>
            </section>

            <form className="doctor-settings-form" onSubmit={handleUpdatePhone}>
              <label>
                Số điện thoại liên hệ
                <input
                  value={contactForm.SDT}
                  onChange={(event) => setContactForm({ SDT: event.target.value })}
                  placeholder="Nhập số điện thoại mới"
                />
              </label>
              <button type="submit" className="doctor-primary-button">
                Lưu số điện thoại
              </button>
            </form>

            <div className="doctor-security-block">
              <button
                type="button"
                className="doctor-secondary-button"
                onClick={() => setShowPasswordForm((current) => !current)}
              >
                🔑 Đổi mật khẩu
              </button>
              {showPasswordForm && (
                <form className="doctor-password-form" onSubmit={handleChangePassword}>
                  <label>
                    Mật khẩu cũ
                    <input
                      type="password"
                      value={passwordForm.oldPassword}
                      onChange={(event) =>
                        setPasswordForm((current) => ({ ...current, oldPassword: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Mật khẩu mới
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(event) =>
                        setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Xác nhận mật khẩu mới
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(event) =>
                        setPasswordForm((current) => ({
                          ...current,
                          confirmPassword: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <button type="submit" className="doctor-primary-button">
                    Xác nhận đổi mật khẩu
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      )}

      {historyDetail && (
        <div className="doctor-history-modal-overlay">
          <section className="doctor-history-modal">
            <button
              type="button"
              className="doctor-history-modal-close"
              onClick={() => setHistoryDetail(null)}
              aria-label="Đóng chi tiết lịch sử khám"
            >
              ×
            </button>
            <span className="doctor-kicker">Chi tiết lượt khám</span>
            <h2>
              {historyDetail.visit.MaLuotKham} - {historyDetail.patient.HoTen}
            </h2>
            <div className="doctor-history-modal-grid">
              <section>
                <h3>Đơn thuốc cũ</h3>
                <table className="doctor-table compact">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Tên thuốc</th>
                      <th>Số lượng</th>
                      <th>Đơn vị</th>
                      <th>Liều dùng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prescriptionDetails
                      .filter((item) => item.MaLuotKham === historyDetail.visit.MaLuotKham)
                      .map((item, index) => {
                        const medicine = getMedicine(item.MaThuoc)
                        return (
                          <tr key={item.MaDonThuoc}>
                            <td>{index + 1}</td>
                            <td>{medicine.TenThuoc}</td>
                            <td>{item.SoLuong}</td>
                            <td>{medicine.DonViTinh}</td>
                            <td>{item.LieuDung}</td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </section>
              <section>
                <h3>Kết quả xét nghiệm cũ</h3>
                <div className="doctor-lab-grid">
                  {labDetails
                    .filter((lab) => lab.MaLuotKham === historyDetail.visit.MaLuotKham)
                    .map((lab) => (
                      <article key={lab.MaChiTietXN} className="doctor-lab-card">
                        <span>{getService(lab.MaDichVu).TenDichVu}</span>
                        <strong className="done">{lab.TrangThaiXetNghiem}</strong>
                        <p>{lab.KetQuaXetNghiem || 'Chưa có kết quả.'}</p>
                      </article>
                    ))}
                  {labDetails.filter((lab) => lab.MaLuotKham === historyDetail.visit.MaLuotKham).length === 0 && (
                    <p className="doctor-empty-state compact">Không có xét nghiệm trong lượt khám này.</p>
                  )}
                </div>
              </section>
              <section>
                <h3>Liệu trình điều trị cũ</h3>
                <div className="doctor-treatment-history-list">
                  {treatmentSchedules
                    .filter((treatment) => treatment.MaLuotKham === historyDetail.visit.MaLuotKham)
                    .map((treatment) => (
                      <article key={treatment.MaLichTrinh}>
                        <strong>{treatment.TenDichVu || getService(treatment.MaDichVu).TenDichVu}</strong>
                        <div>
                          <span>Tổng số buổi: {treatment.TongSoBuoi}</span>
                          <span>Đã làm: {treatment.SoBuoiDaLam}</span>
                          <span>{treatment.TrangThai}</span>
                        </div>
                        <p>{treatment.GhiChuDieuTri}</p>
                      </article>
                    ))}
                  {treatmentSchedules.filter((treatment) => treatment.MaLuotKham === historyDetail.visit.MaLuotKham).length === 0 && (
                    <p className="doctor-empty-state compact">Không có liệu trình điều trị trong lượt khám này.</p>
                  )}
                </div>
              </section>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
