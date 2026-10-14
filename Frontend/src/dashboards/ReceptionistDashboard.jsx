import { useEffect, useMemo, useState } from 'react'
import { LogOut } from 'lucide-react'
import { EMPTY_CATALOG_DATA } from '../shared/catalog.js'
import { getTodayDateKey } from '../shared/dates.js'
import { checkIn, getCheckinAppointments, getWaitingList, searchCheckinAppointment } from '../api/appointment.js'
import TablePagination from './TablePagination.jsx'
import { getCurrentPage, getPageRows, TABLE_PAGE_SIZE } from './tablePagination.js'

export default function ReceptionistDashboard({ user, onLogout, showNotification, catalogData = EMPTY_CATALOG_DATA }) {
  const TODAY = getTodayDateKey()
  const [activeQueueTab, setActiveQueueTab] = useState('prebooked')
  const [prebookedPage, setPrebookedPage] = useState(0)
  const [queueGroupPage, setQueueGroupPage] = useState(0)
  const [queuePagesByDoctor, setQueuePagesByDoctor] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [feedback, setFeedback] = useState('')
  const [checkinRows, setCheckinRows] = useState([])
  const [queueRows, setQueueRows] = useState([])
  const [searchRows, setSearchRows] = useState([])
  const [hasLoadedCheckinRows, setHasLoadedCheckinRows] = useState(false)
  const [hasLoadedQueueRows, setHasLoadedQueueRows] = useState(false)
  const [checkinRowsLoading, setCheckinRowsLoading] = useState(false)
  const [queueRowsLoading, setQueueRowsLoading] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [receptionError, setReceptionError] = useState('')
  const [searchError, setSearchError] = useState('')
  const [checkingInId, setCheckingInId] = useState('')
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
  const [services] = useState([
    { MaDichVu: 'DV_KHAM_NOI', TenDichVu: 'Khám Nội Tổng Quát', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 150000 },
    { MaDichVu: 'DV_KHAM_GIA_DINH', TenDichVu: 'Khám Sức Khỏe Gia Đình', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 250000 },
    { MaDichVu: 'DV_KHAM_LAO_KHOA', TenDichVu: 'Khám Tư Vấn Sức Khỏe Lão Khoa', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 180000 },
    { MaDichVu: 'DV_KHAM_TIM_MACH', TenDichVu: 'Khám Sàng Lọc Tim Mạch - Huyết Áp', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 200000 },
    { MaDichVu: 'DV_KHAM_TIEU_HOA', TenDichVu: 'Khám Tiêu Hóa - Gan Mật', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 180000 },
    { MaDichVu: 'DV_KHAM_HO_HAP', TenDichVu: 'Khám Bệnh Lý Đường Hô Hấp', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 170000 },
    { MaDichVu: 'DV_KHAM_NOI_TIET', TenDichVu: 'Khám Sàng Lọc Tiểu Đường & Nội Tiết', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 220000 },
    { MaDichVu: 'DV_KHAM_DINH_DUONG', TenDichVu: 'Khám Tư Vấn Dinh Dưỡng Chuyên Sâu', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 150000 },
    { MaDichVu: 'DV_KHAM_RANG', TenDichVu: 'Khám Răng Hàm Mặt Định Kỳ', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 200000 },
    { MaDichVu: 'DV_LAY_CAO', TenDichVu: 'Lấy Cao Răng Và Đánh Bóng Thẩm Mỹ', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 150000 },
    { MaDichVu: 'DV_KHAM_NIENG_RANG', TenDichVu: 'Khám Tư Vấn Chỉnh Nha/Niềng Răng', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 300000 },
    { MaDichVu: 'DV_KHAM_IMPLANT', TenDichVu: 'Khám Tư Vấn Trồng Răng Implant', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 300000 },
    { MaDichVu: 'DV_KHAM_TMH', TenDichVu: 'Khám Tai Mũi Họng Thông Thường', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 180000 },
    { MaDichVu: 'DV_NOI_SOI_TMH', TenDichVu: 'Nội Soi Tai Mũi Họng Ống Mềm', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 250000 },
    { MaDichVu: 'DV_KHAM_THINH_LUC', TenDichVu: 'Khám Đo Thính Lực Đơn Âm', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 200000 },
  ])
  const [staffList] = useState([
    { MaBacSi: 'BS001', HoTen: 'Nguyễn Văn An', ChuyenKhoa: 'Nội tổng quát', SDT: '0911222333' },
    { MaBacSi: 'BS002', HoTen: 'Lê Thị Bình', ChuyenKhoa: 'Răng hàm mặt', SDT: '0922333444' },
    { MaBacSi: 'BS003', HoTen: 'Phạm Hoàng Long', ChuyenKhoa: 'Tai mũi họng', SDT: '0933444555' },
    { MaBacSi: 'BS004', HoTen: 'Trần Trần Đức', ChuyenKhoa: 'Nội tổng quát', SDT: '0944555666' },
    { MaBacSi: 'BS005', HoTen: 'Nguyễn Thị Minh', ChuyenKhoa: 'Nội tổng quát', SDT: '0912345678' },
    { MaBacSi: 'BS006', HoTen: 'Phan Văn Khải', ChuyenKhoa: 'Răng hàm mặt', SDT: '0923456789' },
    { MaBacSi: 'BS007', HoTen: 'Hoàng Lê Giang', ChuyenKhoa: 'Tai mũi họng', SDT: '0934567890' },
    { MaBacSi: 'BS008', HoTen: 'Vũ Ngô Hùng', ChuyenKhoa: 'Răng hàm mặt', SDT: '0945678901' },
    { MaBacSi: 'BS009', HoTen: 'Đỗ Thúy Hạnh', ChuyenKhoa: 'Nội tổng quát', SDT: '0913456789' },
    { MaBacSi: 'BS010', HoTen: 'Bùi Chí Kiên', ChuyenKhoa: 'Răng hàm mặt', SDT: '0924567890' },
    { MaBacSi: 'BS011', HoTen: 'Lý Thu Thảo', ChuyenKhoa: 'Tai mũi họng', SDT: '0935678901' },
    { MaBacSi: 'BS012', HoTen: 'Đặng Quốc Bảo', ChuyenKhoa: 'Tai mũi họng', SDT: '0946789012' },
    { MaBacSi: 'BS013', HoTen: 'Ngô Bảo Ngọc', ChuyenKhoa: 'Nội tổng quát', SDT: '0914567890' },
    { MaBacSi: 'BS014', HoTen: 'Dương Văn Lâm', ChuyenKhoa: 'Răng hàm mặt', SDT: '0925678901' },
    { MaBacSi: 'BS015', HoTen: 'Võ Thị Sáu', ChuyenKhoa: 'Tai mũi họng', SDT: '0936789012' },
    { MaBacSi: 'BS016', HoTen: 'Tống Phước Hải', ChuyenKhoa: 'Nội tổng quát', SDT: '0947890123' },
    { MaBacSi: 'BS017', HoTen: 'Đinh Công Mạnh', ChuyenKhoa: 'Nội tổng quát', SDT: '0915678901' },
    { MaBacSi: 'BS018', HoTen: 'Mai Phương Thảo', ChuyenKhoa: 'Răng hàm mặt', SDT: '0926789012' },
    { MaBacSi: 'BS019', HoTen: 'Hồ Tiến Dũng', ChuyenKhoa: 'Tai mũi họng', SDT: '0937890123' },
    { MaBacSi: 'BS020', HoTen: 'Trịnh Đình Quang', ChuyenKhoa: 'Răng hàm mặt', SDT: '0948901234' },
    { MaBacSi: 'BS021', HoTen: 'Vương Kim Chi', ChuyenKhoa: 'Nội tổng quát', SDT: '0916789012' },
    { MaBacSi: 'BS022', HoTen: 'Đoàn Nguyên Đức', ChuyenKhoa: 'Răng hàm mặt', SDT: '0927890123' },
    { MaBacSi: 'BS023', HoTen: 'Lưu Hồng Quang', ChuyenKhoa: 'Tai mũi họng', SDT: '0938901234' },
  ])
  const [patients] = useState([
    {
      MaBenhAn: 'BN001',
      HoTen: 'Trần Quang Hải',
      CCCD: '001095012345',
      SDT: '0901234567',
      DiaChi: 'Cầu Giấy, Hà Nội',
      MaSoBHYT: 'DN4010123456789',
      KyTuDauBHYT: 'DN',
    },
    {
      MaBenhAn: 'BN002',
      HoTen: 'Nguyễn Thị Mai',
      CCCD: '001200054321',
      SDT: '0907654321',
      DiaChi: 'Hai Bà Trưng, Hà Nội',
      MaSoBHYT: '',
      KyTuDauBHYT: '',
    },
    {
      MaBenhAn: 'BN003',
      HoTen: 'Phạm Lê Minh',
      CCCD: '001221098765',
      SDT: '0911999888',
      DiaChi: 'Đống Đa, Hà Nội',
      MaSoBHYT: 'TE1010999888777',
      KyTuDauBHYT: 'TE',
    },
    {
      MaBenhAn: 'BN004',
      HoTen: 'Lê Hoàng Nam',
      CCCD: '001186000004',
      SDT: '0904000004',
      DiaChi: 'Nam Từ Liêm, Hà Nội',
      MaSoBHYT: 'DN401000000004',
      KyTuDauBHYT: 'DN',
    },
    {
      MaBenhAn: 'BN005',
      HoTen: 'Đỗ Minh Châu',
      CCCD: '001187000005',
      SDT: '0905000005',
      DiaChi: 'Thanh Xuân, Hà Nội',
      MaSoBHYT: '',
      KyTuDauBHYT: '',
    },
    {
      MaBenhAn: 'BN006',
      HoTen: 'Vũ Gia Hân',
      CCCD: '001188000006',
      SDT: '0906000006',
      DiaChi: 'Ba Đình, Hà Nội',
      MaSoBHYT: 'HT401000000006',
      KyTuDauBHYT: 'HT',
    },
    {
      MaBenhAn: 'BN007',
      HoTen: 'Hoàng Đức Anh',
      CCCD: '001189000007',
      SDT: '0907000007',
      DiaChi: 'Cầu Giấy, Hà Nội',
      MaSoBHYT: 'DN401000000007',
      KyTuDauBHYT: 'DN',
    },
    {
      MaBenhAn: 'BN008',
      HoTen: 'Phan Ngọc Linh',
      CCCD: '001190000008',
      SDT: '0908000008',
      DiaChi: 'Đống Đa, Hà Nội',
      MaSoBHYT: '',
      KyTuDauBHYT: '',
    },
    {
      MaBenhAn: 'BN009',
      HoTen: 'Bùi Quang Huy',
      CCCD: '001191000009',
      SDT: '0909000009',
      DiaChi: 'Long Biên, Hà Nội',
      MaSoBHYT: 'DN401000000009',
      KyTuDauBHYT: 'DN',
    },
    {
      MaBenhAn: 'BN010',
      HoTen: 'Đặng Khánh Vy',
      CCCD: '001192000010',
      SDT: '0910000010',
      DiaChi: 'Hai Bà Trưng, Hà Nội',
      MaSoBHYT: 'TE101000000010',
      KyTuDauBHYT: 'TE',
    },
    {
      MaBenhAn: 'BN011',
      HoTen: 'Ngô Tuấn Kiệt',
      CCCD: '001193000011',
      SDT: '0911000011',
      DiaChi: 'Hoàn Kiếm, Hà Nội',
      MaSoBHYT: '',
      KyTuDauBHYT: '',
    },
    {
      MaBenhAn: 'BN012',
      HoTen: 'Mai Phương Anh',
      CCCD: '001194000012',
      SDT: '0912000012',
      DiaChi: 'Tây Hồ, Hà Nội',
      MaSoBHYT: 'DN401000000012',
      KyTuDauBHYT: 'DN',
    },
    {
      MaBenhAn: 'BN013',
      HoTen: 'Cao Nhật Minh',
      CCCD: '001195000013',
      SDT: '0913000013',
      DiaChi: 'Hoàng Mai, Hà Nội',
      MaSoBHYT: '',
      KyTuDauBHYT: '',
    },
    {
      MaBenhAn: 'BN014',
      HoTen: 'Tạ Thu Trang',
      CCCD: '001196000014',
      SDT: '0914000014',
      DiaChi: 'Hà Đông, Hà Nội',
      MaSoBHYT: 'DN401000000014',
      KyTuDauBHYT: 'DN',
    },
    {
      MaBenhAn: 'BN015',
      HoTen: 'Lương Quốc Hưng',
      CCCD: '001197000015',
      SDT: '0915000015',
      DiaChi: 'Gia Lâm, Hà Nội',
      MaSoBHYT: 'HT401000000015',
      KyTuDauBHYT: 'HT',
    },
  ])
  const [bookings, setBookings] = useState([
    {
      MaLichHen: 'LH_RT_001',
      MaBenhAn: 'BN001',
      MaCauHinh: 'CH_CG_DV_KHAM_NOI',
      MaDichVu: 'DV_KHAM_NOI',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 1,
      MaBacSi: 'BS001',
      PaymentToken: 'PAY_MOCK_310501',
      STT_HangDoi: 1,
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_RT_002',
      MaBenhAn: 'BN004',
      MaCauHinh: 'CH_CG_DV_KHAM_NOI',
      MaDichVu: 'DV_KHAM_NOI',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 1,
      MaBacSi: 'BS001',
      PaymentToken: 'PAY_MOCK_310502',
      STT_HangDoi: 2,
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_RT_003',
      MaBenhAn: 'BN005',
      MaCauHinh: 'CH_CG_DV_KHAM_GIA_DINH',
      MaDichVu: 'DV_KHAM_GIA_DINH',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 1,
      MaBacSi: 'BS001',
      PaymentToken: 'PAY_MOCK_310503',
      STT_HangDoi: 3,
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_RT_004',
      MaBenhAn: 'BN006',
      MaCauHinh: 'CH_CG_DV_KHAM_TIM_MACH',
      MaDichVu: 'DV_KHAM_TIM_MACH',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 1,
      MaBacSi: 'BS001',
      PaymentToken: 'PAY_MOCK_310504',
      TrangThai: 'Đã xác nhận',
    },
    {
      MaLichHen: 'LH_RT_005',
      MaBenhAn: 'BN007',
      MaCauHinh: 'CH_CG_DV_KHAM_TIEU_HOA',
      MaDichVu: 'DV_KHAM_TIEU_HOA',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 1,
      MaBacSi: 'BS001',
      PaymentToken: 'PAY_MOCK_310505',
      TrangThai: 'Đã xác nhận',
    },
    {
      MaLichHen: 'LH_RT_006',
      MaBenhAn: 'BN003',
      MaCauHinh: 'CH_CG_DV_KHAM_RANG',
      MaDichVu: 'DV_KHAM_RANG',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 2,
      MaBacSi: 'BS002',
      PaymentToken: 'PAY_MOCK_310506',
      STT_HangDoi: 1,
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_RT_007',
      MaBenhAn: 'BN008',
      MaCauHinh: 'CH_CG_DV_LAY_CAO',
      MaDichVu: 'DV_LAY_CAO',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 2,
      MaBacSi: 'BS002',
      PaymentToken: 'PAY_MOCK_310507',
      STT_HangDoi: 2,
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_RT_008',
      MaBenhAn: 'BN009',
      MaCauHinh: 'CH_CG_DV_KHAM_NIENG_RANG',
      MaDichVu: 'DV_KHAM_NIENG_RANG',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 2,
      MaBacSi: 'BS002',
      PaymentToken: 'PAY_MOCK_310508',
      STT_HangDoi: 3,
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_RT_009',
      MaBenhAn: 'BN010',
      MaCauHinh: 'CH_CG_DV_KHAM_IMPLANT',
      MaDichVu: 'DV_KHAM_IMPLANT',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 2,
      MaBacSi: 'BS002',
      PaymentToken: 'PAY_MOCK_310509',
      TrangThai: 'Đã xác nhận',
    },
    {
      MaLichHen: 'LH_RT_010',
      MaBenhAn: 'BN011',
      MaCauHinh: 'CH_CG_DV_KHAM_RANG',
      MaDichVu: 'DV_KHAM_RANG',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 2,
      MaBacSi: 'BS002',
      PaymentToken: 'PAY_MOCK_310510',
      TrangThai: 'Đã xác nhận',
    },
    {
      MaLichHen: 'LH_RT_011',
      MaBenhAn: 'BN012',
      MaCauHinh: 'CH_CG_DV_KHAM_TMH',
      MaDichVu: 'DV_KHAM_TMH',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 3,
      MaBacSi: 'BS003',
      PaymentToken: 'PAY_MOCK_310511',
      STT_HangDoi: 1,
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_RT_012',
      MaBenhAn: 'BN013',
      MaCauHinh: 'CH_CG_DV_NOI_SOI_TMH',
      MaDichVu: 'DV_NOI_SOI_TMH',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 3,
      MaBacSi: 'BS003',
      PaymentToken: 'PAY_MOCK_310512',
      TrangThai: 'Đã xác nhận',
    },
    {
      MaLichHen: 'LH_RT_013',
      MaBenhAn: 'BN014',
      MaCauHinh: 'CH_CG_DV_KHAM_HO_HAP',
      MaDichVu: 'DV_KHAM_HO_HAP',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 4,
      MaBacSi: 'BS004',
      PaymentToken: 'PAY_MOCK_310513',
      STT_HangDoi: 1,
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_RT_014',
      MaBenhAn: 'BN015',
      MaCauHinh: 'CH_CG_DV_KHAM_NOI_TIET',
      MaDichVu: 'DV_KHAM_NOI_TIET',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 4,
      MaBacSi: 'BS004',
      PaymentToken: 'PAY_MOCK_310514',
      TrangThai: 'Đã xác nhận',
    },
    {
      MaLichHen: 'LH_RT_015',
      MaBenhAn: 'BN002',
      MaCauHinh: 'CH_HBT_DV_KHAM_TMH',
      MaDichVu: 'DV_KHAM_TMH',
      MaChiNhanh: 'CN_HBT',
      NgayKham: TODAY,
      CaKham: 1,
      MaBacSi: 'BS015',
      PaymentToken: 'PAY_MOCK_310515',
      STT_HangDoi: 1,
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_RT_016',
      MaBenhAn: 'BN004',
      MaCauHinh: 'CH_HBT_DV_KHAM_GIA_DINH',
      MaDichVu: 'DV_KHAM_GIA_DINH',
      MaChiNhanh: 'CN_HBT',
      NgayKham: TODAY,
      CaKham: 1,
      MaBacSi: 'BS013',
      PaymentToken: 'PAY_MOCK_310516',
      STT_HangDoi: 1,
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_RT_017',
      MaBenhAn: 'BN005',
      MaCauHinh: 'CH_HBT_DV_KHAM_RANG',
      MaDichVu: 'DV_KHAM_RANG',
      MaChiNhanh: 'CN_HBT',
      NgayKham: TODAY,
      CaKham: 2,
      MaBacSi: 'BS014',
      PaymentToken: 'PAY_MOCK_310517',
      TrangThai: 'Đã xác nhận',
    },
    {
      MaLichHen: 'LH_RT_018',
      MaBenhAn: 'BN006',
      MaCauHinh: 'CH_HBT_DV_KHAM_TIEU_HOA',
      MaDichVu: 'DV_KHAM_TIEU_HOA',
      MaChiNhanh: 'CN_HBT',
      NgayKham: TODAY,
      CaKham: 3,
      MaBacSi: 'BS016',
      PaymentToken: 'PAY_MOCK_310518',
      TrangThai: 'Đã xác nhận',
    },
    {
      MaLichHen: 'LH_RT_019',
      MaBenhAn: 'BN007',
      MaCauHinh: 'CH_HBT_DV_KHAM_IMPLANT',
      MaDichVu: 'DV_KHAM_IMPLANT',
      MaChiNhanh: 'CN_HBT',
      NgayKham: TODAY,
      CaKham: 4,
      MaBacSi: 'BS018',
      PaymentToken: 'PAY_MOCK_310519',
      STT_HangDoi: 1,
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_RT_020',
      MaBenhAn: 'BN001',
      MaCauHinh: 'CH_CG_DV_KHAM_TIEU_HOA',
      MaDichVu: 'DV_KHAM_TIEU_HOA',
      MaChiNhanh: 'CN_CG',
      NgayKham: '2026-05-30',
      CaKham: 2,
      MaBacSi: 'BS004',
      PaymentToken: 'PAY_MOCK_300501',
      TrangThai: 'Hoàn thành',
    },
  ])

  const effectiveBranches = catalogData?.branches || []
  const effectiveServices = catalogData?.services || []
  const catalogDoctors = Object.values(
    (catalogData?.doctorSchedules || []).reduce((doctorMap, schedule) => {
      if (!schedule.MaBacSi || doctorMap[schedule.MaBacSi]) return doctorMap

      doctorMap[schedule.MaBacSi] = {
        MaBacSi: schedule.MaBacSi,
        HoTen: schedule.TenBacSi || schedule.HoTen || schedule.MaBacSi,
        ChuyenKhoa: schedule.ChuyenKhoa || '',
        SDT: schedule.SDT || '',
      }
      return doctorMap
    }, {}),
  )
  const effectiveStaffList = catalogDoctors

  const maChiNhanh = user?.MaChiNhanh || effectiveBranches[0]?.MaChiNhanh || ''
  const currentBranch = effectiveBranches.find((branch) => branch.MaChiNhanh === maChiNhanh) || effectiveBranches[0]
  const branchDoctorsToday = useMemo(() => {
    const doctorMap = (catalogData?.doctorSchedules || [])
      .filter((schedule) => schedule.MaChiNhanh === maChiNhanh && schedule.NgayTruc === TODAY)
      .reduce((currentMap, schedule) => {
        if (!schedule.MaBacSi || currentMap[schedule.MaBacSi]) return currentMap

        currentMap[schedule.MaBacSi] = {
          MaBacSi: schedule.MaBacSi,
          HoTen: schedule.TenBacSi || schedule.HoTen || schedule.MaBacSi,
          ChuyenKhoa: schedule.ChuyenKhoa || '',
          SDT: schedule.SDT || '',
        }
        return currentMap
      }, {})

    return Object.values(doctorMap)
  }, [catalogData?.doctorSchedules, maChiNhanh, TODAY])

  const normalizeReceptionBooking = (appointment) => ({
    MaLichHen: appointment.MaLichHen,
    MaBenhAn: appointment.MaBenhAn || '',
    MaCauHinh: appointment.MaCauHinh || '',
    MaDichVu: appointment.MaDichVu || '',
    TenDichVu: appointment.TenDichVu || '',
    MaChiNhanh: appointment.MaChiNhanh || maChiNhanh,
    NgayKham: appointment.NgayKham || TODAY,
    CaKham: appointment.CaKham || '',
    MaBacSi: appointment.MaBacSi || '',
    TenBacSi: appointment.TenBacSi || appointment.HoTenBacSi || '',
    ChuyenKhoa: appointment.ChuyenKhoa || '',
    PaymentToken: appointment.PaymentToken || '',
    GiaCuoi: appointment.GiaCuoi || 0,
    STT: appointment.STT || appointment.STT_HangDoi || '',
    STT_HangDoi: appointment.STT_HangDoi || appointment.STT || '',
    TrangThai: appointment.TrangThai || 'Chờ khám',
    MaLeTan: appointment.MaLeTan || '',
    patient: {
      MaBenhAn: appointment.MaBenhAn || '',
      HoTen: appointment.HoTen || appointment.TenBenhNhan || 'Chưa rõ',
      CCCD: appointment.CCCD || '',
      SDT: appointment.SDT || appointment.SDTBenhNhan || 'Chưa cập nhật',
    },
  })

  const loadCheckinAppointments = async () => {
    if (!maChiNhanh) return

    setCheckinRowsLoading(true)
    setReceptionError('')

    try {
      const params = new URLSearchParams({ ma_chi_nhanh: maChiNhanh, ngay: TODAY })
      const response = await getCheckinAppointments(params.toString())
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể tải danh sách chờ tiếp đón.')
      }

      setCheckinRows(Array.isArray(result.data) ? result.data.map(normalizeReceptionBooking) : [])
      setHasLoadedCheckinRows(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách chờ tiếp đón.'
      setReceptionError(message)
      console.warn('RECEPTION_CHECKIN_APPOINTMENTS_LOAD_FAILED', message)
    } finally {
      setCheckinRowsLoading(false)
    }
  }

  const loadDoctorQueues = async () => {
    if (!maChiNhanh) return

    if (branchDoctorsToday.length === 0) {
      setQueueRows([])
      setHasLoadedQueueRows(true)
      return
    }

    setQueueRowsLoading(true)
    setReceptionError('')

    try {
      const queueResults = await Promise.all(
        branchDoctorsToday.map(async (doctor) => {
          const params = new URLSearchParams({ ma_chi_nhanh: maChiNhanh })
          const response = await getWaitingList(doctor.MaBacSi, TODAY, params.toString(),
          )
          const result = await response.json()

          if (!response.ok || !result?.success) {
            throw new Error(result?.message || `Không thể tải hàng đợi của ${doctor.MaBacSi}.`)
          }

          return Array.isArray(result.data) ? result.data : []
        }),
      )

      setQueueRows(queueResults.flat().map(normalizeReceptionBooking))
      setHasLoadedQueueRows(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải hàng đợi bác sĩ.'
      setReceptionError(message)
      console.warn('RECEPTION_DOCTOR_QUEUES_LOAD_FAILED', message)
    } finally {
      setQueueRowsLoading(false)
    }
  }

  useEffect(() => {
    loadCheckinAppointments()
  }, [maChiNhanh, TODAY])

  useEffect(() => {
    loadDoctorQueues()
  }, [maChiNhanh, branchDoctorsToday, TODAY])

  useEffect(() => {
    const keyword = searchTerm.trim()

    if (keyword.length < 2) {
      setSearchRows([])
      setSearchError('')
      setSearchLoading(false)
      return undefined
    }

    const timeoutId = window.setTimeout(async () => {
      setSearchLoading(true)
      setSearchError('')

      try {
        const params = new URLSearchParams({ keyword, ma_chi_nhanh: maChiNhanh, ngay: TODAY })
        const response = await searchCheckinAppointment(params.toString())
        const result = await response.json()

        if (!response.ok || !result?.success) {
          setSearchRows([])
          setSearchError(result?.message || 'Không tìm thấy lịch khám phù hợp.')
          return
        }

        setSearchRows(Array.isArray(result.data) ? result.data.map(normalizeReceptionBooking) : [])
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không thể tìm lịch khám.'
        setSearchRows([])
        setSearchError(message)
        console.warn('RECEPTION_SEARCH_FAILED', message)
      } finally {
        setSearchLoading(false)
      }
    }, 350)

    return () => window.clearTimeout(timeoutId)
  }, [searchTerm, maChiNhanh, TODAY])

  const matchedPatient = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    if (!keyword) return null

    if (searchRows.length > 0) {
      return searchRows[0].patient
    }

    return patients.find((patient) =>
      [patient.CCCD, patient.SDT, patient.MaBenhAn, patient.HoTen]
        .join(' ')
        .toLowerCase()
        .includes(keyword),
    )
  }, [patients, searchRows, searchTerm])
  const matchedPatientBookings = searchRows.length
    ? searchRows
    : matchedPatient
    ? bookings.filter(
        (booking) =>
          booking.MaBenhAn === matchedPatient.MaBenhAn &&
          booking.MaChiNhanh === maChiNhanh &&
          booking.NgayKham === TODAY,
      )
    : []
  const confirmedMatchedBookings = matchedPatientBookings.filter(
    (booking) =>
      (booking.TrangThai === 'Chờ khám' && !booking.MaLeTan) ||
      booking.TrangThai === 'Đã xác nhận',
  )
  const waitingReceptionBookings = hasLoadedCheckinRows
    ? checkinRows
    : bookings.filter(
        (booking) =>
          booking.MaChiNhanh === maChiNhanh &&
          booking.NgayKham === TODAY &&
          booking.TrangThai === 'Đã xác nhận',
      )
  const queueBookings = (hasLoadedQueueRows
    ? queueRows
    : bookings.filter(
        (booking) =>
          booking.MaChiNhanh === maChiNhanh &&
          booking.NgayKham === TODAY &&
          booking.TrangThai === 'Chờ khám',
      ))
    .sort((a, b) => Number(a.STT_HangDoi || 0) - Number(b.STT_HangDoi || 0))

  const receptionPatientMap = [...checkinRows, ...queueRows, ...searchRows].reduce((patientMap, booking) => {
    if (booking.patient?.MaBenhAn) {
      patientMap.set(booking.patient.MaBenhAn, booking.patient)
    }
    return patientMap
  }, new Map())

  const getPatient = (maBenhAn) =>
    receptionPatientMap.get(maBenhAn) ||
    patients.find((patient) => patient.MaBenhAn === maBenhAn) || {
      MaBenhAn: maBenhAn,
      HoTen: 'Chưa rõ',
      SDT: 'Chưa cập nhật',
    }

  const getService = (maDichVu) =>
    effectiveServices.find((service) => service.MaDichVu === maDichVu) || {
      MaDichVu: maDichVu,
      TenDichVu: maDichVu,
      ChuyenKhoa: '',
      GiaGoc: 0,
    }

  const getDoctor = (maBacSi) =>
    effectiveStaffList.find((doctor) => doctor.MaBacSi === maBacSi) || {
      MaBacSi: maBacSi,
      HoTen: 'Đang điều phối',
      ChuyenKhoa: 'Chưa rõ',
    }

  const queueGroups = (() => {
    const groupMap = new Map()

    queueBookings.forEach((booking) => {
      const current = groupMap.get(booking.MaBacSi) || []
      groupMap.set(booking.MaBacSi, [...current, booking])
    })

    return Array.from(groupMap.entries())
      .map(([maBacSi, items]) => ({
        doctor: getDoctor(maBacSi),
        items: items.sort((a, b) => Number(a.STT_HangDoi || 0) - Number(b.STT_HangDoi || 0)),
      }))
      .sort((a, b) => a.doctor.HoTen.localeCompare(b.doctor.HoTen, 'vi'))
  })()

  const getNextQueueNumber = (maBacSi) => {
    const todayQueueNumbers = bookings
      .filter(
        (booking) =>
          booking.MaChiNhanh === maChiNhanh &&
          booking.NgayKham === TODAY &&
          booking.MaBacSi === maBacSi &&
          booking.TrangThai === 'Chờ khám',
      )
      .map((booking) => Number(booking.STT_HangDoi || 0))

    return Math.max(0, ...todayQueueNumbers) + 1
  }

  const handleCheckIn = async (maLichHen) => {
    const targetBooking =
      [...waitingReceptionBookings, ...matchedPatientBookings, ...bookings].find(
        (booking) => booking.MaLichHen === maLichHen,
      )
    if (!targetBooking) return

    if (!hasLoadedCheckinRows && String(maLichHen).startsWith('LH_RT_')) {
      const queueNumber = getNextQueueNumber(targetBooking.MaBacSi)
      setBookings((current) =>
        current.map((booking) =>
          booking.MaLichHen === maLichHen
            ? {
                ...booking,
                STT_HangDoi: queueNumber,
                TrangThai: 'Chờ khám',
              }
            : booking,
        ),
      )
      notify(`Đã check-in lịch hẹn ${maLichHen}, cấp STT hàng đợi ${queueNumber}.`)
      setActiveQueueTab('queue')
      return
    }

    const maLeTan = user?.MaLeTan || user?.id || user?.username
    if (!maLeTan) {
      notify('Không xác định được mã lễ tân để check-in.', 'error')
      return
    }

    setCheckingInId(maLichHen)

    try {
      const formData = new FormData()
      formData.append('ma_lich_hen', maLichHen)
      formData.append('ma_chi_nhanh', maChiNhanh)
      formData.append('ma_le_tan', maLeTan)

      const response = await checkIn({
        method: 'POST',
        body: formData,
      })
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể check-in lịch hẹn.')
      }

      const queueNumber = result.data?.STT_HangDoi || result.data?.STT || ''
      notify(
        queueNumber
          ? `Đã check-in lịch hẹn ${maLichHen}, cấp STT hàng đợi ${queueNumber}.`
          : `Đã check-in lịch hẹn ${maLichHen}.`,
      )
      setSearchRows((current) =>
        current.map((booking) =>
          booking.MaLichHen === maLichHen
            ? {
                ...booking,
                MaLeTan: maLeTan,
                STT_HangDoi: queueNumber || booking.STT_HangDoi,
                STT: queueNumber || booking.STT,
              }
            : booking,
        ),
      )
      await Promise.all([loadCheckinAppointments(), loadDoctorQueues()])
      setActiveQueueTab('queue')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể check-in lịch hẹn.'
      notify(message, 'error')
    } finally {
      setCheckingInId('')
    }
  }

  return (
    <main className="reception-shell">
      <header className="reception-topbar">
        <div>
          <span className="reception-kicker">Medicare Reception</span>
          <h1>HỆ THỐNG TIẾP ĐÓN & ĐIỀU PHỐI HÀNG ĐỢI - {currentBranch.TenChiNhanh}</h1>
          <p>
            Lễ tân phụ trách: <strong>{user?.name || user?.id || 'Lễ tân'}</strong> · Ngày vận hành:{' '}
            <strong>{TODAY}</strong>
          </p>
        </div>
        <button type="button" className="reception-logout-button" onClick={onLogout}>
          <LogOut size={18} />
          Đăng xuất
        </button>
      </header>

      {feedback && <p className="reception-feedback">{feedback}</p>}
      {receptionError && <p className="reception-feedback">{receptionError}</p>}

      <section className="reception-card">
        <div className="reception-section-header">
          <div>
            <h2>Tra cứu bệnh nhân & tiếp đón nhanh</h2>
            <p>Nhập CCCD, SĐT, mã bệnh án hoặc họ tên để kiểm tra lịch đặt trước trong ngày.</p>
          </div>
        </div>

        <input
          className="reception-search-input"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Tìm theo CCCD, số điện thoại, mã bệnh án hoặc họ tên..."
        />

        {searchTerm.trim() && !matchedPatient && (
          <div className="reception-empty-state">
            {searchLoading ? 'Đang tra cứu lịch khám...' : searchError || 'Không tìm thấy bệnh nhân hoặc lịch khám phù hợp tại chi nhánh này.'}
          </div>
        )}

        {matchedPatient && (
          <div className="reception-patient-result">
            <div>
              <span>Bệnh nhân</span>
              <strong>{matchedPatient.HoTen}</strong>
              <small>
                {matchedPatient.MaBenhAn} · CCCD {matchedPatient.CCCD} · SĐT {matchedPatient.SDT}
              </small>
            </div>
            {confirmedMatchedBookings.length > 0 ? (
              <div className="reception-booking-cards">
                {confirmedMatchedBookings.map((booking) => {
                  const service = getService(booking.MaDichVu)
                  const doctor = getDoctor(booking.MaBacSi)
                  return (
                    <article key={booking.MaLichHen} className="reception-booking-card">
                      <div>
                        <strong>{booking.TenDichVu || service.TenDichVu}</strong>
                        <span>
                          Ca {booking.CaKham} · Bác sĩ {booking.TenBacSi || doctor.HoTen} · {booking.MaLichHen}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="reception-primary-button"
                        disabled={checkingInId === booking.MaLichHen}
                        onClick={() => handleCheckIn(booking.MaLichHen)}
                      >
                        {checkingInId === booking.MaLichHen
                          ? 'Đang check-in...'
                          : 'Xác nhận tiếp đón (Vào hàng đợi)'}
                      </button>
                    </article>
                  )
                })}
              </div>
            ) : matchedPatientBookings.length > 0 ? (
              <div className="reception-direct-box">
                <p>
                  Bệnh nhân đã có lịch hôm nay tại chi nhánh này với trạng thái:{' '}
                  {matchedPatientBookings.map((booking) => booking.TrangThai).join(', ')}.
                </p>
              </div>
            ) : (
              <div className="reception-direct-box">
                <p>
                  Bệnh nhân chưa đặt lịch trực tuyến tại chi nhánh này trong ngày hôm nay. Quy trình hiện tại yêu cầu bệnh nhân đặt lịch online và thanh toán trước từ nhà.
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="reception-card">
        <div className="reception-section-header">
          <div>
            <h2>Quản lý luồng hàng đợi phòng khám trong ngày</h2>
            <p>Dữ liệu được lọc cứng theo chi nhánh {currentBranch.MaChiNhanh}.</p>
          </div>
          <div className="reception-tab-row">
            <button
              type="button"
              className={activeQueueTab === 'prebooked' ? 'active' : ''}
              onClick={() => setActiveQueueTab('prebooked')}
            >
              Chờ tiếp đón ({waitingReceptionBookings.length})
            </button>
            <button
              type="button"
              className={activeQueueTab === 'queue' ? 'active' : ''}
              onClick={() => setActiveQueueTab('queue')}
            >
              Hàng đợi khám ({queueBookings.length})
            </button>
          </div>
        </div>

        {(checkinRowsLoading || queueRowsLoading) && (
          <div className="reception-empty-state">Đang tải dữ liệu lễ tân từ hệ thống...</div>
        )}

        {activeQueueTab === 'prebooked' ? (
          <>
          <div className="reception-table-wrap">
            <table className="reception-table">
              <thead>
                <tr>
                  <th>STT đặt trước</th>
                  <th>Mã bệnh án</th>
                  <th>Họ tên</th>
                  <th>Số điện thoại</th>
                  <th>Ca khám</th>
                  <th>Dịch vụ khám</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {getPageRows(waitingReceptionBookings, prebookedPage).map((booking, index) => {
                  const patient = getPatient(booking.MaBenhAn)
                  const service = getService(booking.MaDichVu)
                  return (
                    <tr key={booking.MaLichHen}>
                      <td>{getCurrentPage(prebookedPage, waitingReceptionBookings.length) * TABLE_PAGE_SIZE + index + 1}</td>
                      <td>{patient.MaBenhAn}</td>
                      <td>{patient.HoTen}</td>
                      <td>{patient.SDT}</td>
                      <td>Ca {booking.CaKham}</td>
                      <td>{booking.TenDichVu || service.TenDichVu}</td>
                      <td>
                        <button
                          type="button"
                          className="reception-primary-button compact"
                          disabled={checkingInId === booking.MaLichHen}
                          onClick={() => handleCheckIn(booking.MaLichHen)}
                        >
                          {checkingInId === booking.MaLichHen ? 'Đang check-in...' : 'Check-in Tiếp Đón'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {waitingReceptionBookings.length === 0 && (
                  <tr>
                    <td colSpan="7" className="reception-empty-cell">
                      Không còn lịch đặt trước đang chờ tiếp đón.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination page={prebookedPage} total={waitingReceptionBookings.length} label="lịch chờ tiếp đón" onPageChange={setPrebookedPage} />
          </>
        ) : queueGroups.length > 0 ? (
          <>
          <div className="reception-doctor-queue-grid">
            {getPageRows(queueGroups, queueGroupPage).map((group) => (
              <article key={group.doctor.MaBacSi} className="reception-doctor-queue-card">
                <header>
                  <div>
                    <span>{group.doctor.MaBacSi}</span>
                    <h3>
                      Phòng khám: Bác sĩ {group.doctor.HoTen} - Khoa {group.doctor.ChuyenKhoa}
                    </h3>
                  </div>
                  <strong>{group.items.length} bệnh nhân</strong>
                </header>
                <div className="reception-table-wrap">
                  <table className="reception-table compact">
                    <thead>
                      <tr>
                        <th>STT hàng đợi</th>
                        <th>Họ tên bệnh nhân</th>
                        <th>Ca khám</th>
                        <th>Dịch vụ lâm sàng</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getPageRows(group.items, queuePagesByDoctor[group.doctor.MaBacSi] || 0).map((booking, index) => {
                        const patient = getPatient(booking.MaBenhAn)
                        const service = getService(booking.MaDichVu)
                        return (
                          <tr key={booking.MaLichHen}>
                            <td>{getCurrentPage(queuePagesByDoctor[group.doctor.MaBacSi] || 0, group.items.length) * TABLE_PAGE_SIZE + index + 1}</td>
                            <td>{patient.HoTen}</td>
                            <td>Ca {booking.CaKham}</td>
                            <td>{booking.TenDichVu || service.TenDichVu}</td>
                            <td>
                              <span className="reception-status-pill">Chờ khám</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <TablePagination page={queuePagesByDoctor[group.doctor.MaBacSi] || 0} total={group.items.length} label="bệnh nhân" onPageChange={(page) => setQueuePagesByDoctor((current) => ({ ...current, [group.doctor.MaBacSi]: page }))} />
              </article>
            ))}
          </div>
          <TablePagination page={queueGroupPage} total={queueGroups.length} label="bác sĩ" onPageChange={setQueueGroupPage} />
          </>
        ) : (
          <div className="reception-empty-state">Chưa có bệnh nhân nào trong hàng đợi khám.</div>
        )}
      </section>
    </main>
  )
}
