import { useEffect, useMemo, useState } from 'react'
import { Activity, Building2, Calendar, ClipboardList, DollarSign, LogOut, Stethoscope, Users } from 'lucide-react'
import medicalLogoImage from '../assets/medical-logo-cutout.png'
import { EMPTY_CATALOG_DATA } from '../shared/catalog.js'
import { getMonthlyReport } from '../api/billing.js'
import { cancelDoctorSchedules, createDoctorSchedules, listDoctorSchedules, transferDoctorSchedules } from '../api/scheduling.js'

export default function AdminDashboard({
  user,
  onLogout,
  showNotification,
  addPatientNotifications,
  addScheduleAdjustment,
  catalogData = EMPTY_CATALOG_DATA,
}) {
  const [branches, setBranches] = useState([
    {
      MaChiNhanh: 'CN_CG',
      TenChiNhanh: 'Medicare - Cơ sở Cầu Giấy',
      DiaChi: 'Số 1 Dịch Vọng Hậu, Cầu Giấy, Hà Nội',
      SDT: '0241234567',
    },
    {
      MaChiNhanh: 'CN_HBT',
      TenChiNhanh: 'Medicare - Cơ sở Hai Bà Trưng',
      DiaChi: 'Số 99 Đại Cồ Việt, Hai Bà Trưng, Hà Nội',
      SDT: '0247654321',
    },
  ])
  const [branchForm, setBranchForm] = useState({
    MaChiNhanh: '',
    TenChiNhanh: '',
    DiaChi: '',
    SDT: '',
  })

  const [services, setServices] = useState([
    { MaDichVu: 'DV_KHAM_NOI', TenDichVu: 'Khám Nội Tổng Quát', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 150000 },
    { MaDichVu: 'DV_KHAM_GIA_DINH', TenDichVu: 'Khám Sức Khỏe Gia Đình', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 250000 },
    { MaDichVu: 'DV_KHAM_LAO_KHOA', TenDichVu: 'Khám Tư Vấn Sức Khỏe Lão Khoa', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 180000 },
    { MaDichVu: 'DV_KHAM_TIM_MACH', TenDichVu: 'Khám Sàng Lọc Tim Mạch - Huyết Áp', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 200000 },
    { MaDichVu: 'DV_KHAM_TIEU_HOA', TenDichVu: 'Khám Tiêu Hóa - Gan Mật', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 180000 },
    { MaDichVu: 'DV_KHAM_HO_HAP', TenDichVu: 'Khám Bệnh Lý Đường Hô Hấp', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 170000 },
    { MaDichVu: 'DV_KHAM_NOI_TIET', TenDichVu: 'Khám Sàng Lọc Tiểu Đường & Nội Tiết', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 220000 },
    { MaDichVu: 'DV_KHAM_DINH_DUONG', TenDichVu: 'Khám Tư Vấn Dinh Dưỡng Chuyên Sâu', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 150000 },
    { MaDichVu: 'DT_TRUYEN_DICH', TenDichVu: 'Liệu trình truyền dịch giải độc, bù nước', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Điều trị', GiaGoc: 250000 },
    { MaDichVu: 'DT_TIEM_KHANG_SINH', TenDichVu: 'Dịch vụ tiêm thuốc/kháng sinh theo chỉ định', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Điều trị', GiaGoc: 80000 },
    { MaDichVu: 'DV_KHAM_RANG', TenDichVu: 'Khám Răng Hàm Mặt Định Kỳ', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 200000 },
    { MaDichVu: 'DV_LAY_CAO', TenDichVu: 'Lấy Cao Răng Và Đánh Bóng Thẩm Mỹ', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 150000 },
    { MaDichVu: 'DV_KHAM_NIENG_RANG', TenDichVu: 'Khám Tư Vấn Chỉnh Nha/Niềng Răng', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 300000 },
    { MaDichVu: 'DV_KHAM_IMPLANT', TenDichVu: 'Khám Tư Vấn Trồng Răng Implant', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 300000 },
    { MaDichVu: 'DT_HAN_RANG', TenDichVu: 'Hàn Răng Composite Thẩm Mỹ (1 Răng)', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Điều trị', GiaGoc: 300000 },
    { MaDichVu: 'DT_RANG_TUY', TenDichVu: 'Liệu Trình Điều Trị Tủy Răng Toàn Diện', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Điều trị', GiaGoc: 1200000 },
    { MaDichVu: 'DT_NHO_RANG_KHON', TenDichVu: 'Phẫu Thuật Nhổ Răng Khôn Mọc Lệch', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Điều trị', GiaGoc: 1000000 },
    { MaDichVu: 'DT_TAY_TRANG', TenDichVu: 'Tẩy Trắng Răng Công Nghệ Laser', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Điều trị', GiaGoc: 2000000 },
    { MaDichVu: 'DV_KHAM_TMH', TenDichVu: 'Khám Tai Mũi Họng Thông Thường', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 180000 },
    { MaDichVu: 'DV_NOI_SOI_TMH', TenDichVu: 'Nội Soi Tai Mũi Họng Ống Mềm', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 250000 },
    { MaDichVu: 'DV_KHAM_THINH_LUC', TenDichVu: 'Khám Đo Thính Lực Đơn Âm', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 200000 },
    { MaDichVu: 'DT_KHIDUNG', TenDichVu: 'Liệu Trình Khí Dung Mũi Họng', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Điều trị', GiaGoc: 450000 },
    { MaDichVu: 'DT_VIEM_AMIDAN', TenDichVu: 'Liệu Trình Điều Trị Viêm Amidan Hạt', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Điều trị', GiaGoc: 600000 },
    { MaDichVu: 'DT_RUA_XOANG', TenDichVu: 'Hút Mủ Và Chọc Rửa Xoang Điều Trị', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Điều trị', GiaGoc: 350000 },
    { MaDichVu: 'DT_LAY_DI_VAT', TenDichVu: 'Thủ Thuật Lấy Dị Vật Vùng Tai/Mũi/Họng', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Điều trị', GiaGoc: 400000 },
    { MaDichVu: 'XN_MAU', TenDichVu: 'Xét Nghiệm Công Thức Máu 24 Chỉ Số', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 250000 },
    { MaDichVu: 'SA_O_BUNG', TenDichVu: 'Siêu Âm Ổ Bụng Tổng Quát', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 300000 },
    { MaDichVu: 'XN_NUOC_TIEU', TenDichVu: 'Xét Nghiệm Nước Tiểu Toàn Bộ (10 Thông Số)', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 120000 },
    { MaDichVu: 'XN_SINH_HOA', TenDichVu: 'Xét Nghiệm Sinh Hóa Máu (Gan, Thận, Mỡ Máu)', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 350000 },
    { MaDichVu: 'XN_DUONG_HUYET', TenDichVu: 'Xét Nghiệm Đường Huyết Nhanh', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 80000 },
  ])
  const [priceDrafts, setPriceDrafts] = useState(() => ({
    DV_KHAM_NOI: '150000',
    DV_KHAM_GIA_DINH: '250000',
    DV_KHAM_LAO_KHOA: '180000',
    DV_KHAM_TIM_MACH: '200000',
    DV_KHAM_TIEU_HOA: '180000',
    DV_KHAM_HO_HAP: '170000',
    DV_KHAM_NOI_TIET: '220000',
    DV_KHAM_DINH_DUONG: '150000',
    DT_TRUYEN_DICH: '250000',
    DT_TIEM_KHANG_SINH: '80000',
    DV_KHAM_RANG: '200000',
    DV_LAY_CAO: '150000',
    DV_KHAM_NIENG_RANG: '300000',
    DV_KHAM_IMPLANT: '300000',
    DT_HAN_RANG: '300000',
    DT_RANG_TUY: '1200000',
    DT_NHO_RANG_KHON: '1000000',
    DT_TAY_TRANG: '2000000',
    DV_KHAM_TMH: '180000',
    DV_NOI_SOI_TMH: '250000',
    DV_KHAM_THINH_LUC: '200000',
    DT_KHIDUNG: '450000',
    DT_VIEM_AMIDAN: '600000',
    DT_RUA_XOANG: '350000',
    DT_LAY_DI_VAT: '400000',
    XN_MAU: '250000',
    SA_O_BUNG: '300000',
    XN_NUOC_TIEU: '120000',
    XN_SINH_HOA: '350000',
    XN_DUONG_HUYET: '80000',
  }))

  const [activeMenu, setActiveMenu] = useState('staff')
  const [staffList, setStaffList] = useState([
    {
      MaNhanSu: 'BS001',
      HoTen: 'Nguyễn Văn An',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Nội tổng quát',
      SDT: '0911222333',
      MatKhau: 'hashed_bs001',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS002',
      HoTen: 'Lê Thị Bình',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Răng hàm mặt',
      SDT: '0922333444',
      MatKhau: 'hashed_bs002',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS003',
      HoTen: 'Phạm Hoàng Long',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Tai mũi họng',
      SDT: '0933444555',
      MatKhau: 'hashed_bs003',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS004',
      HoTen: 'Trần Thu Hà',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Nội tổng quát',
      SDT: '0912000004',
      MatKhau: 'hashed_bs004',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS005',
      HoTen: 'Đỗ Minh Quân',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Răng hàm mặt',
      SDT: '0912000005',
      MatKhau: 'hashed_bs005',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS006',
      HoTen: 'Vũ Hải Yến',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Tai mũi họng',
      SDT: '0912000006',
      MatKhau: 'hashed_bs006',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS007',
      HoTen: 'Hoàng Đức Mạnh',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Nội tổng quát',
      SDT: '0912000007',
      MatKhau: 'hashed_bs007',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS008',
      HoTen: 'Ngô Phương Linh',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Răng hàm mặt',
      SDT: '0912000008',
      MatKhau: 'hashed_bs008',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS009',
      HoTen: 'Bùi Anh Tuấn',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Tai mũi họng',
      SDT: '0912000009',
      MatKhau: 'hashed_bs009',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS010',
      HoTen: 'Đặng Thùy Dương',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Nội tổng quát',
      SDT: '0912000010',
      MatKhau: 'hashed_bs010',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS011',
      HoTen: 'Phan Quốc Bảo',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Răng hàm mặt',
      SDT: '0912000011',
      MatKhau: 'hashed_bs011',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS012',
      HoTen: 'Mai Hương Giang',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Tai mũi họng',
      SDT: '0912000012',
      MatKhau: 'hashed_bs012',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS013',
      HoTen: 'Tạ Văn Dũng',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Nội tổng quát',
      SDT: '0912000013',
      MatKhau: 'hashed_bs013',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS014',
      HoTen: 'Lương Khánh Chi',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Răng hàm mặt',
      SDT: '0912000014',
      MatKhau: 'hashed_bs014',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS015',
      HoTen: 'Cao Tiến Đạt',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Tai mũi họng',
      SDT: '0912000015',
      MatKhau: 'hashed_bs015',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS016',
      HoTen: 'Đinh Ngọc Mai',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Nội tổng quát',
      SDT: '0912000016',
      MatKhau: 'hashed_bs016',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS017',
      HoTen: 'Hồ Việt Anh',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Răng hàm mặt',
      SDT: '0912000017',
      MatKhau: 'hashed_bs017',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS018',
      HoTen: 'Nguyễn Hồng Sơn',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Tai mũi họng',
      SDT: '0912000018',
      MatKhau: 'hashed_bs018',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'LT001',
      HoTen: 'Phạm Minh Thư',
      VaiTro: 'Lễ tân',
      ChuyenKhoa: 'Tiếp nhận',
      SDT: '0988777666',
      MatKhau: 'hashed_lt001',
      MaChiNhanh: 'CN_CG',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'LT002',
      HoTen: 'Nguyễn Hoàng Yến',
      VaiTro: 'Lễ tân',
      ChuyenKhoa: 'Tiếp nhận',
      SDT: '0988555444',
      MatKhau: 'hashed_lt002',
      MaChiNhanh: 'CN_HBT',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'XNV001',
      HoTen: 'Trần Văn Cường',
      VaiTro: 'Xét nghiệm viên',
      ChuyenKhoa: 'Xét nghiệm',
      SDT: '0966111222',
      MatKhau: 'hashed_xnv001',
      MaChiNhanh: 'CN_CG',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'XNV002',
      HoTen: 'Vũ Hồng Ngọc',
      VaiTro: 'Xét nghiệm viên',
      ChuyenKhoa: 'Xét nghiệm',
      SDT: '0966333444',
      MatKhau: 'hashed_xnv002',
      MaChiNhanh: 'CN_HBT',
      TrangThai: 'active',
    },
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
      DiaChi: 'Đống Đa, Hà Nội',
      MaSoBHYT: '',
      KyTuDauBHYT: '',
    },
    {
      MaBenhAn: 'BN003',
      HoTen: 'Phạm Lê Minh',
      CCCD: '001221098765',
      SDT: '0911999888',
      DiaChi: 'Hai Bà Trưng, Hà Nội',
      MaSoBHYT: 'TE1010999888777',
      KyTuDauBHYT: 'TE',
    },
  ])
  const [staffForm, setStaffForm] = useState({
    HoTen: '',
    VaiTro: 'Bác sĩ',
    ChuyenKhoa: 'Nội tổng quát',
    SDT: '',
    MatKhau: '',
    MaChiNhanh: '',
  })
  const [staffSearch, setStaffSearch] = useState('')
  const [patientSearch, setPatientSearch] = useState('')
  const [serviceSearch, setServiceSearch] = useState('')
  const [newServiceForm, setNewServiceForm] = useState({
    MaDichVu: '',
    TenDichVu: '',
    LoaiDichVu: 'Khám lâm sàng',
    ChuyenKhoa: 'Nội tổng quát',
    GiaGoc: '',
  })
  const [branchServices, setBranchServices] = useState([
    { MaCauHinh: 'CH_CG_KHAMNOI', MaChiNhanh: 'CN_CG', MaDichVu: 'DV_KHAM_NOI', SlotGioiHan: 15, TrangThai: 'active' },
    { MaCauHinh: 'CH_CG_KHAMRANG', MaChiNhanh: 'CN_CG', MaDichVu: 'DV_KHAM_RANG', SlotGioiHan: 10, TrangThai: 'active' },
    { MaCauHinh: 'CH_CG_XNMAU', MaChiNhanh: 'CN_CG', MaDichVu: 'XN_MAU', SlotGioiHan: 20, TrangThai: 'active' },
    { MaCauHinh: 'CH_CG_SAOBUNG', MaChiNhanh: 'CN_CG', MaDichVu: 'SA_O_BUNG', SlotGioiHan: 15, TrangThai: 'active' },
    { MaCauHinh: 'CH_CG_RANGTUY', MaChiNhanh: 'CN_CG', MaDichVu: 'DT_RANG_TUY', SlotGioiHan: 5, TrangThai: 'active' },
    { MaCauHinh: 'CH_HBT_KHAMNOI', MaChiNhanh: 'CN_HBT', MaDichVu: 'DV_KHAM_NOI', SlotGioiHan: 15, TrangThai: 'active' },
    { MaCauHinh: 'CH_HBT_KHAMTMH', MaChiNhanh: 'CN_HBT', MaDichVu: 'DV_KHAM_TMH', SlotGioiHan: 12, TrangThai: 'active' },
    { MaCauHinh: 'CH_HBT_XNMAU', MaChiNhanh: 'CN_HBT', MaDichVu: 'XN_MAU', SlotGioiHan: 20, TrangThai: 'active' },
    { MaCauHinh: 'CH_HBT_KHIDUNG', MaChiNhanh: 'CN_HBT', MaDichVu: 'DT_KHIDUNG', SlotGioiHan: 8, TrangThai: 'active' },
  ])
  const [distributionForm, setDistributionForm] = useState({
    MaChiNhanh: 'CN_CG',
    MaDichVu: 'DV_KHAM_NOI',
    SlotGioiHan: '10',
  })
  const [serviceFilters, setServiceFilters] = useState({
    MaChiNhanh: 'all',
    LoaiDichVu: 'all',
  })
  const [slotDrafts, setSlotDrafts] = useState(() =>
    Object.fromEntries(
      [
        ['CH_CG_KHAMNOI', 15],
        ['CH_CG_KHAMRANG', 10],
        ['CH_CG_XNMAU', 20],
        ['CH_CG_SAOBUNG', 15],
        ['CH_CG_RANGTUY', 5],
        ['CH_HBT_KHAMNOI', 15],
        ['CH_HBT_KHAMTMH', 12],
        ['CH_HBT_XNMAU', 20],
        ['CH_HBT_KHIDUNG', 8],
      ].map(([key, value]) => [key, String(value)]),
    ),
  )
  const [doctorSchedules, setDoctorSchedules] = useState([
    { MaLichTruc: 'LT_001', MaBacSi: 'BS001', MaChiNhanh: 'CN_CG', NgayTruc: '2026-06-01', CaTruc: 1, TrangThai: 'Đang hoạt động' },
    { MaLichTruc: 'LT_002', MaBacSi: 'BS001', MaChiNhanh: 'CN_CG', NgayTruc: '2026-06-01', CaTruc: 2, TrangThai: 'Đang hoạt động' },
    { MaLichTruc: 'LT_003', MaBacSi: 'BS002', MaChiNhanh: 'CN_CG', NgayTruc: '2026-06-01', CaTruc: 3, TrangThai: 'Đang hoạt động' },
    { MaLichTruc: 'LT_004', MaBacSi: 'BS003', MaChiNhanh: 'CN_HBT', NgayTruc: '2026-06-01', CaTruc: 1, TrangThai: 'Đang hoạt động' },
  ])
  const [adminScheduleLoading, setAdminScheduleLoading] = useState(false)
  const [adminScheduleError, setAdminScheduleError] = useState('')
  const [appointments, setAppointments] = useState([
    {
      MaLichHen: 'LH_001',
      MaBenhAn: 'BN001',
      MaCauHinh: 'CH_CG_KHAMNOI',
      NgayKham: '2026-06-01',
      CaKham: 1,
      STT: 1,
      GiaCuoi: 30000,
      TrangThai: 'Hoàn thành',
      MaLeTan: 'LT001',
      MaBacSi: 'BS001',
    },
    {
      MaLichHen: 'LH_002',
      MaBenhAn: 'BN002',
      MaCauHinh: 'CH_CG_KHAMRANG',
      NgayKham: '2026-06-01',
      CaKham: 3,
      STT: 1,
      GiaCuoi: 200000,
      TrangThai: 'Đã xác nhận',
      MaLeTan: '',
      MaBacSi: 'BS002',
    },
    {
      MaLichHen: 'LH_003',
      MaBenhAn: 'BN003',
      MaCauHinh: 'CH_CG_KHAMNOI',
      NgayKham: '2026-06-01',
      CaKham: 2,
      STT: 1,
      GiaCuoi: 0,
      TrangThai: 'Chờ khám',
      MaLeTan: 'LT001',
      MaBacSi: 'BS001',
    },
    {
      MaLichHen: 'LH_004',
      MaBenhAn: 'BN002',
      MaCauHinh: 'CH_CG_KHAMNOI',
      NgayKham: '2026-06-01',
      CaKham: 2,
      STT: 2,
      GiaCuoi: 150000,
      TrangThai: 'Hoàn thành',
      MaLeTan: 'LT001',
      MaBacSi: 'BS001',
    },
    {
      MaLichHen: 'LH_005',
      MaBenhAn: 'BN003',
      MaCauHinh: 'CH_HBT_KHAMTMH',
      NgayKham: '2026-06-01',
      CaKham: 1,
      STT: 1,
      GiaCuoi: 0,
      TrangThai: 'Hoàn thành',
      MaLeTan: 'LT002',
      MaBacSi: 'BS003',
    },
    {
      MaLichHen: 'LH_006',
      MaBenhAn: 'BN001',
      MaCauHinh: 'CH_CG_KHAMNOI',
      NgayKham: '2026-05-18',
      CaKham: 1,
      STT: 1,
      GiaCuoi: 30000,
      TrangThai: 'Hoàn thành',
      MaLeTan: 'LT001',
      MaBacSi: 'BS001',
    },
    {
      MaLichHen: 'LH_007',
      MaBenhAn: 'BN002',
      MaCauHinh: 'CH_CG_KHAMRANG',
      NgayKham: '2026-05-20',
      CaKham: 3,
      STT: 1,
      GiaCuoi: 200000,
      TrangThai: 'Đã khám',
      MaLeTan: 'LT001',
      MaBacSi: 'BS002',
    },
    {
      MaLichHen: 'LH_008',
      MaBenhAn: 'BN003',
      MaCauHinh: 'CH_HBT_KHAMTMH',
      NgayKham: '2026-05-22',
      CaKham: 1,
      STT: 1,
      GiaCuoi: 0,
      TrangThai: 'Đã hủy',
      MaLeTan: 'LT002',
      MaBacSi: 'BS003',
    },
  ])
  const [labTestDetails] = useState([
    {
      MaChiTietXN: 'CTXN_001',
      MaBenhAn: 'BN001',
      MaDichVu: 'XN_MAU',
      MaChiNhanh: 'CN_CG',
      MaBacSi: 'BS001',
      NgayThucHien: '2026-06-01',
      TrangThai: 'Hoàn thành',
    },
		    {
		      MaChiTietXN: 'CTXN_002',
      MaBenhAn: 'BN002',
      MaDichVu: 'XN_SINH_HOA',
      MaChiNhanh: 'CN_CG',
      MaBacSi: 'BS002',
      NgayThucHien: '2026-06-01',
      TrangThai: 'Đang xử lý',
    },
    {
      MaChiTietXN: 'CTXN_003',
      MaBenhAn: 'BN003',
      MaDichVu: 'XN_DUONG_HUYET',
      MaChiNhanh: 'CN_HBT',
      MaBacSi: 'BS003',
      NgayThucHien: '2026-06-01',
      TrangThai: 'Hoàn thành',
    },
    {
      MaChiTietXN: 'CTXN_004',
      MaBenhAn: 'BN002',
      MaDichVu: 'SA_O_BUNG',
      MaChiNhanh: 'CN_CG',
      MaBacSi: 'BS002',
      NgayThucHien: '2026-05-20',
      TrangThai: 'Hoàn thành',
    },
  ])
  const [treatmentRevenueDetails] = useState([
    {
      MaLichTrinh: 'LTDT_AD_001',
      MaBenhAn: 'BN001',
      MaDichVu: 'DT_RANG_TUY',
      MaChiNhanh: 'CN_CG',
      MaBacSi: 'BS002',
      NgayThucHien: '2026-06-05',
      GiaCuoi: 240000,
      TrangThai: 'Hoàn thành',
    },
    {
      MaLichTrinh: 'LTDT_AD_002',
      MaBenhAn: 'BN003',
      MaDichVu: 'DT_KHIDUNG',
      MaChiNhanh: 'CN_HBT',
      MaBacSi: 'BS003',
      NgayThucHien: '2026-06-12',
      GiaCuoi: 0,
      TrangThai: 'Hoàn thành',
    },
    {
      MaLichTrinh: 'LTDT_AD_003',
      MaBenhAn: 'BN002',
      MaDichVu: 'DT_RANG_TUY',
      MaChiNhanh: 'CN_CG',
      MaBacSi: 'BS002',
      NgayThucHien: '2026-05-24',
      GiaCuoi: 1200000,
      TrangThai: 'Hoàn thành',
    },
  ])
  const [bulkScheduleForm, setBulkScheduleForm] = useState({
    MaBacSi: 'BS001',
    MaChiNhanh: 'CN_CG',
    TuNgay: '2026-06-01',
    DenNgay: '2026-06-07',
    selections: {},
  })
  const todayFilter = new Date().toISOString().slice(0, 10)
  const nextWeekFilter = new Date()
  nextWeekFilter.setDate(nextWeekFilter.getDate() + 7)
  const [scheduleFilters, setScheduleFilters] = useState({
    TuNgay: todayFilter,
    DenNgay: nextWeekFilter.toISOString().slice(0, 10),
    MaBacSi: 'all',
  })
  const [doctorTransferModal, setDoctorTransferModal] = useState({
    show: false,
    schedule: null,
    nextDoctorId: '',
  })
  const [feedback, setFeedback] = useState('')
  const notify = (message, type = 'success') => {
    setFeedback(message)
    showNotification?.(message, type)
  }
  const [reportMonth, setReportMonth] = useState('2026-06')
  const [adminReportData, setAdminReportData] = useState(null)
  const [adminReportLoading, setAdminReportLoading] = useState(false)
  const [adminReportError, setAdminReportError] = useState('')

  const clinicalDepartments = ['Nội tổng quát', 'Răng hàm mặt', 'Tai mũi họng']
  const serviceDepartments = ['Nội tổng quát', 'Răng hàm mặt', 'Tai mũi họng', 'Xét nghiệm']
  const serviceTypes = ['Khám lâm sàng', 'Xét nghiệm', 'Điều trị']
  const bhytCategories = [
    { KyTuDauBHYT: 'TE', DoiTuongChinhSach: 'Trẻ em dưới 6 tuổi', TyLeHuong: 1 },
    { KyTuDauBHYT: 'HT', DoiTuongChinhSach: 'Cán bộ Hưu trí', TyLeHuong: 0.95 },
    { KyTuDauBHYT: 'DN', DoiTuongChinhSach: 'Người lao động doanh nghiệp', TyLeHuong: 0.8 },
  ]

  useEffect(() => {
    if (catalogData?.branches?.length) {
      setBranches(catalogData.branches)
    }

    if (catalogData?.services?.length) {
      setServices(catalogData.services)
      setPriceDrafts((current) => ({
        ...current,
        ...Object.fromEntries(
          catalogData.services.map((service) => [
            service.MaDichVu,
            String(service.GiaGoc ?? ''),
          ]),
        ),
      }))
    }

    if (catalogData?.doctorSchedules?.length) {
      setDoctorSchedules(
        catalogData.doctorSchedules.map((schedule) => ({
          ...schedule,
          TrangThai: schedule.TrangThai || 'Đang hoạt động',
        })),
      )

      const catalogDoctors = Array.from(
        catalogData.doctorSchedules.reduce((map, schedule) => {
          if (!schedule.MaBacSi || map.has(schedule.MaBacSi)) return map
          map.set(schedule.MaBacSi, {
            MaNhanSu: schedule.MaBacSi,
            HoTen: schedule.TenBacSi || schedule.HoTen || schedule.MaBacSi,
            VaiTro: 'Bác sĩ',
            ChuyenKhoa: schedule.ChuyenKhoa || '',
            SDT: schedule.SDT || '',
            MatKhau: '',
            TrangThai: 'active',
          })
          return map
        }, new Map()).values(),
      )

      if (catalogDoctors.length) {
        setStaffList((current) => {
          const catalogDoctorIds = new Set(catalogDoctors.map((doctor) => doctor.MaNhanSu))
          const remainingStaff = current.filter((staff) => !catalogDoctorIds.has(staff.MaNhanSu))
          return [...catalogDoctors, ...remainingStaff]
        })
      }
    }
  }, [catalogData])

  const doctors = useMemo(
    () => staffList.filter((staff) => staff.VaiTro === 'Bác sĩ' && staff.TrangThai === 'active'),
    [staffList],
  )

  const filteredStaffList = useMemo(() => {
    const keyword = staffSearch.trim().toLowerCase()
    if (!keyword) return staffList

    return staffList.filter((staff) => {
      const branchName = staff.MaChiNhanh
        ? branches.find((branch) => branch.MaChiNhanh === staff.MaChiNhanh)?.TenChiNhanh
        : ''

      return [staff.MaNhanSu, staff.HoTen, staff.SDT, staff.VaiTro, staff.ChuyenKhoa, staff.MaChiNhanh, branchName]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    })
  }, [branches, staffList, staffSearch])

  const filteredPatients = useMemo(() => {
    const keyword = patientSearch.trim().toLowerCase()
    if (!keyword) return patients

    return patients.filter((patient) =>
      [patient.MaBenhAn, patient.HoTen, patient.CCCD, patient.SDT, patient.DiaChi]
        .join(' ')
        .toLowerCase()
        .includes(keyword),
    )
  }, [patients, patientSearch])

  const filteredServices = useMemo(() => {
    const keyword = serviceSearch.trim().toLowerCase()
    if (!keyword) return services

    return services.filter((service) =>
      [service.MaDichVu, service.TenDichVu, service.LoaiDichVu, service.ChuyenKhoa]
        .join(' ')
        .toLowerCase()
        .includes(keyword),
    )
  }, [services, serviceSearch])

  const getBranchName = (maChiNhanh) =>
    branches.find((branch) => branch.MaChiNhanh === maChiNhanh)?.TenChiNhanh || maChiNhanh

  const getService = (maDichVu) =>
    services.find((service) => service.MaDichVu === maDichVu) || {
      MaDichVu: maDichVu,
      TenDichVu: maDichVu,
      LoaiDichVu: '',
      GiaGoc: 0,
    }

  const getPatient = (maBenhAn) => patients.find((patient) => patient.MaBenhAn === maBenhAn)

  const getBhytRate = (maBenhAn) => {
    const patient = getPatient(maBenhAn)
    if (!patient?.KyTuDauBHYT) return 0

    return (
      bhytCategories.find((category) => category.KyTuDauBHYT === patient.KyTuDauBHYT)
        ?.TyLeHuong || 0
    )
  }

  const calculateRevenueParts = (maBenhAn, giaGoc, giaCuoiOverride = null) => {
    if (giaCuoiOverride !== null && giaCuoiOverride !== undefined && giaCuoiOverride !== '') {
      const netRevenue = Math.max(0, Number(giaCuoiOverride) || 0)
      return {
        netRevenue,
        insuranceAmount: Math.max(0, Number(giaGoc || 0) - netRevenue),
      }
    }

    const tyLeHuong = getBhytRate(maBenhAn)
    const insuranceAmount = Math.round(giaGoc * tyLeHuong)
    const netRevenue = Math.max(0, giaGoc - insuranceAmount)

    return { netRevenue, insuranceAmount }
  }

  const getConfigService = (maCauHinh) => {
    const config = branchServices.find((item) => item.MaCauHinh === maCauHinh)
    if (!config) return { config: null, service: getService('') }

    return { config, service: getService(config.MaDichVu) }
  }

  const getAppointmentCountForSchedule = (schedule) => {
    if (schedule.SoLichHenDangCo !== undefined && schedule.SoLichHenDangCo !== null) {
      return Number(schedule.SoLichHenDangCo || 0)
    }

    const configIds = branchServices
      .filter((config) => config.MaChiNhanh === schedule.MaChiNhanh)
      .map((config) => config.MaCauHinh)

    return appointments.filter(
      (appointment) =>
        appointment.NgayKham === schedule.NgayTruc &&
        Number(appointment.CaKham) === Number(schedule.CaTruc) &&
        configIds.includes(appointment.MaCauHinh) &&
        (appointment.MaBacSi ? appointment.MaBacSi === schedule.MaBacSi : true) &&
        appointment.TrangThai !== 'Đã hủy' &&
        appointment.TrangThai !== 'Đã hủy (Hệ thống hoàn tiền)',
    ).length
  }

  const getAffectedAppointmentsForSchedule = (schedule) => {
    const configIds = branchServices
      .filter((config) => config.MaChiNhanh === schedule.MaChiNhanh)
      .map((config) => config.MaCauHinh)
    const activeStatuses = ['Đã xác nhận', 'Chờ khám', 'Đang khám', 'Chờ kết luận']

    return appointments.filter(
      (appointment) =>
        appointment.NgayKham === schedule.NgayTruc &&
        Number(appointment.CaKham) === Number(schedule.CaTruc) &&
        configIds.includes(appointment.MaCauHinh) &&
        (appointment.MaBacSi ? appointment.MaBacSi === schedule.MaBacSi : true) &&
        activeStatuses.includes(appointment.TrangThai),
    )
  }

  const pushScheduleNotifications = (affectedAppointments, messageBuilder) => {
    const patientNotifications = affectedAppointments.map((appointment) => ({
      MaBenhAn: appointment.MaBenhAn,
      MaBenhNhan: appointment.MaBenhAn,
      message: messageBuilder(appointment),
    }))

    addPatientNotifications?.(patientNotifications)
    return patientNotifications.length
  }

  const filteredDoctorSchedules = doctorSchedules.filter((schedule) => {
    const matchedStartDate =
      !scheduleFilters.TuNgay || schedule.NgayTruc >= scheduleFilters.TuNgay
    const matchedEndDate =
      !scheduleFilters.DenNgay || schedule.NgayTruc <= scheduleFilters.DenNgay
    const matchedDoctor =
      scheduleFilters.MaBacSi === 'all' || schedule.MaBacSi === scheduleFilters.MaBacSi

    return matchedStartDate && matchedEndDate && matchedDoctor
  })

  useEffect(() => {
    if (activeMenu === 'schedules') {
      loadAdminDoctorSchedules()
    }
  }, [activeMenu, scheduleFilters.TuNgay, scheduleFilters.DenNgay, scheduleFilters.MaBacSi])

  const getReportMonthRangeLabel = (monthValue) => {
    const [year, month] = monthValue.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    const formattedMonth = String(month).padStart(2, '0')

    return `Chu kỳ báo cáo: Từ ngày 01/${formattedMonth}/${year} đến ngày ${lastDay}/${formattedMonth}/${year}`
  }

  const isInReportMonth = (dateValue) => Boolean(dateValue?.startsWith(reportMonth))

  const isCompletedVisitStatus = (status) => status === 'Hoàn thành' || status === 'Đã khám'

  const loadAdminMonthlyReport = async () => {
    if (!reportMonth) return

    setAdminReportLoading(true)
    setAdminReportError('')

    try {
      const response = await getMonthlyReport(reportMonth)
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể tải báo cáo tháng từ hệ thống.')
      }

      setAdminReportData(result.data || null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải báo cáo tháng từ hệ thống.'
      setAdminReportError(message)
      setAdminReportData(null)
      console.warn('ADMIN_MONTHLY_REPORT_LOAD_FAILED', message)
    } finally {
      setAdminReportLoading(false)
    }
  }

  useEffect(() => {
    loadAdminMonthlyReport()
  }, [reportMonth])

  const reportData = (() => {
    const appointmentsInMonth = appointments.filter((appointment) =>
      isInReportMonth(appointment.NgayKham),
    )
    const completedAppointments = appointmentsInMonth
      .filter((appointment) => isCompletedVisitStatus(appointment.TrangThai))
      .map((appointment) => {
        const { config, service } = getConfigService(appointment.MaCauHinh)
        const { netRevenue, insuranceAmount } = calculateRevenueParts(
          appointment.MaBenhAn,
          service.GiaGoc,
          appointment.GiaCuoi,
        )
        const doctor = doctorSchedules.find(
          (schedule) =>
            schedule.MaChiNhanh === config?.MaChiNhanh &&
            schedule.NgayTruc === appointment.NgayKham &&
            schedule.CaTruc === appointment.CaKham,
        )

        return {
          id: appointment.MaLichHen,
          type: 'Khám',
          groupLabel: 'Khám',
          maBenhAn: appointment.MaBenhAn,
          maChiNhanh: config?.MaChiNhanh || '',
          maDichVu: service.MaDichVu,
          tenDichVu: service.TenDichVu,
          chuyenKhoa: service.ChuyenKhoa,
          loaiDichVu: service.LoaiDichVu,
          giaGoc: service.GiaGoc,
          netRevenue,
          insuranceAmount,
          maBacSi: appointment.MaBacSi || doctor?.MaBacSi || '',
          ngayPhatSinh: appointment.NgayKham,
        }
      })

    const completedLabTests = labTestDetails
      .filter((test) => test.TrangThai === 'Hoàn thành' && isInReportMonth(test.NgayThucHien))
      .map((test) => {
        const service = getService(test.MaDichVu)
        const { netRevenue, insuranceAmount } = calculateRevenueParts(
          test.MaBenhAn,
          service.GiaGoc,
          test.GiaCuoi,
        )

        return {
          id: test.MaChiTietXN,
          type: 'Xét nghiệm',
          groupLabel: 'Xét nghiệm',
          maBenhAn: test.MaBenhAn,
          maChiNhanh: test.MaChiNhanh,
          maDichVu: service.MaDichVu,
          tenDichVu: service.TenDichVu,
          chuyenKhoa: service.ChuyenKhoa,
          loaiDichVu: service.LoaiDichVu,
          giaGoc: service.GiaGoc,
          netRevenue,
          insuranceAmount,
          maBacSi: test.MaBacSi,
          ngayPhatSinh: test.NgayThucHien,
        }
      })

    const completedTreatmentSessions = treatmentRevenueDetails
      .filter(
        (treatment) =>
          treatment.TrangThai === 'Hoàn thành' && isInReportMonth(treatment.NgayThucHien),
      )
      .map((treatment) => {
        const service = getService(treatment.MaDichVu)
        const { netRevenue, insuranceAmount } = calculateRevenueParts(
          treatment.MaBenhAn,
          service.GiaGoc,
          treatment.GiaCuoi,
        )

        return {
          id: treatment.MaLichTrinh,
          type: 'Điều trị',
          groupLabel: 'Điều trị nhiều buổi',
          maBenhAn: treatment.MaBenhAn,
          maChiNhanh: treatment.MaChiNhanh,
          maDichVu: service.MaDichVu,
          tenDichVu: service.TenDichVu,
          chuyenKhoa: service.ChuyenKhoa,
          loaiDichVu: service.LoaiDichVu,
          giaGoc: service.GiaGoc,
          netRevenue,
          insuranceAmount,
          maBacSi: treatment.MaBacSi,
          ngayPhatSinh: treatment.NgayThucHien,
        }
      })

    const completedFinancialRecords = [
      ...completedAppointments,
      ...completedLabTests,
      ...completedTreatmentSessions,
    ]
    const totalNetRevenue = completedFinancialRecords.reduce(
      (sum, record) => sum + record.netRevenue,
      0,
    )
    const totalInsuranceAmount = completedFinancialRecords.reduce(
      (sum, record) => sum + record.insuranceAmount,
      0,
    )
    const cancelledAppointments = appointmentsInMonth.filter((appointment) =>
      appointment.TrangThai.includes('Đã hủy'),
    ).length
    const cancellationRate =
      appointmentsInMonth.length > 0
        ? Math.round((cancelledAppointments / appointmentsInMonth.length) * 1000) / 10
        : 0

    const branchRows = branches.map((branch) => {
      const branchRecords = completedFinancialRecords.filter(
        (record) => record.maChiNhanh === branch.MaChiNhanh,
      )
      const branchCompletedAppointments = completedAppointments.filter(
        (record) => record.maChiNhanh === branch.MaChiNhanh,
      )

      return {
        maChiNhanh: branch.MaChiNhanh,
        tenChiNhanh: branch.TenChiNhanh,
        completedCount: branchCompletedAppointments.length,
        netRevenue: branchRecords.reduce((sum, record) => sum + record.netRevenue, 0),
        insuranceAmount: branchRecords.reduce((sum, record) => sum + record.insuranceAmount, 0),
      }
    })

    const rankBy = (records, keyGetter, valueGetter) => {
      const map = new Map()

      records.forEach((record) => {
        const key = keyGetter(record)
        if (!key) return

        const current = map.get(key) || { key, count: 0, value: 0, sample: record }
        map.set(key, {
          ...current,
          count: current.count + 1,
          value: current.value + valueGetter(record),
        })
      })

      return Array.from(map.values()).sort((a, b) => {
        if (b.value !== a.value) return b.value - a.value
        return b.count - a.count
      })
    }

    const serviceContributionRows = rankBy(
      completedFinancialRecords,
      (record) => record.maDichVu,
      (record) => record.netRevenue,
    ).map((item) => ({
      ...item,
      tenDichVu: item.sample.tenDichVu,
      loaiDichVu: item.sample.groupLabel,
    }))
    const doctorRows = rankBy(
      completedAppointments,
      (record) => record.maBacSi,
      () => 1,
    ).map((item) => {
      const doctor = staffList.find((staff) => staff.MaNhanSu === item.key)
      return {
        ...item,
        hoTen: doctor?.HoTen || 'Chưa phân công',
        chuyenKhoa: doctor?.ChuyenKhoa || 'Chưa rõ',
      }
    })

    return {
      totalNetRevenue,
      totalInsuranceAmount,
      completedAppointmentCount: completedAppointments.length,
      cancellationRate,
      totalServiceUsage: completedFinancialRecords.length,
      branchRows,
      doctorRows,
      serviceContributionRows,
    }
  })()

  const displayReportData = {
    ...reportData,
    ...(adminReportData || {}),
    branchRows: adminReportData?.branchRows || reportData.branchRows,
    doctorRows: adminReportData?.doctorRows || reportData.doctorRows,
    serviceContributionRows:
      adminReportData?.serviceContributionRows || reportData.serviceContributionRows,
  }

  const filteredBranchServices = branchServices.filter((config) => {
    const service = getService(config.MaDichVu)
    const matchedBranch =
      serviceFilters.MaChiNhanh === 'all' || config.MaChiNhanh === serviceFilters.MaChiNhanh
    const matchedType =
      serviceFilters.LoaiDichVu === 'all' || service.LoaiDichVu === serviceFilters.LoaiDichVu

    return matchedBranch && matchedType
  })

  const getDoctorName = (maBacSi) =>
    staffList.find((staff) => staff.MaNhanSu === maBacSi)?.HoTen || maBacSi

  const formatMoney = (value) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)

  const handleStaffFormChange = (field, value) => {
    if (field === 'VaiTro') {
      const requiresFixedBranch = value === 'Lễ tân' || value === 'Xét nghiệm viên'
      const departmentByRole = {
        'Bác sĩ': 'Nội tổng quát',
        'Lễ tân': 'Tiếp nhận',
        'Xét nghiệm viên': 'Xét nghiệm',
      }

      setStaffForm((current) => ({
        ...current,
        VaiTro: value,
        ChuyenKhoa: departmentByRole[value],
        MaChiNhanh: requiresFixedBranch ? current.MaChiNhanh || branches[0]?.MaChiNhanh || '' : '',
      }))
      return
    }

    setStaffForm((current) => ({ ...current, [field]: value }))
  }

  const buildStaffCode = (vaiTro) => {
    const prefixMap = {
      'Bác sĩ': 'BS',
      'Lễ tân': 'LT',
      'Xét nghiệm viên': 'XNV',
    }
    const prefix = prefixMap[vaiTro]
    const nextNumber =
      staffList.filter((staff) => staff.MaNhanSu.startsWith(prefix)).length + 1

    return `${prefix}${String(nextNumber).padStart(3, '0')}`
  }

  const handleAddStaff = (event) => {
    event.preventDefault()
    const requiresFixedBranch =
      staffForm.VaiTro === 'Lễ tân' || staffForm.VaiTro === 'Xét nghiệm viên'

    if (requiresFixedBranch && !staffForm.MaChiNhanh) {
      notify('Vui lòng chọn chi nhánh phụ trách.', 'error')
      return
    }

    if (requiresFixedBranch) {
      const hasFixedStaffInBranch = staffList.some(
        (staff) =>
          staff.VaiTro === staffForm.VaiTro &&
          staff.MaChiNhanh === staffForm.MaChiNhanh,
      )

      if (hasFixedStaffInBranch) {
        notify('Mỗi chi nhánh chỉ được phép có duy nhất 1 Lễ tân và 1 Xét nghiệm viên cố định!', 'error')
        return
      }
    }

    const newStaff = {
      MaNhanSu: buildStaffCode(staffForm.VaiTro),
      HoTen: staffForm.HoTen.trim(),
      VaiTro: staffForm.VaiTro,
      ChuyenKhoa: staffForm.ChuyenKhoa,
      SDT: staffForm.SDT.trim(),
      MatKhau: staffForm.MatKhau.trim(),
      ...(requiresFixedBranch ? { MaChiNhanh: staffForm.MaChiNhanh } : {}),
      TrangThai: 'active',
    }

    setStaffList((current) => [...current, newStaff])
    setStaffForm({
      HoTen: '',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Nội tổng quát',
      SDT: '',
      MatKhau: '',
      MaChiNhanh: '',
    })
    notify(`Đã tạo tài khoản ${newStaff.MaNhanSu} cho ${newStaff.HoTen}.`)
  }

  const handleToggleStaffStatus = (maNhanSu) => {
    const target = staffList.find((staff) => staff.MaNhanSu === maNhanSu)
    const nextStatus = target?.TrangThai === 'active' ? 'inactive' : 'active'
    const nextActiveDoctor = staffList.find(
      (staff) =>
        staff.VaiTro === 'Bác sĩ' &&
        staff.TrangThai === 'active' &&
        staff.MaNhanSu !== maNhanSu,
    )

    setStaffList((current) =>
      current.map((staff) =>
        staff.MaNhanSu === maNhanSu ? { ...staff, TrangThai: nextStatus } : staff,
      ),
    )
    if (
      target?.VaiTro === 'Bác sĩ' &&
      nextStatus === 'inactive' &&
      bulkScheduleForm.MaBacSi === maNhanSu &&
      nextActiveDoctor
    ) {
      setBulkScheduleForm((current) => ({ ...current, MaBacSi: nextActiveDoctor.MaNhanSu }))
    }
    notify(
      nextStatus === 'active'
        ? `Đã kích hoạt lại tài khoản ${maNhanSu}.`
        : `Đã vô hiệu hóa tài khoản ${maNhanSu}.`,
    )
  }

  const handleSaveSlot = (maCauHinh) => {
    const nextSlot = Math.max(0, Number(slotDrafts[maCauHinh] || 0))
    setBranchServices((current) =>
      current.map((config) =>
        config.MaCauHinh === maCauHinh ? { ...config, SlotGioiHan: nextSlot } : config,
      ),
    )
    setSlotDrafts((current) => ({ ...current, [maCauHinh]: String(nextSlot) }))
    notify(`Đã cập nhật SlotGioiHan cho cấu hình ${maCauHinh}.`)
  }

  const handleUpdateServicePrice = (maDichVu) => {
    const nextPrice = Math.max(0, Number(priceDrafts[maDichVu] || 0))
    setServices((current) =>
      current.map((service) =>
        service.MaDichVu === maDichVu ? { ...service, GiaGoc: nextPrice } : service,
      ),
    )
    setPriceDrafts((current) => ({ ...current, [maDichVu]: String(nextPrice) }))
    notify(`Đã cập nhật giá chung cho dịch vụ ${maDichVu}.`)
  }

  const handleNewServiceFormChange = (field, value) => {
    setNewServiceForm((current) => ({ ...current, [field]: value }))
  }

  const handleAddService = (event) => {
    event.preventDefault()
    const maDichVu = newServiceForm.MaDichVu.trim().toUpperCase()
    const tenDichVu = newServiceForm.TenDichVu.trim()
    const giaGoc = Math.max(0, Number(newServiceForm.GiaGoc || 0))

    if (!maDichVu || !tenDichVu || giaGoc <= 0) {
      notify('Vui lòng nhập đầy đủ mã dịch vụ, tên dịch vụ và giá gốc lớn hơn 0.', 'error')
      return
    }

    if (services.some((service) => service.MaDichVu === maDichVu)) {
      notify(`Mã dịch vụ ${maDichVu} đã tồn tại trong danh mục.`, 'error')
      return
    }

    const newService = {
      MaDichVu: maDichVu,
      TenDichVu: tenDichVu,
      ChuyenKhoa: newServiceForm.ChuyenKhoa,
      LoaiDichVu: newServiceForm.LoaiDichVu,
      GiaGoc: giaGoc,
    }

    setServices((current) => [...current, newService])
    setPriceDrafts((current) => ({ ...current, [maDichVu]: String(giaGoc) }))
    setDistributionForm((current) => ({ ...current, MaDichVu: maDichVu }))
    setNewServiceForm({
      MaDichVu: '',
      TenDichVu: '',
      LoaiDichVu: 'Khám lâm sàng',
      ChuyenKhoa: 'Nội tổng quát',
      GiaGoc: '',
    })
    notify(`Đã thêm dịch vụ ${maDichVu} vào danh mục gốc.`)
  }

  const handleDeleteRootService = (maDichVu) => {
    const remainingServices = services.filter((service) => service.MaDichVu !== maDichVu)
    const relatedConfigs = branchServices.filter((config) => config.MaDichVu === maDichVu)
    const relatedConfigIds = relatedConfigs.map((config) => config.MaCauHinh)
    const nextSelectedService =
      distributionForm.MaDichVu === maDichVu
        ? remainingServices[0]?.MaDichVu || ''
        : distributionForm.MaDichVu

    setServices(remainingServices)
    setBranchServices((current) => current.filter((config) => config.MaDichVu !== maDichVu))
    setDistributionForm((current) => ({ ...current, MaDichVu: nextSelectedService }))
    setPriceDrafts((current) => {
      const nextDrafts = { ...current }
      delete nextDrafts[maDichVu]
      return nextDrafts
    })
    setSlotDrafts((current) => {
      const nextDrafts = { ...current }
      relatedConfigIds.forEach((maCauHinh) => {
        delete nextDrafts[maCauHinh]
      })
      return nextDrafts
    })
    notify(
      `Đã xóa dịch vụ gốc ${maDichVu} và ${relatedConfigs.length} cấu hình chi nhánh liên quan.`,
    )
  }

  const handleBranchFormChange = (field, value) => {
    setBranchForm((current) => ({ ...current, [field]: value }))
  }

  const handleAddBranch = (event) => {
    event.preventDefault()
    const maChiNhanh = branchForm.MaChiNhanh.trim().toUpperCase()
    const tenChiNhanh = branchForm.TenChiNhanh.trim()
    const diaChi = branchForm.DiaChi.trim()

    if (!maChiNhanh || !tenChiNhanh || !diaChi) {
      notify('Vui lòng nhập đầy đủ mã chi nhánh, tên chi nhánh và địa chỉ.', 'error')
      return
    }

    if (branches.some((branch) => branch.MaChiNhanh === maChiNhanh)) {
      notify(`Mã chi nhánh ${maChiNhanh} đã tồn tại.`, 'error')
      return
    }

    const newBranch = {
      MaChiNhanh: maChiNhanh,
      TenChiNhanh: tenChiNhanh,
      DiaChi: diaChi,
      SDT: branchForm.SDT.trim(),
    }

    setBranches((current) => [...current, newBranch])
    setDistributionForm((current) => ({ ...current, MaChiNhanh: maChiNhanh }))
    setBranchForm({ MaChiNhanh: '', TenChiNhanh: '', DiaChi: '', SDT: '' })
    notify(`Đã thêm chi nhánh ${maChiNhanh}.`)
  }

  const handleDeleteRootBranch = (maChiNhanh) => {
    const remainingBranches = branches.filter((branch) => branch.MaChiNhanh !== maChiNhanh)
    const relatedConfigs = branchServices.filter((config) => config.MaChiNhanh === maChiNhanh)
    const relatedConfigIds = relatedConfigs.map((config) => config.MaCauHinh)
    const relatedSchedules = doctorSchedules.filter((schedule) => schedule.MaChiNhanh === maChiNhanh)
    const nextSelectedBranch =
      distributionForm.MaChiNhanh === maChiNhanh
        ? remainingBranches[0]?.MaChiNhanh || ''
        : distributionForm.MaChiNhanh

    setBranches(remainingBranches)
    setBranchServices((current) => current.filter((config) => config.MaChiNhanh !== maChiNhanh))
    setDoctorSchedules((current) => current.filter((schedule) => schedule.MaChiNhanh !== maChiNhanh))
    setDistributionForm((current) => ({ ...current, MaChiNhanh: nextSelectedBranch }))
    setBulkScheduleForm((current) => ({
      ...current,
      MaChiNhanh: current.MaChiNhanh === maChiNhanh ? nextSelectedBranch : current.MaChiNhanh,
    }))
    setServiceFilters((current) => ({
      ...current,
      MaChiNhanh: current.MaChiNhanh === maChiNhanh ? 'all' : current.MaChiNhanh,
    }))
    setSlotDrafts((current) => {
      const nextDrafts = { ...current }
      relatedConfigIds.forEach((maCauHinh) => {
        delete nextDrafts[maCauHinh]
      })
      return nextDrafts
    })
    notify(
      `Đã xóa chi nhánh ${maChiNhanh}, ${relatedConfigs.length} cấu hình dịch vụ và ${relatedSchedules.length} lịch trực liên quan.`,
    )
  }

  const handleDistributionFormChange = (field, value) => {
    setDistributionForm((current) => ({ ...current, [field]: value }))
  }

  const buildBranchServiceCode = (maChiNhanh, maDichVu) => {
    const branchSuffix = maChiNhanh.replace('CN_', '')
    const serviceSuffix = maDichVu.replace('DV_', '').replace('DT_', '').replace('XN_', '')
    return `CH_${branchSuffix}_${serviceSuffix}`.replaceAll('__', '_')
  }

  const handleApplyBranchService = (event) => {
    event.preventDefault()
    if (!distributionForm.MaChiNhanh || !distributionForm.MaDichVu) {
      notify('Cần có ít nhất một chi nhánh và một dịch vụ để áp dụng cấu hình.', 'error')
      return
    }

    const slot = Math.max(0, Number(distributionForm.SlotGioiHan || 0))
    const existingConfig = branchServices.find(
      (config) =>
        config.MaChiNhanh === distributionForm.MaChiNhanh &&
        config.MaDichVu === distributionForm.MaDichVu,
    )

    if (existingConfig) {
      setBranchServices((current) =>
        current.map((config) =>
          config.MaCauHinh === existingConfig.MaCauHinh
            ? { ...config, SlotGioiHan: slot, TrangThai: 'active' }
            : config,
        ),
      )
      setSlotDrafts((current) => ({ ...current, [existingConfig.MaCauHinh]: String(slot) }))
      notify(`Đã cập nhật và hiển thị lại cấu hình ${existingConfig.MaCauHinh}.`)
      return
    }

    const maCauHinh = buildBranchServiceCode(distributionForm.MaChiNhanh, distributionForm.MaDichVu)
    const newConfig = {
      MaCauHinh: maCauHinh,
      MaChiNhanh: distributionForm.MaChiNhanh,
      MaDichVu: distributionForm.MaDichVu,
      SlotGioiHan: slot,
      TrangThai: 'active',
    }

    setBranchServices((current) => [...current, newConfig])
    setSlotDrafts((current) => ({ ...current, [maCauHinh]: String(slot) }))
    notify(`Đã áp dụng dịch vụ ${distributionForm.MaDichVu} cho ${distributionForm.MaChiNhanh}.`)
  }

  const handleToggleBranchService = (maCauHinh) => {
    const target = branchServices.find((config) => config.MaCauHinh === maCauHinh)
    const nextStatus = target?.TrangThai === 'active' ? 'inactive' : 'active'

    setBranchServices((current) =>
      current.map((config) =>
        config.MaCauHinh === maCauHinh ? { ...config, TrangThai: nextStatus } : config,
      ),
    )
    notify(
      nextStatus === 'active'
        ? `Đã hiện lại cấu hình ${maCauHinh}.`
        : `Đã ẩn cấu hình ${maCauHinh}.`,
    )
  }

  const handleDeleteBranchService = (maCauHinh) => {
    setBranchServices((current) => current.filter((config) => config.MaCauHinh !== maCauHinh))
    setSlotDrafts((current) => {
      const nextDrafts = { ...current }
      delete nextDrafts[maCauHinh]
      return nextDrafts
    })
    notify(`Đã xóa cấu hình ${maCauHinh} khỏi chi nhánh.`)
  }

  const handleBulkScheduleFormChange = (field, value) => {
    setBulkScheduleForm((current) => ({ ...current, [field]: value }))
  }

  const handleScheduleFilterChange = (field, value) => {
    setScheduleFilters((current) => ({ ...current, [field]: value }))
  }

  const getScheduleSelectionKey = (thu, ca) => `${thu}-${ca}`

  const normalizeAdminSchedule = (schedule) => ({
    id: schedule.id ?? null,
    MaLichTruc: schedule.MaLichTruc,
    MaBacSi: schedule.MaBacSi,
    TenBacSi: schedule.TenBacSi || '',
    MaChiNhanh: schedule.MaChiNhanh,
    TenChiNhanh: schedule.TenChiNhanh || '',
    NgayTruc: schedule.NgayTruc,
    CaTruc: Number(schedule.CaTruc),
    TrangThai: schedule.TrangThai || 'Đang hoạt động',
    SoLichHenDangCo: Number(schedule.SoLichHenDangCo || 0),
    SDT: schedule.SDT || '',
    ChuyenKhoa: schedule.ChuyenKhoa || '',
  })

  const isSameDoctorSchedule = (leftSchedule, rightSchedule) => {
    if (!leftSchedule || !rightSchedule) return false

    if (leftSchedule.id && rightSchedule.id) {
      return Number(leftSchedule.id) === Number(rightSchedule.id)
    }

    return (
      leftSchedule.MaLichTruc === rightSchedule.MaLichTruc &&
      leftSchedule.MaBacSi === rightSchedule.MaBacSi &&
      leftSchedule.MaChiNhanh === rightSchedule.MaChiNhanh &&
      leftSchedule.NgayTruc === rightSchedule.NgayTruc &&
      Number(leftSchedule.CaTruc) === Number(rightSchedule.CaTruc)
    )
  }

  const loadAdminDoctorSchedules = async () => {
    setAdminScheduleLoading(true)
    setAdminScheduleError('')

    const params = new URLSearchParams()
    if (scheduleFilters.TuNgay) params.set('from_date', scheduleFilters.TuNgay)
    if (scheduleFilters.DenNgay) params.set('to_date', scheduleFilters.DenNgay)
    if (scheduleFilters.MaBacSi !== 'all') params.set('ma_bac_si', scheduleFilters.MaBacSi)

    try {
      const response = await listDoctorSchedules(params.toString())
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể tải lịch trực từ database.')
      }

      setDoctorSchedules((result.data || []).map(normalizeAdminSchedule))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải lịch trực từ database.'
      setAdminScheduleError(message)
      console.warn('ADMIN_SCHEDULE_LOAD_FAILED', message)
    } finally {
      setAdminScheduleLoading(false)
    }
  }

  const handleToggleScheduleSelection = (thu, ca) => {
    const key = getScheduleSelectionKey(thu, ca)
    setBulkScheduleForm((current) => ({
      ...current,
      selections: {
        ...current.selections,
        [key]: !current.selections[key],
      },
    }))
  }

  const parseDateInput = (value) => new Date(`${value}T00:00:00`)

  const formatDateInput = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
  }

  const handleBulkAssignSchedule = async (event) => {
    event.preventDefault()
    const activeDoctor = doctors.some((doctor) => doctor.MaNhanSu === bulkScheduleForm.MaBacSi)
    const selectedKeys = Object.entries(bulkScheduleForm.selections)
      .filter(([, selected]) => selected)
      .map(([key]) => key)

    if (!activeDoctor) {
      notify('Chỉ có thể xếp lịch cho bác sĩ đang active.', 'error')
      return
    }

    if (!bulkScheduleForm.MaChiNhanh) {
      notify('Vui lòng chọn chi nhánh trước khi xếp lịch.', 'error')
      return
    }

    if (!bulkScheduleForm.TuNgay || !bulkScheduleForm.DenNgay) {
      notify('Vui lòng chọn đầy đủ khoảng ngày.', 'error')
      return
    }

    if (selectedKeys.length === 0) {
      notify('Vui lòng tích ít nhất một ô Thứ/Ca trong ma trận lịch trực.', 'error')
      return
    }

    const startDate = parseDateInput(bulkScheduleForm.TuNgay)
    const endDate = parseDateInput(bulkScheduleForm.DenNgay)

    if (startDate > endDate) {
      notify('Khoảng ngày không hợp lệ: Từ ngày phải nhỏ hơn hoặc bằng Đến ngày.', 'error')
      return
    }

    const existingKeys = new Set(
      doctorSchedules
        .filter((schedule) => schedule.TrangThai !== 'Đã hủy')
        .map(
          (schedule) =>
            `${schedule.MaBacSi}-${schedule.MaChiNhanh}-${schedule.NgayTruc}-${schedule.CaTruc}`,
        ),
    )
    const newSchedules = []
    let runningIndex = doctorSchedules.length + 1

    for (
      const cursor = new Date(startDate);
      cursor <= endDate;
      cursor.setDate(cursor.getDate() + 1)
    ) {
      const weekday = cursor.getDay() === 0 ? 1 : cursor.getDay() + 1
      const ngayTruc = formatDateInput(cursor)

      for (let ca = 1; ca <= 4; ca += 1) {
        const selected = selectedKeys.includes(getScheduleSelectionKey(weekday, ca))
        const duplicateKey = `${bulkScheduleForm.MaBacSi}-${bulkScheduleForm.MaChiNhanh}-${ngayTruc}-${ca}`

        if (selected && !existingKeys.has(duplicateKey)) {
          newSchedules.push({
            MaLichTruc: `LT_${String(runningIndex).padStart(3, '0')}`,
            MaBacSi: bulkScheduleForm.MaBacSi,
            MaChiNhanh: bulkScheduleForm.MaChiNhanh,
            NgayTruc: ngayTruc,
            CaTruc: ca,
            TrangThai: 'Đang hoạt động',
          })
          existingKeys.add(duplicateKey)
          runningIndex += 1
        }
      }
    }

    if (newSchedules.length === 0) {
      notify('Không có lịch trực mới được tạo vì toàn bộ lựa chọn đã trùng lịch hiện có.', 'error')
      return
    }

    try {
      const createdSchedules = []

      for (const schedule of newSchedules) {
        const formData = new FormData()
        formData.append('ma_bac_si', schedule.MaBacSi)
        formData.append('ma_chi_nhanh', schedule.MaChiNhanh)
        formData.append('ngay_truc', schedule.NgayTruc)
        formData.append('ca_truc', String(schedule.CaTruc))

        const response = await createDoctorSchedules({
          method: 'POST',
          body: formData,
        })
        const result = await response.json()

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || `Không thể tạo lịch trực ngày ${schedule.NgayTruc} ca ${schedule.CaTruc}.`)
        }

        createdSchedules.push({
          ...schedule,
          id: result.data?.id ?? null,
          MaLichTruc: result.data?.MaLichTruc || schedule.MaLichTruc,
        })
      }

      setDoctorSchedules((current) => [...current, ...createdSchedules])
      await loadAdminDoctorSchedules()
      notify(`Đã xếp ${createdSchedules.length} ca trực mới cho ${getDoctorName(bulkScheduleForm.MaBacSi)}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể xếp lịch trực vào database.'
      notify(message, 'error')
    }
  }

  const handleCancelSchedule = async (schedule) => {
    const affectedAppointments = getAffectedAppointmentsForSchedule(schedule)
    const affectedCount = Number(schedule.SoLichHenDangCo ?? affectedAppointments.length)
    const affectedAppointmentIds = new Set(affectedAppointments.map((appointment) => appointment.MaLichHen))

    if (affectedCount > 0) {
      const confirmed = window.confirm(
        `Ca trực này đang có ${affectedCount} lịch hẹn chưa hoàn thành. Bạn có chắc chắn muốn hủy ca trực này và tự động hoàn tiền cho bệnh nhân?`,
      )

      if (!confirmed) {
        return
      }
    }

    try {
      const response = await cancelDoctorSchedules({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: schedule.id ?? null,
          MaLichTruc: schedule.MaLichTruc,
        }),
      })
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể hủy ca trực.')
      }

      setAppointments((current) =>
        current.map((appointment) =>
          affectedAppointmentIds.has(appointment.MaLichHen)
            ? { ...appointment, TrangThai: 'Đã hủy' }
            : appointment,
        ),
      )

      setDoctorSchedules((current) =>
        current.map((item) =>
          isSameDoctorSchedule(item, schedule)
            ? { ...item, TrangThai: 'Đã hủy', SoLichHenDangCo: 0 }
            : item,
        ),
      )

      const affectedPatients = result.data?.affectedPatients || []
      addPatientNotifications?.(affectedPatients)

      addScheduleAdjustment?.({
        type: 'cancel',
        MaLichTruc: schedule.MaLichTruc,
        MaBacSi: schedule.MaBacSi,
        MaChiNhanh: schedule.MaChiNhanh,
        NgayTruc: schedule.NgayTruc,
        CaTruc: schedule.CaTruc,
      })

      notify(
        affectedPatients.length > 0
          ? `Đã hủy ca trực và phát thông báo cảnh báo đến ${affectedPatients.length} bệnh nhân bị ảnh hưởng!`
          : `Đã hủy ca trực ${schedule.MaLichTruc}.`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể hủy ca trực.'
      notify(message, 'error')
    }
  }

  const getTransferDoctorOptions = (schedule) => {
    if (!schedule) return []

    const currentDoctor = staffList.find((staff) => staff.MaNhanSu === schedule.MaBacSi)
    const sameSpecialtyDoctors = staffList.filter(
      (staff) =>
        staff.VaiTro === 'Bác sĩ' &&
        staff.TrangThai === 'active' &&
        staff.MaNhanSu !== schedule.MaBacSi &&
        staff.ChuyenKhoa === currentDoctor?.ChuyenKhoa,
    )

    if (sameSpecialtyDoctors.length > 0) return sameSpecialtyDoctors

    return staffList.filter(
      (staff) =>
        staff.VaiTro === 'Bác sĩ' &&
        staff.TrangThai === 'active' &&
        staff.MaNhanSu !== schedule.MaBacSi,
    )
  }

  const handleOpenDoctorTransfer = (schedule) => {
    const options = getTransferDoctorOptions(schedule)
    setDoctorTransferModal({
      show: true,
      schedule,
      nextDoctorId: options[0]?.MaNhanSu || '',
    })
  }

  const handleCloseDoctorTransfer = () => {
    setDoctorTransferModal({ show: false, schedule: null, nextDoctorId: '' })
  }

  const handleConfirmDoctorTransfer = async () => {
    const schedule = doctorTransferModal.schedule
    const nextDoctorId = doctorTransferModal.nextDoctorId

    if (!schedule || !nextDoctorId) {
      notify('Vui lòng chọn bác sĩ mới để điều chuyển ca trực.', 'error')
      return
    }

    const nextDoctor = staffList.find((staff) => staff.MaNhanSu === nextDoctorId)
    const affectedAppointments = getAffectedAppointmentsForSchedule(schedule)
    const affectedAppointmentIds = new Set(affectedAppointments.map((appointment) => appointment.MaLichHen))

    try {
      const response = await transferDoctorSchedules({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: schedule.id ?? null,
          MaLichTruc: schedule.MaLichTruc,
          newMaBacSi: nextDoctorId,
        }),
      })
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể điều chuyển bác sĩ trực.')
      }

      setDoctorSchedules((current) =>
        current.map((item) =>
          isSameDoctorSchedule(item, schedule)
            ? {
                ...item,
                ...normalizeAdminSchedule(result.data?.schedule || {}),
                MaBacSi: nextDoctorId,
                TenBacSi: nextDoctor?.HoTen || result.data?.schedule?.TenBacSi || nextDoctorId,
              }
            : item,
        ),
      )
      setAppointments((current) =>
        current.map((appointment) =>
          affectedAppointmentIds.has(appointment.MaLichHen)
            ? { ...appointment, MaBacSi: nextDoctorId }
            : appointment,
        ),
      )

      const affectedPatients = result.data?.affectedPatients || []
      addPatientNotifications?.(affectedPatients)

      addScheduleAdjustment?.({
        type: 'transfer',
        MaLichTruc: schedule.MaLichTruc,
        oldMaBacSi: schedule.MaBacSi,
        newMaBacSi: nextDoctorId,
        MaChiNhanh: schedule.MaChiNhanh,
        NgayTruc: schedule.NgayTruc,
        CaTruc: schedule.CaTruc,
      })

      handleCloseDoctorTransfer()
      notify(
        `Đã điều chuyển bác sĩ trực và phát thông báo cảnh báo đến ${affectedPatients.length} bệnh nhân bị ảnh hưởng!`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể điều chuyển bác sĩ trực.'
      notify(message, 'error')
    }
  }

  const renderStaffManagement = () => (
    <div className="admin-stack">
      <section className="admin-card">
        <div className="admin-section-header">
          <div>
            <h2>Quản lý Nhân sự</h2>
            <p>Tạo tài khoản cho Bác sĩ, Lễ tân và Xét nghiệm viên theo đúng mã định danh hệ thống.</p>
          </div>
        </div>

        <form className="admin-form-grid" onSubmit={handleAddStaff}>
          <label>
            Họ tên
            <input
              className="admin-input"
              value={staffForm.HoTen}
              onChange={(event) => handleStaffFormChange('HoTen', event.target.value)}
              required
            />
          </label>
          <label>
            Vai trò
            <select
              className="admin-input"
              value={staffForm.VaiTro}
              onChange={(event) => handleStaffFormChange('VaiTro', event.target.value)}
            >
              <option value="Bác sĩ">Bác sĩ</option>
              <option value="Lễ tân">Lễ tân</option>
              <option value="Xét nghiệm viên">Xét nghiệm viên</option>
            </select>
          </label>
          <label>
            Chuyên khoa/Bộ phận
            <select
              className="admin-input"
              value={staffForm.ChuyenKhoa}
              onChange={(event) => handleStaffFormChange('ChuyenKhoa', event.target.value)}
              disabled={staffForm.VaiTro !== 'Bác sĩ'}
            >
              {staffForm.VaiTro === 'Bác sĩ' ? (
                clinicalDepartments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))
              ) : (
                <option value={staffForm.ChuyenKhoa}>{staffForm.ChuyenKhoa}</option>
              )}
            </select>
          </label>
          {(staffForm.VaiTro === 'Lễ tân' || staffForm.VaiTro === 'Xét nghiệm viên') && (
            <label className="admin-fixed-branch-field">
              Chi nhánh phụ trách
              <select
                className="admin-input"
                value={staffForm.MaChiNhanh}
                onChange={(event) => handleStaffFormChange('MaChiNhanh', event.target.value)}
                required
              >
                {branches.map((branch) => (
                  <option key={branch.MaChiNhanh} value={branch.MaChiNhanh}>
                    {branch.TenChiNhanh}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Số điện thoại
            <input
              className="admin-input"
              value={staffForm.SDT}
              onChange={(event) => handleStaffFormChange('SDT', event.target.value)}
              required
            />
          </label>
          <label>
            Mật khẩu
            <input
              className="admin-input"
              type="password"
              value={staffForm.MatKhau}
              onChange={(event) => handleStaffFormChange('MatKhau', event.target.value)}
              required
            />
          </label>
          <button type="submit" className="admin-primary-button">
            Thêm nhân sự
          </button>
        </form>

        <label className="admin-search-field">
          <span>Tìm kiếm nhân sự</span>
          <input
            className="admin-input"
            value={staffSearch}
            onChange={(event) => setStaffSearch(event.target.value)}
            placeholder="Tìm theo mã, họ tên, SĐT, vai trò hoặc chuyên khoa"
          />
        </label>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mã nhân sự</th>
                <th>Họ tên</th>
                <th>Vai trò</th>
                <th>Chuyên khoa/Bộ phận</th>
                <th>Chi nhánh phụ trách</th>
                <th>Số điện thoại</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaffList.map((staff) => (
                <tr key={staff.MaNhanSu}>
                  <td>{staff.MaNhanSu}</td>
                  <td>{staff.HoTen}</td>
                  <td>{staff.VaiTro}</td>
                  <td>{staff.ChuyenKhoa}</td>
                  <td>{staff.MaChiNhanh ? getBranchName(staff.MaChiNhanh) : 'Linh hoạt theo lịch trực'}</td>
                  <td>{staff.SDT}</td>
                  <td>
                    <span className={`status-pill ${staff.TrangThai === 'active' ? 'active' : 'muted'}`}>
                      {staff.TrangThai === 'active' ? 'Đang hoạt động' : 'Đã khóa'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={
                        staff.TrangThai === 'active'
                          ? 'admin-danger-button'
                          : 'admin-success-button'
                      }
                      onClick={() => handleToggleStaffStatus(staff.MaNhanSu)}
                    >
                      {staff.TrangThai === 'active' ? 'Vô hiệu hóa' : 'Kích hoạt lại'}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredStaffList.length === 0 && (
                <tr>
                  <td colSpan="8">Không tìm thấy nhân sự phù hợp.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card">
        <h2>Danh sách Bệnh nhân</h2>
        <p>Bệnh nhân chỉ theo dõi tại Admin; tài khoản được tạo từ màn hình đăng ký bệnh nhân.</p>
        <label className="admin-search-field">
          <span>Tìm kiếm bệnh nhân</span>
          <input
            className="admin-input"
            value={patientSearch}
            onChange={(event) => setPatientSearch(event.target.value)}
            placeholder="Tìm theo mã bệnh án, CCCD, họ tên, SĐT hoặc địa chỉ"
          />
        </label>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mã bệnh án</th>
                <th>Họ tên</th>
                <th>Số CCCD</th>
                <th>Số điện thoại</th>
                <th>Địa chỉ</th>
                <th>Mã số BHYT</th>
                <th>Ký tự đầu BHYT</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.map((patient) => (
                <tr key={patient.MaBenhAn}>
                  <td>{patient.MaBenhAn}</td>
                  <td>{patient.HoTen}</td>
                  <td>{patient.CCCD}</td>
                  <td>{patient.SDT}</td>
                  <td>{patient.DiaChi}</td>
                  <td>{patient.MaSoBHYT || 'Không có'}</td>
                  <td>{patient.KyTuDauBHYT || 'Không có'}</td>
                </tr>
              ))}
              {filteredPatients.length === 0 && (
                <tr>
                  <td colSpan="7">Không tìm thấy bệnh nhân phù hợp.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )

  const renderServiceConfig = () => (
    <div className="admin-stack">
      <section className="admin-card">
        <h2>Quản lý giá danh mục dịch vụ</h2>
        <p>Giá gốc nằm tại bảng DICH_VU. Khi cập nhật tại đây, mọi chi nhánh đang phân phối dịch vụ sẽ dùng cùng mức giá mới.</p>

        <form className="admin-form-grid admin-form-grid-wide" onSubmit={handleAddService}>
          <label>
            Mã dịch vụ mới
            <input
              className="admin-input"
              value={newServiceForm.MaDichVu}
              onChange={(event) => handleNewServiceFormChange('MaDichVu', event.target.value)}
              placeholder="VD: DV_KHAM_DA_LIEU"
              required
            />
          </label>
          <label>
            Tên dịch vụ
            <input
              className="admin-input"
              value={newServiceForm.TenDichVu}
              onChange={(event) => handleNewServiceFormChange('TenDichVu', event.target.value)}
              placeholder="Nhập tên dịch vụ"
              required
            />
          </label>
          <label>
            Loại dịch vụ
            <select
              className="admin-input"
              value={newServiceForm.LoaiDichVu}
              onChange={(event) => handleNewServiceFormChange('LoaiDichVu', event.target.value)}
            >
              {serviceTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            Chuyên khoa
            <select
              className="admin-input"
              value={newServiceForm.ChuyenKhoa}
              onChange={(event) => handleNewServiceFormChange('ChuyenKhoa', event.target.value)}
            >
              {serviceDepartments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </label>
          <label>
            Giá gốc ban đầu
            <input
              className="admin-input"
              type="number"
              min="0"
              step="1000"
              value={newServiceForm.GiaGoc}
              onChange={(event) => handleNewServiceFormChange('GiaGoc', event.target.value)}
              required
            />
          </label>
          <button type="submit" className="admin-primary-button">
            Thêm dịch vụ
          </button>
        </form>

        <label className="admin-search-field">
          <span>Tìm kiếm dịch vụ</span>
          <input
            className="admin-input"
            value={serviceSearch}
            onChange={(event) => setServiceSearch(event.target.value)}
            placeholder="Tìm theo mã, tên, loại dịch vụ hoặc chuyên khoa"
          />
        </label>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mã dịch vụ</th>
                <th>Tên dịch vụ</th>
                <th>Loại dịch vụ</th>
                <th>Chuyên khoa</th>
                <th>Giá dịch vụ</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.map((service) => (
                <tr key={service.MaDichVu}>
                  <td>{service.MaDichVu}</td>
                  <td>{service.TenDichVu}</td>
                  <td>{service.LoaiDichVu}</td>
                  <td>{service.ChuyenKhoa}</td>
                  <td>
                    <input
                      className="admin-money-input"
                      type="number"
                      min="0"
                      step="1000"
                      value={priceDrafts[service.MaDichVu]}
                      onChange={(event) =>
                        setPriceDrafts((current) => ({
                          ...current,
                          [service.MaDichVu]: event.target.value,
                        }))
                      }
                    />
                  </td>
                  <td>
                    <div className="admin-actions-row">
                      <button
                        type="button"
                        className="admin-primary-button compact"
                        onClick={() => handleUpdateServicePrice(service.MaDichVu)}
                      >
                        Cập nhật giá
                      </button>
                      <button
                        type="button"
                        className="admin-delete-button"
                        onClick={() => handleDeleteRootService(service.MaDichVu)}
                      >
                        Xóa gốc
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredServices.length === 0 && (
                <tr>
                  <td colSpan="6">Không tìm thấy dịch vụ phù hợp.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card">
        <h2>Quản lý danh sách Chi nhánh</h2>
        <p>Theo dõi các cơ sở đang vận hành và thêm chi nhánh mới khi phòng khám mở rộng.</p>

        <form className="admin-form-grid" onSubmit={handleAddBranch}>
          <label>
            Mã chi nhánh
            <input
              className="admin-input"
              value={branchForm.MaChiNhanh}
              onChange={(event) => handleBranchFormChange('MaChiNhanh', event.target.value)}
              placeholder="VD: CN_DD"
              required
            />
          </label>
          <label>
            Tên chi nhánh
            <input
              className="admin-input"
              value={branchForm.TenChiNhanh}
              onChange={(event) => handleBranchFormChange('TenChiNhanh', event.target.value)}
              placeholder="Medicare - Cơ sở ..."
              required
            />
          </label>
          <label>
            Địa chỉ
            <input
              className="admin-input"
              value={branchForm.DiaChi}
              onChange={(event) => handleBranchFormChange('DiaChi', event.target.value)}
              placeholder="Nhập địa chỉ chi nhánh"
              required
            />
          </label>
          <label>
            Số điện thoại
            <input
              className="admin-input"
              value={branchForm.SDT}
              onChange={(event) => handleBranchFormChange('SDT', event.target.value)}
              placeholder="Nhập số điện thoại"
            />
          </label>
          <button type="submit" className="admin-primary-button">
            Thêm chi nhánh
          </button>
        </form>

        <div className="admin-branch-grid">
          {branches.map((branch) => (
            <div className="admin-branch-card" key={branch.MaChiNhanh}>
              <strong>{branch.MaChiNhanh}</strong>
              <span>{branch.TenChiNhanh}</span>
              <small>{branch.DiaChi}</small>
              <small>{branch.SDT || 'Chưa có số điện thoại'}</small>
              <div className="admin-branch-card-actions">
                <button
                  type="button"
                  className="admin-delete-button"
                  onClick={() => handleDeleteRootBranch(branch.MaChiNhanh)}
                >
                  Xóa chi nhánh
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-card">
        <h2>Phân phối & Cấu hình Slot theo Chi nhánh</h2>
        <p>Bảng CHI_NHANH_DICH_VU chỉ quản lý dịch vụ đang được bật tại từng cơ sở, SlotGioiHan và trạng thái ẩn/hiện.</p>

        <form className="admin-form-grid" onSubmit={handleApplyBranchService}>
          <label>
            Chi nhánh
            <select
              className="admin-input"
              value={distributionForm.MaChiNhanh}
              onChange={(event) => handleDistributionFormChange('MaChiNhanh', event.target.value)}
            >
              {branches.map((branch) => (
                <option key={branch.MaChiNhanh} value={branch.MaChiNhanh}>
                  {branch.TenChiNhanh}
                </option>
              ))}
            </select>
          </label>
          <label>
            Dịch vụ
            <select
              className="admin-input"
              value={distributionForm.MaDichVu}
              onChange={(event) => handleDistributionFormChange('MaDichVu', event.target.value)}
            >
              {services.map((service) => (
                <option key={service.MaDichVu} value={service.MaDichVu}>
                  {service.MaDichVu} - {service.TenDichVu} ({formatMoney(service.GiaGoc)})
                </option>
              ))}
            </select>
          </label>
          <label>
            Slot giới hạn
            <input
              className="admin-input"
              type="number"
              min="0"
              value={distributionForm.SlotGioiHan}
              onChange={(event) => handleDistributionFormChange('SlotGioiHan', event.target.value)}
              required
            />
          </label>
          <button type="submit" className="admin-primary-button">
            Áp dụng cho chi nhánh
          </button>
        </form>

        <div className="admin-price-preview">
          Giá chuẩn hiện tại:{' '}
          <strong>{formatMoney(getService(distributionForm.MaDichVu).GiaGoc)}</strong>
        </div>

        <div className="admin-filter-row">
          <label>
            Lọc theo Chi nhánh
            <select
              className="admin-input"
              value={serviceFilters.MaChiNhanh}
              onChange={(event) =>
                setServiceFilters((current) => ({ ...current, MaChiNhanh: event.target.value }))
              }
            >
              <option value="all">Tất cả</option>
              {branches.map((branch) => (
                <option key={branch.MaChiNhanh} value={branch.MaChiNhanh}>
                  {branch.TenChiNhanh.replace('Medicare - Cơ sở ', '')}
                </option>
              ))}
            </select>
          </label>
          <label>
            Lọc theo Loại dịch vụ
            <select
              className="admin-input"
              value={serviceFilters.LoaiDichVu}
              onChange={(event) =>
                setServiceFilters((current) => ({ ...current, LoaiDichVu: event.target.value }))
              }
            >
              <option value="all">Tất cả</option>
              <option value="Khám lâm sàng">Khám lâm sàng</option>
              <option value="Xét nghiệm">Xét nghiệm</option>
              <option value="Điều trị">Điều trị</option>
            </select>
          </label>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Chi nhánh</th>
                <th>Tên dịch vụ</th>
                <th>Loại dịch vụ</th>
                <th>Giá hiện tại</th>
                <th>Slot giới hạn</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredBranchServices.map((config) => {
                const service = getService(config.MaDichVu)
                return (
                  <tr key={config.MaCauHinh}>
                    <td>{getBranchName(config.MaChiNhanh)}</td>
                    <td>{service.TenDichVu}</td>
                    <td>{service.LoaiDichVu}</td>
                    <td>{formatMoney(service.GiaGoc)}</td>
                    <td>
                      <input
                        className="admin-slot-input"
                        type="number"
                        min="0"
                        value={slotDrafts[config.MaCauHinh]}
                        onChange={(event) =>
                          setSlotDrafts((current) => ({
                            ...current,
                            [config.MaCauHinh]: event.target.value,
                          }))
                        }
                      />
                    </td>
                    <td>
                      <span className={`status-pill ${config.TrangThai === 'active' ? 'active' : 'muted'}`}>
                        {config.TrangThai === 'active' ? 'Đang hiện' : 'Đang ẩn'}
                      </span>
                    </td>
                    <td>
                      <div className="admin-actions-row">
                        <button
                          type="button"
                          className="admin-secondary-button"
                          onClick={() => handleSaveSlot(config.MaCauHinh)}
                        >
                          Lưu Slot
                        </button>
                        <button
                          type="button"
                          className={
                            config.TrangThai === 'active'
                              ? 'admin-danger-button'
                              : 'admin-success-button'
                          }
                          onClick={() => handleToggleBranchService(config.MaCauHinh)}
                        >
                          {config.TrangThai === 'active' ? 'Ẩn' : 'Hiện'}
                        </button>
                        <button
                          type="button"
                          className="admin-delete-button"
                          onClick={() => handleDeleteBranchService(config.MaCauHinh)}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredBranchServices.length === 0 && (
                <tr>
                  <td colSpan="7">Không có cấu hình dịch vụ phù hợp với bộ lọc hiện tại.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )

  const renderSchedules = () => (
    <div className="admin-stack">
      <section className="admin-card">
        <h2>Xếp lịch trực hàng loạt</h2>
        <p>Chọn bác sĩ, chi nhánh, khoảng ngày và ma trận Thứ/Ca để sinh lịch trực tự động.</p>

        <form className="admin-schedule-form" onSubmit={handleBulkAssignSchedule}>
          <div className="admin-form-grid">
            <label>
              Bác sĩ
              <select
                className="admin-input"
                value={bulkScheduleForm.MaBacSi}
                onChange={(event) => handleBulkScheduleFormChange('MaBacSi', event.target.value)}
              >
                {doctors.map((doctor) => (
                  <option key={doctor.MaNhanSu} value={doctor.MaNhanSu}>
                    {doctor.MaNhanSu} - {doctor.HoTen}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Chi nhánh
              <select
                className="admin-input"
                value={bulkScheduleForm.MaChiNhanh}
                onChange={(event) => handleBulkScheduleFormChange('MaChiNhanh', event.target.value)}
              >
                {branches.map((branch) => (
                  <option key={branch.MaChiNhanh} value={branch.MaChiNhanh}>
                    {branch.TenChiNhanh}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Từ ngày
              <input
                className="admin-input"
                type="date"
                value={bulkScheduleForm.TuNgay}
                onChange={(event) => handleBulkScheduleFormChange('TuNgay', event.target.value)}
                required
              />
            </label>
            <label>
              Đến ngày
              <input
                className="admin-input"
                type="date"
                value={bulkScheduleForm.DenNgay}
                onChange={(event) => handleBulkScheduleFormChange('DenNgay', event.target.value)}
                required
              />
            </label>
          </div>

          <div className="schedule-matrix-wrap">
            <div className="schedule-matrix">
              <div className="schedule-matrix-cell header">Ca / Thứ</div>
              {[2, 3, 4, 5, 6, 7, 1].map((weekday) => (
                <div className="schedule-matrix-cell header" key={weekday}>
                  {weekday === 1 ? 'Chủ Nhật' : `Thứ ${weekday}`}
                </div>
              ))}
              {[1, 2, 3, 4].map((shift) => (
                <div className="schedule-matrix-row" key={shift}>
                  <div className="schedule-matrix-cell shift-label">Ca {shift}</div>
                  {[2, 3, 4, 5, 6, 7, 1].map((weekday) => {
                    const key = getScheduleSelectionKey(weekday, shift)
                    return (
                      <label className="schedule-checkbox-cell" key={key}>
                        <input
                          type="checkbox"
                          checked={Boolean(bulkScheduleForm.selections[key])}
                          onChange={() => handleToggleScheduleSelection(weekday, shift)}
                        />
                      </label>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          <button type="submit" className="admin-primary-button">
            Xếp lịch hàng loạt
          </button>
        </form>
      </section>

      <section className="admin-card">
        <h2>Danh sách lịch trực</h2>
        {adminScheduleLoading && <p className="admin-muted-text">Đang tải lịch trực từ database...</p>}
        {adminScheduleError && <p className="auth-catalog-error">{adminScheduleError}</p>}
        <div className="admin-filter-row">
          <label>
            Từ ngày
            <input
              className="admin-input"
              type="date"
              value={scheduleFilters.TuNgay}
              onChange={(event) => handleScheduleFilterChange('TuNgay', event.target.value)}
            />
          </label>
          <label>
            Đến ngày
            <input
              className="admin-input"
              type="date"
              value={scheduleFilters.DenNgay}
              onChange={(event) => handleScheduleFilterChange('DenNgay', event.target.value)}
            />
          </label>
          <label>
            Lọc theo Bác sĩ
            <select
              className="admin-input"
              value={scheduleFilters.MaBacSi}
              onChange={(event) => handleScheduleFilterChange('MaBacSi', event.target.value)}
            >
              <option value="all">Tất cả bác sĩ</option>
              {doctors.map((doctor) => (
                <option key={doctor.MaNhanSu} value={doctor.MaNhanSu}>
                  {doctor.MaNhanSu} - {doctor.HoTen}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Bác sĩ</th>
                <th>Chi nhánh</th>
                <th>Ngày</th>
                <th>Ca trực</th>
                <th>Số lịch hẹn đang có</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredDoctorSchedules.map((schedule) => {
                const appointmentCount = getAppointmentCountForSchedule(schedule)
                const isCancelled = schedule.TrangThai === 'Đã hủy'
                return (
                  <tr key={schedule.id ? `schedule-${schedule.id}` : `${schedule.MaLichTruc}-${schedule.MaBacSi}-${schedule.MaChiNhanh}-${schedule.NgayTruc}-${schedule.CaTruc}`}>
                    <td>{getDoctorName(schedule.MaBacSi)}</td>
                    <td>{getBranchName(schedule.MaChiNhanh)}</td>
                    <td>{schedule.NgayTruc}</td>
                    <td>Ca {schedule.CaTruc}</td>
                    <td>{appointmentCount}</td>
                    <td>
                      <span className={`status-pill ${isCancelled ? 'danger' : 'active'}`}>
                        {isCancelled ? 'Đã hủy' : 'Đang hoạt động'}
                      </span>
                    </td>
                    <td>
                      <div className="admin-actions-row">
                        <button
                          type="button"
                          className="admin-secondary-button"
                          onClick={() => handleOpenDoctorTransfer(schedule)}
                          disabled={isCancelled}
                        >
                          🔄 Đổi bác sĩ
                        </button>
                        <button
                          type="button"
                          className="admin-danger-button"
                          onClick={() => handleCancelSchedule(schedule)}
                          disabled={isCancelled}
                        >
                          {isCancelled ? 'Đã hủy' : 'Hủy ca trực'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredDoctorSchedules.length === 0 && (
                <tr>
                  <td colSpan="7">Không có lịch trực phù hợp với bộ lọc hiện tại.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {doctorTransferModal.show && (
        <div className="admin-modal-overlay">
          <section className="admin-transfer-modal">
            <button
              type="button"
              className="admin-modal-close"
              onClick={handleCloseDoctorTransfer}
              aria-label="Đóng modal điều chuyển bác sĩ"
            >
              ×
            </button>
            <span className="admin-section-kicker">Điều chuyển nhân sự</span>
            <h2>Điều chuyển nhân sự ca trực</h2>
            <div className="transfer-summary-grid">
              <div>
                <span>Ngày trực</span>
                <strong>{doctorTransferModal.schedule?.NgayTruc}</strong>
              </div>
              <div>
                <span>Ca trực</span>
                <strong>Ca {doctorTransferModal.schedule?.CaTruc}</strong>
              </div>
              <div>
                <span>Chi nhánh</span>
                <strong>{getBranchName(doctorTransferModal.schedule?.MaChiNhanh)}</strong>
              </div>
              <div>
                <span>Bác sĩ cũ</span>
                <strong>{getDoctorName(doctorTransferModal.schedule?.MaBacSi)}</strong>
              </div>
            </div>
            <label className="transfer-select-field">
              Chọn Bác sĩ mới
              <select
                className="admin-input"
                value={doctorTransferModal.nextDoctorId}
                onChange={(event) =>
                  setDoctorTransferModal((current) => ({
                    ...current,
                    nextDoctorId: event.target.value,
                  }))
                }
              >
                {getTransferDoctorOptions(doctorTransferModal.schedule).map((doctor) => (
                  <option key={doctor.MaNhanSu} value={doctor.MaNhanSu}>
                    {doctor.MaNhanSu} - {doctor.HoTen} ({doctor.ChuyenKhoa})
                  </option>
                ))}
              </select>
            </label>
            <div className="transfer-modal-actions">
              <button type="button" className="admin-primary-button" onClick={handleConfirmDoctorTransfer}>
                Xác nhận đổi
              </button>
              <button type="button" className="admin-secondary-button" onClick={handleCloseDoctorTransfer}>
                Hủy bỏ
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )

  const renderReports = () => (
    <div className="admin-stack">
      <section className="admin-card monthly-report-header">
        <div>
          <span className="admin-section-kicker">Monthly Analytical Report</span>
          <h2>Báo cáo tài chính và vận hành theo tháng</h2>
          <p>{getReportMonthRangeLabel(reportMonth)}</p>
          {adminReportLoading && <p>Đang tải báo cáo từ cơ sở dữ liệu...</p>}
          {adminReportError && <p className="auth-catalog-error">{adminReportError}</p>}
        </div>
        <label className="month-picker-field">
          Chọn tháng báo cáo
          <input
            className="admin-input"
            type="month"
            value={reportMonth}
            onChange={(event) => setReportMonth(event.target.value || '2026-06')}
          />
        </label>
      </section>

      <div className="finance-kpi-grid">
        <div className="finance-kpi-card revenue">
          <DollarSign size={24} />
          <span>Tổng Doanh thu Tháng</span>
          <strong>{formatMoney(displayReportData.totalNetRevenue)}</strong>
          <small>Chỉ tính dịch vụ phát sinh trong tháng đã chọn</small>
        </div>
        <div className="finance-kpi-card insurance">
          <ClipboardList size={24} />
          <span>Tổng BHYT Chi Trả</span>
          <strong>{formatMoney(displayReportData.totalInsuranceAmount)}</strong>
          <small>Phần bảo hiểm hỗ trợ bệnh nhân trong tháng</small>
        </div>
        <div className="finance-kpi-card success">
          <Activity size={24} />
          <span>Tổng Lượt Khám</span>
          <strong>{displayReportData.completedAppointmentCount}</strong>
          <small>Trạng thái Hoàn thành hoặc Đã khám trong tháng</small>
        </div>
        <div className="finance-kpi-card danger">
          <Users size={24} />
          <span>Tỷ lệ hủy hẹn trong tháng</span>
          <strong>{displayReportData.cancellationRate}%</strong>
          <small>Đối chiếu trên lịch hẹn phát sinh cùng tháng</small>
        </div>
      </div>

      <section className="admin-card">
        <h2>Hiệu suất Chi nhánh theo tháng</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Chi nhánh</th>
                <th>Tổng lượt khám thành công</th>
                <th>Doanh thu thực thu</th>
                <th>Tiền bảo hiểm chi trả</th>
              </tr>
            </thead>
            <tbody>
              {displayReportData.branchRows.map((row) => (
                <tr key={row.maChiNhanh}>
                  <td>{row.tenChiNhanh}</td>
                  <td>{row.completedCount}</td>
                  <td>{formatMoney(row.netRevenue)}</td>
                  <td>{formatMoney(row.insuranceAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card">
        <h2>Bảng xếp hạng Bác sĩ Xuất sắc trong tháng</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Thứ hạng</th>
                <th>Bác sĩ</th>
                <th>Chuyên khoa</th>
                <th>Số ca đã khám</th>
              </tr>
            </thead>
            <tbody>
              {displayReportData.doctorRows.map((item, index) => (
                <tr key={item.key}>
                  <td>#{index + 1}</td>
                  <td>{item.hoTen}</td>
                  <td>{item.chuyenKhoa}</td>
                  <td>{item.count}</td>
                </tr>
              ))}
              {displayReportData.doctorRows.length === 0 && (
                <tr>
                  <td colSpan="4">Chưa có bác sĩ nào phát sinh lượt khám hoàn thành trong tháng này.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card">
        <h2>Danh mục Dịch vụ đóng góp theo tháng</h2>
        <div className="ranking-grid monthly-service-grid">
          <div className="ranking-panel wide">
            <table className="ranking-table">
              <thead>
                <tr>
                  <th>Loại dịch vụ</th>
                  <th>Dịch vụ</th>
                  <th>Lượt sử dụng</th>
                  <th>Tổng tiền</th>
                </tr>
              </thead>
              <tbody>
                {displayReportData.serviceContributionRows.map((item) => (
                  <tr key={item.key}>
                    <td>{item.loaiDichVu}</td>
                    <td>{item.tenDichVu}</td>
                    <td>{item.count}</td>
                    <td>{formatMoney(item.value)}</td>
                  </tr>
                ))}
                {displayReportData.serviceContributionRows.length === 0 && (
                  <tr>
                    <td colSpan="4">Chưa có dịch vụ nào phát sinh doanh thu trong tháng này.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )

  const renderContent = () => {
    if (activeMenu === 'staff') return renderStaffManagement()
    if (activeMenu === 'services') return renderServiceConfig()
    if (activeMenu === 'schedules') return renderSchedules()
    return renderReports()
  }

  const navItems = [
    { key: 'staff', label: 'Quản lý Nhân sự & Bệnh nhân', icon: Users },
    { key: 'services', label: 'Cấu hình Dịch vụ Chi nhánh', icon: Building2 },
    { key: 'schedules', label: 'Quản lý Lịch trực', icon: Calendar },
    { key: 'reports', label: 'Báo cáo Thống kê', icon: Activity },
  ]

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <img src={medicalLogoImage} alt="Medicare" />
          <div>
            <strong>Medicare</strong>
            <span>Admin Dashboard</span>
          </div>
        </div>

        <nav className="admin-nav">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                type="button"
                className={`admin-nav-button ${activeMenu === item.key ? 'active' : ''}`}
                onClick={() => setActiveMenu(item.key)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user-box">
            <Stethoscope size={18} />
            <div>
              <strong>{user?.name || 'Quản trị viên'}</strong>
              <span>Toàn quyền hệ thống</span>
            </div>
          </div>
          <button type="button" className="admin-logout-button" onClick={onLogout}>
            <LogOut size={18} />
            Đăng xuất
          </button>
        </div>
      </aside>

      <section className="admin-content">
        <header className="admin-topbar">
          <div>
            <span className="admin-kicker">Medicare</span>
            <h1>{navItems.find((item) => item.key === activeMenu)?.label}</h1>
          </div>
          {feedback && <p className="admin-feedback">{feedback}</p>}
        </header>

        {renderContent()}
      </section>
    </main>
  )
}
