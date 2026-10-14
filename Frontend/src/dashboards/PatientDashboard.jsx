import { Fragment, useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import medicalLogoImage from '../assets/medical-logo-cutout.png'
import { EMPTY_CATALOG_DATA } from '../shared/catalog.js'
import { NotificationBell } from '../shared/Widgets.jsx'
import { bookAndPay, bookTreatment, getPatientAppointments, getPatientNotifications } from '../api/appointment.js'
import { getPatientMedicalHistory } from '../api/clinical.js'
import TablePagination from './TablePagination.jsx'
import { getPageRows } from './tablePagination.js'

export default function PatientDashboard({
  user,
  onLogout,
  onChangePassword,
  onUpdateUser,
  showNotification,
  notifications = [],
  addPatientNotifications,
  onMarkNotificationsRead,
  catalogData = EMPTY_CATALOG_DATA,
}) {
  const [activeMenu, setActiveMenu] = useState('booking')
  const [serviceSearch, setServiceSearch] = useState('')
  const [bookingMethod, setBookingMethod] = useState('time')
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
  const [branchServices] = useState(() =>
    ['CN_CG', 'CN_HBT'].flatMap((maChiNhanh) =>
      services.map((service) => ({
        MaCauHinh: `${maChiNhanh === 'CN_CG' ? 'CH_CG' : 'CH_HBT'}_${service.MaDichVu}`,
        MaChiNhanh: maChiNhanh,
        MaDichVu: service.MaDichVu,
        SlotGioiHan: 15,
      })),
    ),
  )
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
	  const initialPatientProfile = {
	    MaBenhAn: user?.MaBenhAn || 'BN001',
	    HoTen: user?.HoTen || user?.name || 'Trần Quang Hải',
	    NgaySinh: user?.NgaySinh || '1995-04-12',
	    GioiTinh: user?.GioiTinh || 'Nam',
	    SDT: user?.SDT || '0901234567',
	    DiaChi: user?.DiaChi || 'Cầu Giấy, Hà Nội',
	    CCCD: user?.CCCD || user?.id || '001095012345',
	    MaSoBHYT: user?.MaSoBHYT || 'DN4010123456789',
	    KyTuDauBHYT: user?.KyTuDauBHYT || 'DN',
	  }
	  const [patient, setPatient] = useState(initialPatientProfile)
	  const [, setPatientDirectory] = useState([initialPatientProfile])
  const patientNotifications = notifications.filter(
    (notification) =>
      notification.MaBenhAn === patient.MaBenhAn ||
      notification.MaBenhNhan === patient.MaBenhAn,
  )
	  const [bookings, setBookings] = useState([
    {
      MaLichHen: 'LH_001',
      MaBenhAn: 'BN001',
      MaCauHinh: 'CH_CG_DV_KHAM_NOI',
      MaDichVu: 'DV_KHAM_NOI',
      MaChiNhanh: 'CN_CG',
      NgayKham: '2026-06-01',
      CaKham: 1,
      MaBacSi: 'BS001',
      PaymentToken: 'PAY_MOCK_100001',
      TrangThai: 'Hoàn thành',
    },
	    {
	      MaLichHen: 'LH_003',
	      MaBenhAn: 'BN001',
      MaCauHinh: 'CH_CG_DV_KHAM_NOI',
      MaDichVu: 'DV_KHAM_NOI',
      MaChiNhanh: 'CN_CG',
      NgayKham: '2026-06-01',
      CaKham: 4,
      MaBacSi: 'BS004',
      PaymentToken: 'PAY_MOCK_100002',
	      TrangThai: 'Chờ khám',
	    },
	    {
	      MaLichHen: 'LH_004',
	      MaBenhAn: 'BN001',
	      MaCauHinh: 'CH_CG_DV_KHAM_TIEU_HOA',
	      MaDichVu: 'DV_KHAM_TIEU_HOA',
	      MaChiNhanh: 'CN_CG',
	      NgayKham: '2026-05-18',
	      CaKham: 2,
	      MaBacSi: 'BS005',
	      PaymentToken: 'PAY_MOCK_100004',
	      TrangThai: 'Hoàn thành',
	    },
	    {
	      MaLichHen: 'LH_005',
	      MaBenhAn: 'BN001',
	      MaCauHinh: 'CH_HBT_DV_KHAM_TMH',
	      MaDichVu: 'DV_KHAM_TMH',
	      MaChiNhanh: 'CN_HBT',
	      NgayKham: '2026-04-22',
	      CaKham: 1,
	      MaBacSi: 'BS015',
	      PaymentToken: 'PAY_MOCK_100005',
	      TrangThai: 'Hoàn thành',
	    },
	    {
	      MaLichHen: 'LH_006',
	      MaBenhAn: 'BN001',
	      MaCauHinh: 'CH_CG_DV_KHAM_RANG',
	      MaDichVu: 'DV_KHAM_RANG',
	      MaChiNhanh: 'CN_CG',
	      NgayKham: '2026-03-30',
	      CaKham: 3,
	      MaBacSi: 'BS006',
	      PaymentToken: 'PAY_MOCK_100006',
	      TrangThai: 'Hoàn thành',
	    },
	  ])
	  const [diseases] = useState([
		    { MaBenh: 'K29', TenBenh: 'Viêm dạ dày và tá tràng' },
		    { MaBenh: 'J30', TenBenh: 'Viêm mũi dị ứng' },
		    { MaBenh: 'K02', TenBenh: 'Sâu răng' },
		    { MaBenh: 'K21', TenBenh: 'Trào ngược dạ dày thực quản' },
		    { MaBenh: 'J01', TenBenh: 'Viêm xoang cấp' },
		    { MaBenh: 'K05', TenBenh: 'Viêm nướu và bệnh nha chu' },
		  ])
	  const [visitRecords, setVisitRecords] = useState([
	    {
	      MaLuotKham: 'LK_001',
	      MaLichHen: 'LH_001',
	      TrieuChung: 'Đau rát vùng thượng vị theo chu kỳ, đầy hơi sau ăn, buồn nôn nhẹ vào buổi sáng.',
		      LoiDan: 'Ăn uống đúng giờ, kiêng đồ chua cay, hạn chế cà phê, tái khám sau 14 ngày nếu còn đau.',
		      MaBenh: 'K29',
		    },
		    {
		      MaLuotKham: 'LK_002',
		      MaLichHen: 'LH_004',
		      TrieuChung: 'Ợ nóng sau ăn, đau âm ỉ vùng thượng vị, cảm giác nghẹn nhẹ khi nằm sau bữa tối.',
		      LoiDan: 'Không nằm ngay sau ăn, chia nhỏ bữa, theo dõi triệu chứng ợ nóng và tái khám sau 3 tuần.',
		      MaBenh: 'K21',
		    },
		    {
		      MaLuotKham: 'LK_003',
		      MaLichHen: 'LH_005',
		      TrieuChung: 'Nghẹt mũi kéo dài, đau vùng trán, chảy dịch mũi vàng xanh, giảm ngửi.',
		      LoiDan: 'Rửa mũi bằng nước muối sinh lý, tránh khói bụi, quay lại nếu sốt hoặc đau tăng.',
		      MaBenh: 'J01',
		    },
		    {
		      MaLuotKham: 'LK_004',
		      MaLichHen: 'LH_006',
		      TrieuChung: 'Chảy máu chân răng khi đánh răng, ê buốt răng hàm dưới, mảng bám nhiều.',
		      LoiDan: 'Vệ sinh răng miệng đúng cách, dùng chỉ nha khoa, tái khám nha chu sau 1 tháng.',
		      MaBenh: 'K05',
		    },
		  ])
	  const [medicines] = useState([
		    { MaThuoc: 'TH001', TenThuoc: 'Omeprazole 20mg', DonViTinh: 'Viên' },
		    { MaThuoc: 'TH002', TenThuoc: 'Phosphalugel', DonViTinh: 'Gói' },
		    { MaThuoc: 'TH003', TenThuoc: 'Domperidone 10mg', DonViTinh: 'Viên' },
		    { MaThuoc: 'TH004', TenThuoc: 'Esomeprazole 40mg', DonViTinh: 'Viên' },
		    { MaThuoc: 'TH005', TenThuoc: 'Loratadine 10mg', DonViTinh: 'Viên' },
		    { MaThuoc: 'TH006', TenThuoc: 'Nước muối xịt mũi', DonViTinh: 'Chai' },
		    { MaThuoc: 'TH007', TenThuoc: 'Chlorhexidine súc miệng', DonViTinh: 'Chai' },
		  ])
	  const [prescriptionDetails, setPrescriptionDetails] = useState([
		    { MaDonThuoc: 'DT001', MaLuotKham: 'LK_001', MaThuoc: 'TH001', SoLuong: 14, LieuDung: 'Uống 1 viên trước ăn sáng 30 phút trong 14 ngày.' },
		    { MaDonThuoc: 'DT002', MaLuotKham: 'LK_001', MaThuoc: 'TH002', SoLuong: 10, LieuDung: 'Uống 1 gói khi đau hoặc nóng rát dạ dày, tối đa 3 gói/ngày.' },
		    { MaDonThuoc: 'DT003', MaLuotKham: 'LK_001', MaThuoc: 'TH003', SoLuong: 10, LieuDung: 'Uống 1 viên trước bữa ăn khi buồn nôn hoặc đầy hơi.' },
		    { MaDonThuoc: 'DT004', MaLuotKham: 'LK_002', MaThuoc: 'TH004', SoLuong: 21, LieuDung: 'Uống 1 viên trước ăn sáng 30 phút trong 21 ngày.' },
		    { MaDonThuoc: 'DT005', MaLuotKham: 'LK_002', MaThuoc: 'TH002', SoLuong: 12, LieuDung: 'Uống 1 gói khi ợ nóng hoặc đau thượng vị.' },
		    { MaDonThuoc: 'DT006', MaLuotKham: 'LK_003', MaThuoc: 'TH005', SoLuong: 10, LieuDung: 'Uống 1 viên mỗi tối trong 10 ngày.' },
		    { MaDonThuoc: 'DT007', MaLuotKham: 'LK_003', MaThuoc: 'TH006', SoLuong: 1, LieuDung: 'Xịt mỗi bên mũi 2 lần, ngày 3 lần.' },
		    { MaDonThuoc: 'DT008', MaLuotKham: 'LK_004', MaThuoc: 'TH007', SoLuong: 1, LieuDung: 'Súc miệng 15ml sau đánh răng, ngày 2 lần trong 7 ngày.' },
		  ])
	  const [labDetails, setLabDetails] = useState([
	    {
	      MaChiTietXN: 'CTXN_001',
	      MaLuotKham: 'LK_001',
	      MaDichVu: 'XN_MAU',
	      KetQuaXetNghiem: 'Bạch cầu trong giới hạn bình thường, Hemoglobin 145 g/L.',
	      MaXNV: 'XNV001',
	      GiaCuoi: 50000,
	      PaymentToken: 'PAY_MOCK_XN001',
	      TrangThaiXetNghiem: 'Đã có kết quả',
	    },
	    {
	      MaChiTietXN: 'CTXN_002',
	      MaLuotKham: 'LK_001',
	      MaDichVu: 'SA_O_BUNG',
	      KetQuaXetNghiem: '',
	      MaXNV: '',
	      GiaCuoi: 60000,
	      PaymentToken: 'PAY_MOCK_XN002',
		      TrangThaiXetNghiem: 'Chưa thực hiện',
		    },
		    {
		      MaChiTietXN: 'CTXN_003',
		      MaLuotKham: 'LK_002',
		      MaDichVu: 'XN_SINH_HOA',
		      KetQuaXetNghiem: 'Men gan AST/ALT trong giới hạn, chức năng thận bình thường.',
		      MaXNV: 'XNV002',
		      GiaCuoi: 70000,
		      PaymentToken: 'PAY_MOCK_XN003',
		      TrangThaiXetNghiem: 'Đã có kết quả',
		    },
		    {
		      MaChiTietXN: 'CTXN_004',
		      MaLuotKham: 'LK_003',
		      MaDichVu: 'XN_MAU',
		      KetQuaXetNghiem: 'Bạch cầu tăng nhẹ, gợi ý tình trạng viêm cấp.',
		      MaXNV: 'XNV001',
		      GiaCuoi: 50000,
		      PaymentToken: 'PAY_MOCK_XN004',
		      TrangThaiXetNghiem: 'Đã có kết quả',
		    },
		    {
		      MaChiTietXN: 'CTXN_005',
		      MaLuotKham: 'LK_004',
		      MaDichVu: 'XN_DUONG_HUYET',
		      KetQuaXetNghiem: '',
		      MaXNV: '',
		      GiaCuoi: 16000,
		      PaymentToken: 'PAY_MOCK_XN005',
		      TrangThaiXetNghiem: 'Chưa thực hiện',
		    },
		  ])
	  const [labTechnicians] = useState([
	    { MaXNV: 'XNV001', HoTen: 'Trần Văn Cường' },
	    { MaXNV: 'XNV002', HoTen: 'Vũ Hồng Ngọc' },
	  ])
	  const [treatmentSchedules, setTreatmentSchedules] = useState([
    {
      MaLichTrinh: 'LTDT_001',
      MaLuotKham: 'LK_001',
      MaDichVu: 'DT_RANG_TUY',
      BuoiSo: 1,
      NgayThucHien: '2026-06-02',
      CaKham: 3,
      TrangThai: 'Hoàn thành',
    },
    {
      MaLichTrinh: 'LTDT_002',
      MaLuotKham: 'LK_001',
      MaDichVu: 'DT_RANG_TUY',
      BuoiSo: 2,
      NgayThucHien: '',
      CaKham: '',
      TrangThai: 'Chưa đặt lịch',
    },
	    {
	      MaLichTrinh: 'LTDT_003',
	      MaLuotKham: 'LK_001',
      MaDichVu: 'DT_RANG_TUY',
      BuoiSo: 3,
      NgayThucHien: '',
	      CaKham: '',
	      TrangThai: 'Chưa đặt lịch',
	    },
	    {
	      MaLichTrinh: 'LTDT_004',
	      MaLuotKham: 'LK_002',
	      MaDichVu: 'DT_TRUYEN_DICH',
	      BuoiSo: 1,
	      NgayThucHien: '2026-05-20',
	      CaKham: 2,
	      TrangThai: 'Hoàn thành',
	    },
	    {
	      MaLichTrinh: 'LTDT_005',
	      MaLuotKham: 'LK_002',
	      MaDichVu: 'DT_TRUYEN_DICH',
	      BuoiSo: 2,
	      NgayThucHien: '2026-05-23',
	      CaKham: 1,
	      TrangThai: 'Đã đặt lịch',
	    },
	    {
	      MaLichTrinh: 'LTDT_006',
	      MaLuotKham: 'LK_003',
	      MaDichVu: 'DT_KHIDUNG',
	      BuoiSo: 1,
	      NgayThucHien: '2026-04-24',
	      CaKham: 3,
	      TrangThai: 'Hoàn thành',
	    },
	    {
	      MaLichTrinh: 'LTDT_007',
	      MaLuotKham: 'LK_003',
	      MaDichVu: 'DT_KHIDUNG',
	      BuoiSo: 2,
	      NgayThucHien: '',
	      CaKham: '',
	      TrangThai: 'Chưa đặt lịch',
	    },
	    {
	      MaLichTrinh: 'LTDT_008',
	      MaLuotKham: 'LK_004',
	      MaDichVu: 'DT_HAN_RANG',
	      BuoiSo: 1,
	      NgayThucHien: '2026-04-01',
	      CaKham: 4,
	      TrangThai: 'Hoàn thành',
	    },
	    {
	      MaLichTrinh: 'LTDT_009',
	      MaLuotKham: 'LK_004',
	      MaDichVu: 'DT_HAN_RANG',
	      BuoiSo: 2,
	      NgayThucHien: '',
	      CaKham: '',
	      TrangThai: 'Chưa đặt lịch',
	    },
	  ])
  const [bookingForm, setBookingForm] = useState({
    MaChiNhanh: 'CN_CG',
    MaDichVu: 'DV_KHAM_NOI',
    NgayKham: '2026-06-05',
    CaKham: '1',
    MaBacSi: 'BS001',
  })
	  const [treatmentDrafts, setTreatmentDrafts] = useState({})
	  const [activeTreatmentId, setActiveTreatmentId] = useState('')
	  const [selectedVisitId, setSelectedVisitId] = useState('LK_001')
	  const [paymentModal, setPaymentModal] = useState(null)
	  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false)
	  const [appointmentsLoading, setAppointmentsLoading] = useState(false)
	  const [appointmentsError, setAppointmentsError] = useState('')
	  const [medicalHistoryLoading, setMedicalHistoryLoading] = useState(false)
	  const [medicalHistoryError, setMedicalHistoryError] = useState('')
	  const [appointmentSearch, setAppointmentSearch] = useState('')
	  const [appointmentPage, setAppointmentPage] = useState(0)
	  const [medicalHistoryPage, setMedicalHistoryPage] = useState(0)
	  const [isEditingContact, setIsEditingContact] = useState(false)
	  const [contactForm, setContactForm] = useState({
	    SDT: initialPatientProfile.SDT,
	    DiaChi: initialPatientProfile.DiaChi,
	  })
	  const [showPasswordForm, setShowPasswordForm] = useState(false)
	  const [passwordForm, setPasswordForm] = useState({
	    currentPassword: '',
	    newPassword: '',
	    confirmPassword: '',
	  })

  const bhytCategories = [
    { KyTuDauBHYT: 'TE', DoiTuongChinhSach: 'Trẻ em dưới 6 tuổi', TyLeHuong: 1 },
    { KyTuDauBHYT: 'HT', DoiTuongChinhSach: 'Cán bộ Hưu trí', TyLeHuong: 0.95 },
    { KyTuDauBHYT: 'DN', DoiTuongChinhSach: 'Người lao động doanh nghiệp', TyLeHuong: 0.8 },
  ]

  const effectiveBranches = catalogData?.branches || []
  const effectiveServices = catalogData?.services || []
  const effectiveDiseases = catalogData?.diseases?.length ? catalogData.diseases : diseases
  const effectiveMedicines = catalogData?.medicines?.length ? catalogData.medicines : medicines
  const effectiveBhytCategories = catalogData?.bhyt?.length ? catalogData.bhyt : bhytCategories
  const normalizedCatalogSchedules = (catalogData?.doctorSchedules || []).map((schedule) => ({
    ...schedule,
    TrangThai: schedule.TrangThai || 'Đang hoạt động',
  }))
  const effectiveDoctorSchedules = normalizedCatalogSchedules
  const allKnownServices = effectiveServices
  const allKnownBranches = effectiveBranches
  const derivedDoctors = Object.values(
    effectiveDoctorSchedules.reduce((doctorMap, schedule) => {
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
  const effectiveStaffList = derivedDoctors
  const effectiveBranchServices = (catalogData?.branchServices || []).map((config) => {
    const branch = effectiveBranches.find((item) => item.MaChiNhanh === config.MaChiNhanh)
    const service = effectiveServices.find((item) => item.MaDichVu === config.MaDichVu)
    return {
        MaCauHinh: config.MaCauHinh,
        MaChiNhanh: config.MaChiNhanh,
        MaDichVu: config.MaDichVu,
        SlotGioiHan: Number(config.SlotGioiHan ?? 0),
        TrangThai: config.TrangThai,
        TenChiNhanh: branch?.TenChiNhanh || '',
        TenDichVu: service?.TenDichVu || '',
        ChuyenKhoa: service?.ChuyenKhoa || '',
        LoaiDichVu: service?.LoaiDichVu || '',
        GiaGoc: Number(service?.GiaGoc ?? 0),
    }
  })
  const allKnownBranchServices = effectiveBranchServices
  const allKnownDoctorSchedules = effectiveDoctorSchedules

  const normalizeAppointmentRow = (appointment) => ({
    MaLichHen: appointment.MaLichHen,
    MaBenhAn: appointment.MaBenhAn || patient.MaBenhAn,
    MaCauHinh: appointment.MaCauHinh || '',
    MaDichVu: appointment.MaDichVu || '',
    TenDichVu: appointment.TenDichVu || '',
    MaChiNhanh: appointment.MaChiNhanh || '',
    TenChiNhanh: appointment.TenChiNhanh || '',
    NgayKham: appointment.NgayKham || '',
    CaKham: appointment.CaKham || '',
    STT: appointment.STT || appointment.STT_HangDoi || '',
    MaBacSi: appointment.MaBacSi || '',
    TenBacSi: appointment.TenBacSi || '',
    PaymentToken: appointment.PaymentToken || '',
    GiaCuoi: appointment.GiaCuoi || 0,
    TrangThai: appointment.TrangThai || 'Chờ khám',
  })

  const loadPatientAppointments = async () => {
    if (!patient.MaBenhAn) return

    setAppointmentsLoading(true)
    setAppointmentsError('')

    try {
      const response = await getPatientAppointments(patient.MaBenhAn)
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể tải lịch hẹn của bệnh nhân.')
      }

      if (Array.isArray(result.data)) {
        setBookings(result.data.map(normalizeAppointmentRow))
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải lịch hẹn của bệnh nhân.'
      setAppointmentsError(message)
      console.warn('PATIENT_APPOINTMENTS_LOAD_FAILED', message)
    } finally {
      setAppointmentsLoading(false)
    }
  }

  const loadPatientNotifications = async () => {
    if (!patient.MaBenhAn) return

    try {
      const response = await getPatientNotifications(patient.MaBenhAn)
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể tải thông báo bệnh nhân.')
      }

      addPatientNotifications?.(
        (result.data || []).map((item) => ({
          MaThongBao: item.MaThongBao,
          MaBenhAn: patient.MaBenhAn,
          MaLichHen: item.MaLichHen,
          NoiDung: item.NoiDung,
          ThoiGianGui: item.ThoiGianGui,
          read: false,
        })),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải thông báo bệnh nhân.'
      console.warn('PATIENT_NOTIFICATIONS_LOAD_FAILED', message)
    }
  }

  const normalizeMedicalHistory = (rows) => {
    const historyRows = Array.isArray(rows) ? rows : []
    const nextVisits = historyRows.map((visit) => ({
      MaLuotKham: visit.MaLuotKham,
      MaLichHen: visit.MaLichHen,
      TrieuChung: visit.TrieuChung || '',
      LoiDan: visit.LoiDan || '',
      MaBenh: visit.MaBenh || '',
      TenBenh: visit.TenBenh || '',
    }))
    const nextPrescriptions = historyRows.flatMap((visit) =>
      (visit.DonThuoc || []).map((item) => ({
        MaDonThuoc: item.MaDonThuoc,
        MaLuotKham: visit.MaLuotKham,
        MaThuoc: item.MaThuoc,
        TenThuoc: item.TenThuoc,
        DonViTinh: item.DonViTinh,
        SoLuong: item.SoLuong,
        LieuDung: item.LieuDung,
      })),
    )
    const nextLabs = historyRows.flatMap((visit) =>
      (visit.XetNghiem || []).map((item) => ({
        MaChiTietXN: item.MaChiTietXN,
        MaLuotKham: visit.MaLuotKham,
        MaDichVu: item.MaDichVu,
        TenDichVu: item.TenDichVu,
        KetQuaXetNghiem: item.KetQuaXetNghiem || '',
        MaXNV: item.MaXNV || '',
        GiaCuoi: item.GiaCuoi || 0,
        PaymentToken: item.PaymentToken || '',
        TrangThaiXetNghiem: item.TrangThaiXetNghiem || 'Chưa thực hiện',
      })),
    )
	    const nextTreatments = historyRows.flatMap((visit) =>
	      (visit.DieuTri || []).map((item) => ({
	        MaLichTrinh: item.MaLichTrinh,
	        MaLichHen: item.MaLichHen || '',
	        MaLuotKham: visit.MaLuotKham,
	        MaDichVu: item.MaDichVu,
        TenDichVu: item.TenDichVu,
        BuoiSo: item.BuoiSo,
        NgayThucHien: item.NgayThucHien || '',
        CaKham: item.CaKham || '',
        TrangThai: item.TrangThai || 'Chưa đặt lịch',
      })),
    )
    const completedBookings = historyRows.map((visit) => ({
      MaLichHen: visit.MaLichHen,
      MaBenhAn: patient.MaBenhAn,
      MaCauHinh: '',
      MaDichVu: visit.MaDichVuKham || '',
      TenDichVu: visit.TenDichVuKham || '',
      MaChiNhanh: visit.MaChiNhanh || '',
      TenChiNhanh: visit.TenChiNhanh || '',
      NgayKham: visit.NgayKham || '',
      CaKham: visit.CaKham || '',
      MaBacSi: visit.MaBacSi || '',
      TenBacSi: visit.TenBacSi || '',
      SDTBacSi: visit.SDTBacSi || '',
      PaymentToken: '',
      GiaCuoi: 0,
      TrangThai: 'Hoàn thành',
    }))

    return {
      nextVisits,
      nextPrescriptions,
      nextLabs,
      nextTreatments,
      completedBookings,
    }
  }

  const loadMedicalHistory = async () => {
    if (!patient.MaBenhAn) return

    setMedicalHistoryLoading(true)
    setMedicalHistoryError('')

    try {
      const response = await getPatientMedicalHistory(patient.MaBenhAn)
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể tải sổ khám bệnh.')
      }

      const normalized = normalizeMedicalHistory(result.data)
      setVisitRecords(normalized.nextVisits)
      setPrescriptionDetails(normalized.nextPrescriptions)
      setLabDetails(normalized.nextLabs)
      setTreatmentSchedules(normalized.nextTreatments)
      setBookings((current) => {
        const historyIds = new Set(normalized.completedBookings.map((booking) => booking.MaLichHen))
        return [
          ...normalized.completedBookings,
          ...current.filter((booking) => !historyIds.has(booking.MaLichHen)),
        ]
      })
      setSelectedVisitId(normalized.nextVisits[0]?.MaLuotKham || '')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải sổ khám bệnh.'
      setMedicalHistoryError(message)
      console.warn('MEDICAL_HISTORY_LOAD_FAILED', message)
    } finally {
      setMedicalHistoryLoading(false)
    }
  }

  const patientBookingStartDate = '2026-06-05'
  const patientBookingEndDate = '2026-07-01'
  const weekDayHeaders = [
    { label: 'Thứ Hai', shortLabel: 'T2', dayIndex: 1 },
    { label: 'Thứ Ba', shortLabel: 'T3', dayIndex: 2 },
    { label: 'Thứ Tư', shortLabel: 'T4', dayIndex: 3 },
    { label: 'Thứ Năm', shortLabel: 'T5', dayIndex: 4 },
    { label: 'Thứ Sáu', shortLabel: 'T6', dayIndex: 5 },
    { label: 'Thứ Bảy', shortLabel: 'T7', dayIndex: 6 },
    { label: 'Chủ Nhật', shortLabel: 'CN', dayIndex: 0 },
  ]

  const clinicalServices = effectiveServices.filter((service) => service.LoaiDichVu === 'Khám lâm sàng')
  const filteredClinicalServices = clinicalServices.filter((service) => {
    const keyword = serviceSearch.trim().toLowerCase()
    if (!keyword) return true
    return [service.MaDichVu, service.TenDichVu, service.ChuyenKhoa]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })
  const groupedClinicalServices = Object.values(
    filteredClinicalServices.reduce((groups, service) => {
      const department = service.ChuyenKhoa || 'Chưa phân khoa'
      const currentGroup = groups[department] || { department, services: [] }
      currentGroup.services.push(service)
      groups[department] = currentGroup
      return groups
    }, {}),
  ).sort((first, second) => first.department.localeCompare(second.department, 'vi'))

  const getService = (maDichVu) =>
    allKnownServices.find((service) => service.MaDichVu === maDichVu) || {
      MaDichVu: maDichVu,
      TenDichVu: maDichVu,
      ChuyenKhoa: '',
      LoaiDichVu: '',
      GiaGoc: 0,
    }

  const getBranchName = (maChiNhanh) =>
    allKnownBranches.find((branch) => branch.MaChiNhanh === maChiNhanh)?.TenChiNhanh || maChiNhanh

  const getBranchConfig = (maChiNhanh, maDichVu) =>
    allKnownBranchServices.find((config) => config.MaChiNhanh === maChiNhanh && config.MaDichVu === maDichVu)

	  const getDoctorInfo = (maBacSi) =>
	    effectiveStaffList.find((doctor) => doctor.MaBacSi === maBacSi) || {
	      MaBacSi: maBacSi,
	      HoTen: maBacSi,
	      ChuyenKhoa: '',
	      SDT: 'Chưa cập nhật',
	    }

  const getDoctorInfoFromBooking = (booking) => {
    const catalogDoctor = getDoctorInfo(booking?.MaBacSi || '')
    return {
      ...catalogDoctor,
      HoTen: booking?.TenBacSi || catalogDoctor.HoTen,
      SDT: booking?.SDTBacSi || catalogDoctor.SDT,
    }
  }

	  const formatDoctorFullInfo = (doctor) =>
	    `Bác sĩ ${doctor.HoTen} - Khoa: ${doctor.ChuyenKhoa || 'Chưa cập nhật'} (SĐT: ${doctor.SDT || 'Chưa cập nhật'})`

  const getDiseaseInfo = (maBenh, tenBenh = '') =>
    effectiveDiseases.find((disease) => disease.MaBenh === maBenh) || {
      MaBenh: maBenh || 'Chưa xác định',
      TenBenh: tenBenh || 'Chưa xác định',
    }

  const getMedicineInfo = (maThuoc) =>
    effectiveMedicines.find((medicine) => medicine.MaThuoc === maThuoc) || {
      MaThuoc: maThuoc,
      TenThuoc: maThuoc,
      DonViTinh: '',
    }

	  const getLabTechnicianName = (maXNV) =>
	    labTechnicians.find((technician) => technician.MaXNV === maXNV)?.HoTen || 'Chưa phân công'

  const getBhytRate = () =>
    effectiveBhytCategories.find((category) => category.KyTuDauBHYT === patient.KyTuDauBHYT)?.TyLeHuong || 0

  const formatMoney = (value) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)

  const toDateKey = (date) => date.toISOString().slice(0, 10)

  const parseDateKey = (dateKey) => new Date(`${dateKey}T00:00:00`)

  const addDays = (date, amount) => {
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + amount)
    return nextDate
  }

  const getWeekdayLabel = (dateKey) => {
    const day = parseDateKey(dateKey).getDay()
    return weekDayHeaders.find((header) => header.dayIndex === day)?.label || dateKey
  }

  const buildBookingWeeks = () => {
    const startDate = parseDateKey(patientBookingStartDate)
    const endDate = parseDateKey(patientBookingEndDate)
    const startWeekDay = startDate.getDay() || 7
    let weekStart = addDays(startDate, -(startWeekDay - 1))
    const weeks = []

    while (weekStart <= endDate) {
      const weekDates = weekDayHeaders.map((_, dayOffset) => {
        const date = addDays(weekStart, dayOffset)
        return {
          dateKey: toDateKey(date),
          isInBookingRange: date >= startDate && date <= endDate,
        }
      })

      weeks.push({
        label: `Tuần ${weeks.length + 1}`,
        range: `${weekDates[0].dateKey} - ${weekDates[6].dateKey}`,
        dates: weekDates,
      })

      weekStart = addDays(weekStart, 7)
    }

    return weeks
  }

  const buildInvoice = ({ maDichVu, maChiNhanh, ngayKham, caKham }) => {
    const service = getService(maDichVu)
    const tyLeHuong = getBhytRate()
    const bhytAmount = Math.round(service.GiaGoc * tyLeHuong)
    const finalAmount = Math.max(0, service.GiaGoc - bhytAmount)

    return {
      maDichVu,
      tenDichVu: service.TenDichVu,
      maChiNhanh,
      tenChiNhanh: getBranchName(maChiNhanh),
      ngayKham,
      caKham,
      giaGoc: service.GiaGoc,
      bhytAmount,
      finalAmount,
    }
  }

  const normalizeScheduleParams = (params) => ({
    maChiNhanh: params.maChiNhanh ?? params.MaChiNhanh ?? '',
    maDichVu: params.maDichVu ?? params.MaDichVu ?? '',
    ngayKham: params.ngayKham ?? params.NgayKham ?? '',
    caKham: params.caKham ?? params.CaKham ?? '',
  })

  const getBookedCountForSlot = (params) => {
    const { maChiNhanh, ngayKham, caKham } = normalizeScheduleParams(params)
    return bookings.filter(
      (booking) =>
        booking.MaChiNhanh === maChiNhanh &&
        booking.NgayKham === ngayKham &&
        Number(booking.CaKham) === Number(caKham) &&
        !String(booking.TrangThai || '').includes('Đã hủy'),
    ).length
  }

  const getSlotLimit = (params) => {
    const { maChiNhanh, maDichVu } = normalizeScheduleParams(params)
    const config = getBranchConfig(maChiNhanh, maDichVu)
    return config ? Number(config.SlotGioiHan || 15) : 0
  }

  const getRemainingSlots = (params) =>
    Math.max(0, getSlotLimit(params) - getBookedCountForSlot(params))

  const isScheduleActive = (schedule) => !schedule.TrangThai || schedule.TrangThai === 'Đang hoạt động'

  const getAvailableShifts = (params) => {
    const { maChiNhanh, maDichVu, ngayKham } = normalizeScheduleParams(params)

    const result = [1, 2, 3, 4].filter((shift) => {
      const hasWorkingDoctor = allKnownDoctorSchedules.some(
        (schedule) =>
          schedule.MaChiNhanh === maChiNhanh &&
          schedule.NgayTruc === ngayKham &&
          Number(schedule.CaTruc) === Number(shift) &&
          isScheduleActive(schedule),
      )
      const bookedCount = getBookedCountForSlot({
        maChiNhanh,
        maDichVu,
        ngayKham,
        caKham: shift,
      })
      const slotLimit = getSlotLimit({ maChiNhanh, maDichVu })

      return hasWorkingDoctor && bookedCount < slotLimit
    })

    return result
  }

  const getShiftTimeLabel = (shift) => {
    const shiftTimes = {
      1: 'Ca 1 (07:30 - 10:15)',
      2: 'Ca 2 (10:15 - 12:00)',
      3: 'Ca 3 (13:30 - 16:30)',
      4: 'Ca 4 (16:30 - 19:30)',
    }

    return shiftTimes[Number(shift)] || `Ca ${shift}`
  }

  const getAvailableDoctorsForShift = (params, options = {}) => {
    const { maChiNhanh, maDichVu, ngayKham, caKham } = normalizeScheduleParams(params)
    const service = getService(maDichVu)
    const shouldMatchSpecialty = options.matchSpecialty !== false
    const selectedDoctorIds = new Set()

    return allKnownDoctorSchedules
      .filter((schedule) => {
        const doctor = getDoctorInfo(schedule.MaBacSi)
        const isMatched =
          schedule.MaChiNhanh === maChiNhanh &&
          schedule.NgayTruc === ngayKham &&
          Number(schedule.CaTruc) === Number(caKham) &&
          isScheduleActive(schedule) &&
          (!shouldMatchSpecialty || doctor.ChuyenKhoa === service.ChuyenKhoa) &&
          !selectedDoctorIds.has(schedule.MaBacSi)

        if (isMatched) selectedDoctorIds.add(schedule.MaBacSi)
        return isMatched
      })
      .map((schedule) => {
        const doctor = getDoctorInfo(schedule.MaBacSi)
	        return {
	          MaBacSi: schedule.MaBacSi,
	          TenBacSi: doctor.HoTen,
	          ChuyenKhoa: doctor.ChuyenKhoa,
	          SDT: doctor.SDT,
	        }
      })
      .sort((first, second) => first.TenBacSi.localeCompare(second.TenBacSi, 'vi'))
  }

  const getDoctorBookingOptions = (params) => {
    const { maChiNhanh, maDichVu } = normalizeScheduleParams(params)
    const service = getService(maDichVu)

    return effectiveStaffList
      .filter((doctor) => {
        if (doctor.ChuyenKhoa !== service.ChuyenKhoa) return false

        return allKnownDoctorSchedules.some(
          (schedule) =>
            schedule.MaBacSi === doctor.MaBacSi &&
            schedule.MaChiNhanh === maChiNhanh &&
            isScheduleActive(schedule) &&
            schedule.NgayTruc >= patientBookingStartDate &&
            schedule.NgayTruc <= patientBookingEndDate &&
            getRemainingSlots({
              maChiNhanh,
              maDichVu,
              ngayKham: schedule.NgayTruc,
              caKham: schedule.CaTruc,
            }) > 0,
        )
      })
      .sort((first, second) => first.HoTen.localeCompare(second.HoTen, 'vi'))
      .map((doctor) => ({
        MaBacSi: doctor.MaBacSi,
        TenBacSi: doctor.HoTen,
        ChuyenKhoa: doctor.ChuyenKhoa,
        SDT: doctor.SDT,
      }))
  }

  const getDoctorScheduleForGridCell = ({ dateKey, shift }) =>
    allKnownDoctorSchedules.find(
      (schedule) =>
        schedule.MaBacSi === bookingForm.MaBacSi &&
        schedule.MaChiNhanh === bookingForm.MaChiNhanh &&
        schedule.NgayTruc === dateKey &&
        Number(schedule.CaTruc) === Number(shift) &&
        isScheduleActive(schedule) &&
        getRemainingSlots({
          maChiNhanh: bookingForm.MaChiNhanh,
          maDichVu: bookingForm.MaDichVu,
          ngayKham: dateKey,
          caKham: shift,
        }) > 0,
    )

  const getDefaultSlotSelection = (params) => {
    const { maChiNhanh, maDichVu, ngayKham } = normalizeScheduleParams(params)
    const shifts = getAvailableShifts({ maChiNhanh, maDichVu, ngayKham })
    const shiftWithDoctor = shifts.find((shift) =>
      getAvailableDoctorsForShift({
        maChiNhanh,
        maDichVu,
        ngayKham,
        caKham: shift,
      }).length > 0,
    )
    const selectedShift = shiftWithDoctor || shifts[0]
    const doctorsForShift = selectedShift
      ? getAvailableDoctorsForShift({
          maChiNhanh,
          maDichVu,
          ngayKham,
          caKham: selectedShift,
        })
      : []

    return {
      CaKham: selectedShift ? String(selectedShift) : '',
      MaBacSi: doctorsForShift[0]?.MaBacSi || '',
    }
  }

  useEffect(() => {
    if (!effectiveBranches.length || !clinicalServices.length) return

    setBookingForm((current) => {
      const next = { ...current }

      if (!effectiveBranches.some((branch) => branch.MaChiNhanh === next.MaChiNhanh)) {
        next.MaChiNhanh = effectiveBranches[0]?.MaChiNhanh || ''
      }

      if (!clinicalServices.some((service) => service.MaDichVu === next.MaDichVu)) {
        next.MaDichVu = clinicalServices[0]?.MaDichVu || ''
      }

      if (!next.NgayKham || next.NgayKham < patientBookingStartDate || next.NgayKham > patientBookingEndDate) {
        next.NgayKham = patientBookingStartDate
      }

      if (bookingMethod === 'time') {
        const shifts = getAvailableShifts(next)
        const hasSelectedShift = shifts.some((shift) => Number(shift) === Number(next.CaKham))
        const doctorsForCurrentShift = hasSelectedShift
          ? getAvailableDoctorsForShift(
              {
                maChiNhanh: next.MaChiNhanh,
                maDichVu: next.MaDichVu,
                ngayKham: next.NgayKham,
                caKham: next.CaKham,
              },
            )
          : []

        if (
          !hasSelectedShift ||
          !doctorsForCurrentShift.some((doctor) => doctor.MaBacSi === next.MaBacSi)
        ) {
          const nextSelection = getDefaultSlotSelection(next)
          next.CaKham = nextSelection.CaKham
          next.MaBacSi = nextSelection.MaBacSi
        }
      } else {
        const doctorOptions = getDoctorBookingOptions(next)
        if (!doctorOptions.some((doctor) => doctor.MaBacSi === next.MaBacSi)) {
          next.MaBacSi = doctorOptions[0]?.MaBacSi || ''
          next.NgayKham = ''
          next.CaKham = ''
        }
      }

      const hasChanged = Object.keys(next).some((key) => next[key] !== current[key])
      return hasChanged ? next : current
    })
  }, [catalogData, bookingMethod])

  useEffect(() => {
    loadPatientAppointments()
    loadMedicalHistory()
    loadPatientNotifications()
  }, [patient.MaBenhAn])

  const bookingAvailableShifts = getAvailableShifts(bookingForm)
  const bookingAvailableDoctors = getAvailableDoctorsForShift({
    maChiNhanh: bookingForm.MaChiNhanh,
    maDichVu: bookingForm.MaDichVu,
    ngayKham: bookingForm.NgayKham,
    caKham: bookingForm.CaKham,
  })
  const doctorBookingOptions = getDoctorBookingOptions(bookingForm)
  const patientBookingWeeks = buildBookingWeeks()
  const filteredBookings = bookings.filter((booking) => {
    const keyword = appointmentSearch.trim().toLowerCase()
    if (!keyword) return true

    return [
      booking.MaLichHen,
      getService(booking.MaDichVu).TenDichVu,
      getBranchName(booking.MaChiNhanh),
      booking.NgayKham,
      booking.TrangThai,
    ]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })

  const handleBookingFormChange = (field, value) => {
    setBookingForm((current) => {
      const next = { ...current, [field]: value }
      if (bookingMethod === 'time' && field !== 'CaKham') {
        const nextSelection = getDefaultSlotSelection(next)
        next.CaKham = nextSelection.CaKham
        next.MaBacSi = nextSelection.MaBacSi
      } else if (bookingMethod === 'doctor') {
        const doctorOptions = getDoctorBookingOptions(next)
        const shouldResetDoctor =
          field === 'MaDichVu' ||
          field === 'MaChiNhanh' ||
          !doctorOptions.some((doctor) => doctor.MaBacSi === next.MaBacSi)

        if (shouldResetDoctor) {
          next.MaBacSi = doctorOptions[0]?.MaBacSi || ''
          next.NgayKham = ''
          next.CaKham = ''
        }
      }
      return next
    })
  }

  const handleBookingShiftChange = (value) => {
    const doctorsForShift = getAvailableDoctorsForShift({
      maChiNhanh: bookingForm.MaChiNhanh,
      maDichVu: bookingForm.MaDichVu,
      ngayKham: bookingForm.NgayKham,
      caKham: value,
    })
    setBookingForm((current) => ({
      ...current,
      CaKham: value,
      MaBacSi: doctorsForShift[0]?.MaBacSi || '',
    }))
  }

	  const handleBookingDoctorChange = (value) => {
	    setBookingForm((current) => ({
	      ...current,
	      MaBacSi: value,
	      ...(bookingMethod === 'doctor' ? { NgayKham: '', CaKham: '' } : {}),
	    }))
	  }

  const handleBookingMethodChange = (method) => {
    setBookingMethod(method)
    setBookingForm((current) => {
      if (method === 'time') {
        const next = {
          ...current,
          NgayKham: current.NgayKham || patientBookingStartDate,
        }
        const nextSelection = getDefaultSlotSelection(next)
        return {
          ...next,
          CaKham: nextSelection.CaKham,
          MaBacSi: nextSelection.MaBacSi,
        }
      }

      const next = {
        ...current,
        NgayKham: '',
        CaKham: '',
      }
      const doctorOptions = getDoctorBookingOptions(next)
      return {
        ...next,
        MaBacSi: doctorOptions[0]?.MaBacSi || '',
      }
    })
  }

  const handleDoctorScheduleCellClick = (schedule) => {
    setBookingForm((current) => ({
      ...current,
      NgayKham: schedule.NgayTruc,
      CaKham: String(schedule.CaTruc),
      MaBacSi: schedule.MaBacSi,
    }))

    window.requestAnimationFrame(() => {
      document.getElementById('patient-booking-invoice')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })
  }

	  const handleStartEditContact = () => {
	    setContactForm({
	      SDT: patient.SDT,
	      DiaChi: patient.DiaChi,
	    })
	    setIsEditingContact(true)
	  }

	  const handleCancelEditContact = () => {
	    setContactForm({
	      SDT: patient.SDT,
	      DiaChi: patient.DiaChi,
	    })
	    setIsEditingContact(false)
	  }

	  const handleSaveContact = () => {
	    const nextPatient = {
	      ...patient,
	      SDT: contactForm.SDT.trim(),
	      DiaChi: contactForm.DiaChi.trim(),
	    }

	    setPatient(nextPatient)
	    setPatientDirectory((current) =>
	      current.map((item) => (item.MaBenhAn === nextPatient.MaBenhAn ? nextPatient : item)),
	    )
	    onUpdateUser?.({
	      SDT: nextPatient.SDT,
	      DiaChi: nextPatient.DiaChi,
	      id: nextPatient.SDT,
	    })
	    setIsEditingContact(false)
	    showNotification?.('Cập nhật thông tin liên hệ thành công!')
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

	  const handleConfirmPasswordChange = async () => {
	    if (passwordForm.newPassword.length < 6 || passwordForm.newPassword !== passwordForm.confirmPassword) {
	      showNotification?.('Mật khẩu mới cần ít nhất 6 ký tự và phải khớp xác nhận.', 'error')
	      return
	    }
	    try {
	      await onChangePassword(passwordForm.currentPassword, passwordForm.newPassword)
	      handleCancelPasswordChange()
	    } catch (error) {
	      showNotification?.(error instanceof Error ? error.message : 'Không đổi được mật khẩu.', 'error')
	    }
	  }

	  const handleTreatmentDraftChange = (maLichTrinh, field, value) => {
    setTreatmentDrafts((current) => {
      const currentDraft = current[maLichTrinh] || {
        MaChiNhanh: effectiveBranches[0]?.MaChiNhanh || '',
        NgayKham: '2026-06-05',
        CaKham: '',
        MaBacSi: '',
      }
      const nextDraft = { ...currentDraft, [field]: value }
      const treatment = treatmentSchedules.find((item) => item.MaLichTrinh === maLichTrinh)

      if (field !== 'CaKham' && treatment) {
        const nextSelection = getDefaultSlotSelection({
          maChiNhanh: nextDraft.MaChiNhanh,
          maDichVu: treatment.MaDichVu,
          ngayKham: nextDraft.NgayKham,
        })
        nextDraft.CaKham = nextSelection.CaKham
        nextDraft.MaBacSi = nextSelection.MaBacSi
      }

      return { ...current, [maLichTrinh]: nextDraft }
    })
  }

  const handleTreatmentShiftChange = (maLichTrinh, value) => {
    const currentDraft = treatmentDrafts[maLichTrinh]
    const treatment = treatmentSchedules.find((item) => item.MaLichTrinh === maLichTrinh)
    const doctorsForShift = treatment
      ? getAvailableDoctorsForShift({
	        maChiNhanh: currentDraft?.MaChiNhanh || effectiveBranches[0]?.MaChiNhanh || '',
          maDichVu: treatment.MaDichVu,
          ngayKham: currentDraft?.NgayKham || '2026-06-05',
          caKham: value,
        })
      : []

    setTreatmentDrafts((current) => ({
      ...current,
      [maLichTrinh]: {
        ...current[maLichTrinh],
        CaKham: value,
        MaBacSi: doctorsForShift[0]?.MaBacSi || '',
      },
    }))
  }

  const handleTreatmentDoctorChange = (maLichTrinh, value) => {
    setTreatmentDrafts((current) => ({
      ...current,
      [maLichTrinh]: {
        ...current[maLichTrinh],
        MaBacSi: value,
      },
    }))
  }

  const startTreatmentBooking = (treatment) => {
    const initialDraft = {
      MaChiNhanh: effectiveBranches[0]?.MaChiNhanh || '',
      NgayKham: '2026-06-05',
      CaKham: '',
      MaBacSi: '',
    }
    const initialSelection = getDefaultSlotSelection({
      maChiNhanh: initialDraft.MaChiNhanh,
      maDichVu: treatment.MaDichVu,
      ngayKham: initialDraft.NgayKham,
    })
    setTreatmentDrafts((current) => ({
      ...current,
      [treatment.MaLichTrinh]: {
        ...initialDraft,
        CaKham: initialSelection.CaKham,
        MaBacSi: initialSelection.MaBacSi,
      },
    }))
    setActiveTreatmentId(treatment.MaLichTrinh)
  }

  const openBookingPayment = () => {
    if (!bookingForm.CaKham || !bookingForm.MaBacSi) {
      showNotification?.('Hiện chưa có ca trống phù hợp. Vui lòng chọn ngày hoặc chi nhánh khác.', 'error')
      return
    }

    const config = getBranchConfig(bookingForm.MaChiNhanh, bookingForm.MaDichVu)
    if (!config) {
      showNotification?.('Dịch vụ này chưa được phân phối tại chi nhánh đã chọn.', 'error')
      return
    }

    setPaymentModal({
      type: 'new-booking',
      invoice: buildInvoice({
        maDichVu: bookingForm.MaDichVu,
        maChiNhanh: bookingForm.MaChiNhanh,
        ngayKham: bookingForm.NgayKham,
        caKham: Number(bookingForm.CaKham),
      }),
      payload: {
        ...bookingForm,
        MaCauHinh: config.MaCauHinh,
        CaKham: Number(bookingForm.CaKham),
        MaBacSi: bookingForm.MaBacSi,
      },
    })
  }

  const openTreatmentPayment = (treatment) => {
    const draft = treatmentDrafts[treatment.MaLichTrinh]
    if (!draft?.CaKham || !draft?.MaBacSi) {
      showNotification?.('Hiện chưa có ca điều trị trống phù hợp. Vui lòng chọn ngày hoặc chi nhánh khác.', 'error')
      return
    }

    const config = getBranchConfig(draft.MaChiNhanh, treatment.MaDichVu)
    if (!config) {
      showNotification?.('Dịch vụ điều trị này chưa được phân phối tại chi nhánh đã chọn.', 'error')
      return
    }

    setPaymentModal({
      type: 'treatment-booking',
      invoice: buildInvoice({
        maDichVu: treatment.MaDichVu,
        maChiNhanh: draft.MaChiNhanh,
        ngayKham: draft.NgayKham,
        caKham: Number(draft.CaKham),
      }),
      payload: {
        MaLichTrinh: treatment.MaLichTrinh,
        MaDichVu: treatment.MaDichVu,
        MaCauHinh: config.MaCauHinh,
        MaChiNhanh: draft.MaChiNhanh,
        NgayKham: draft.NgayKham,
        CaKham: Number(draft.CaKham),
        MaBacSi: draft.MaBacSi,
      },
    })
  }

  const confirmMockPayment = async () => {
    if (!paymentModal) return

	    if (paymentModal.type === 'new-booking') {
	      setIsConfirmingPayment(true)
	      try {
        const response = await bookAndPay({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ma_benh_an: patient.MaBenhAn,
            ma_cau_hinh: paymentModal.payload.MaCauHinh,
            ngay_kham: paymentModal.invoice.ngayKham,
            ca_kham: Number(paymentModal.invoice.caKham),
            ma_bac_si: paymentModal.payload.MaBacSi,
          }),
        })
        const result = await response.json()

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || 'Không thể tạo lịch hẹn.')
        }

        if (result.data) {
          setBookings((current) => {
            const nextBooking = normalizeAppointmentRow({
              ...result.data,
              MaDichVu: result.data.MaDichVu || paymentModal.invoice.maDichVu,
              MaChiNhanh: result.data.MaChiNhanh || paymentModal.invoice.maChiNhanh,
            })
            return [nextBooking, ...current.filter((booking) => booking.MaLichHen !== nextBooking.MaLichHen)]
          })
        }

        await loadPatientAppointments()
        setPaymentModal(null)
        showNotification?.('Thanh toán thành công! Lịch hẹn của bạn đã được lưu vào hệ thống.')
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không thể tạo lịch hẹn.'
        showNotification?.(message, 'error')
      } finally {
        setIsConfirmingPayment(false)
	      }
	      return
	    }

	    if (paymentModal.type === 'treatment-booking') {
	      setIsConfirmingPayment(true)
	      try {
	        const response = await bookTreatment({
	          method: 'POST',
	          headers: { 'Content-Type': 'application/json' },
	          body: JSON.stringify({
	            ma_lich_trinh: paymentModal.payload.MaLichTrinh,
	            ma_benh_an: patient.MaBenhAn,
	            ma_cau_hinh: paymentModal.payload.MaCauHinh,
	            ngay_thuc_hien: paymentModal.invoice.ngayKham,
	            ca_kham: Number(paymentModal.invoice.caKham),
	            ma_bac_si: paymentModal.payload.MaBacSi,
	          }),
	        })
	        const result = await response.json()

	        if (!response.ok || !result?.success) {
	          throw new Error(result?.message || 'Không thể đặt lịch điều trị.')
	        }

	        const appointment = result.data?.appointment
	        const treatment = result.data?.treatment

	        if (appointment) {
	          setBookings((current) => {
	            const nextBooking = normalizeAppointmentRow({
	              ...appointment,
	              MaDichVu: appointment.MaDichVu || paymentModal.invoice.maDichVu,
	              MaChiNhanh: appointment.MaChiNhanh || paymentModal.invoice.maChiNhanh,
	            })
	            return [nextBooking, ...current.filter((booking) => booking.MaLichHen !== nextBooking.MaLichHen)]
	          })
	        }

	        if (treatment) {
	          setTreatmentSchedules((current) =>
	            current.map((item) =>
	              item.MaLichTrinh === treatment.MaLichTrinh
	                ? {
	                    ...item,
	                    MaLichHen: treatment.MaLichHen || '',
	                    NgayThucHien: treatment.NgayThucHien || paymentModal.invoice.ngayKham,
	                    CaKham: treatment.CaKham || paymentModal.invoice.caKham,
	                    MaBacSi: paymentModal.payload.MaBacSi,
	                    TrangThai: treatment.TrangThai || 'Đã đặt lịch',
	                  }
	                : item,
	            ),
	          )
	        }

	        await loadPatientAppointments()
	        await loadMedicalHistory()
	        setActiveTreatmentId('')
	        setPaymentModal(null)
	        showNotification?.('Thanh toán thành công! Buổi điều trị đã được xác nhận.')
	      } catch (error) {
	        const message = error instanceof Error ? error.message : 'Không thể đặt lịch điều trị.'
	        showNotification?.(message, 'error')
	      } finally {
	        setIsConfirmingPayment(false)
	      }
	      return
	    }

	    const paymentToken = `PAY_MOCK_${Math.floor(100000 + Math.random() * 900000)}`
    const newBooking = {
      MaLichHen: `LH_${String(bookings.length + 1).padStart(3, '0')}`,
      MaBenhAn: patient.MaBenhAn,
      MaCauHinh: paymentModal.payload.MaCauHinh,
      MaDichVu: paymentModal.invoice.maDichVu,
      MaChiNhanh: paymentModal.invoice.maChiNhanh,
      NgayKham: paymentModal.invoice.ngayKham,
      CaKham: paymentModal.invoice.caKham,
      MaBacSi: paymentModal.payload.MaBacSi,
      PaymentToken: paymentToken,
      TrangThai: 'Đã xác nhận',
    }

    setBookings((current) => [...current, newBooking])

    if (paymentModal.type === 'treatment-booking') {
      setTreatmentSchedules((current) =>
        current.map((item) =>
          item.MaLichTrinh === paymentModal.payload.MaLichTrinh
	            ? {
	                ...item,
	                NgayThucHien: paymentModal.invoice.ngayKham,
	                CaKham: paymentModal.invoice.caKham,
	                MaBacSi: paymentModal.payload.MaBacSi,
	                TrangThai: 'Đã đặt lịch',
	              }
            : item,
        ),
      )
      setActiveTreatmentId('')
    }

    setPaymentModal(null)
    showNotification?.('Thanh toán thành công! Lịch hẹn của bạn đã được hệ thống xác nhận.')
  }

  const renderPaymentModal = () => {
    if (!paymentModal) return null

    return (
      <div className="payment-overlay">
        <div className="payment-modal">
          <div className="payment-modal-header">
            <div>
              <span>Cổng thanh toán QR</span>
              <h2>Xác nhận thanh toán</h2>
            </div>
            <button type="button" onClick={() => setPaymentModal(null)} disabled={isConfirmingPayment}>
              Đóng
            </button>
          </div>

          <div className="payment-invoice">
            <div>
              <span>Dịch vụ</span>
              <strong>{paymentModal.invoice.tenDichVu}</strong>
            </div>
            <div>
              <span>Chi nhánh</span>
              <strong>{paymentModal.invoice.tenChiNhanh}</strong>
            </div>
            <div>
              <span>Ngày/Ca khám</span>
              <strong>
                {paymentModal.invoice.ngayKham} - Ca {paymentModal.invoice.caKham}
              </strong>
            </div>
            <div>
              <span>Giá gốc</span>
              <strong>{formatMoney(paymentModal.invoice.giaGoc)}</strong>
            </div>
            <div>
              <span>BHYT giảm</span>
              <strong>{formatMoney(paymentModal.invoice.bhytAmount)}</strong>
            </div>
            <div>
              <span>Giá cuối thực trả</span>
              <strong>{formatMoney(paymentModal.invoice.finalAmount)}</strong>
            </div>
          </div>

          <div className="qr-box">
            <div className="qr-grid" />
            <span>QR chuyển khoản giả lập</span>
          </div>

          <button
            type="button"
            className="payment-confirm-button"
            onClick={confirmMockPayment}
            disabled={isConfirmingPayment}
          >
            Bấm vào đây để giả lập đã chuyển khoản thành công
          </button>
        </div>
      </div>
    )
  }

  const renderBooking = () => {
    const invoice = buildInvoice({
      maDichVu: bookingForm.MaDichVu,
      maChiNhanh: bookingForm.MaChiNhanh,
      ngayKham: bookingForm.NgayKham,
      caKham: Number(bookingForm.CaKham || 0),
	    })
	    const selectedDoctor = bookingForm.MaBacSi ? getDoctorInfo(bookingForm.MaBacSi) : null
	    const selectedBranchConfig = getBranchConfig(bookingForm.MaChiNhanh, bookingForm.MaDichVu)
	    const canStartPayment = Boolean(
	      bookingForm.MaDichVu &&
	        bookingForm.MaChiNhanh &&
	        bookingForm.NgayKham &&
	        bookingForm.CaKham &&
	        bookingForm.MaBacSi &&
	        selectedBranchConfig,
	    )

    const renderDoctorBookingGrid = () => {
      if (!bookingForm.MaBacSi) {
        return (
          <div className="patient-doctor-note">
            Chọn bác sĩ phù hợp để xem lưới lịch trực từ {patientBookingStartDate} đến {patientBookingEndDate}.
          </div>
        )
      }

      return (
        <div className="patient-doctor-week-stack">
          {patientBookingWeeks.map((week) => (
            <section key={week.range} className="patient-doctor-week-card">
              <header>
                <div>
                  <h3>{week.label}</h3>
                  <span>{week.range}</span>
                </div>
                <strong>{formatDoctorFullInfo(selectedDoctor)}</strong>
              </header>

              <div className="patient-booking-week-grid">
                <div className="patient-booking-week-cell header">Ca trực</div>
                {week.dates.map((date) => (
                  <div key={date.dateKey} className="patient-booking-week-cell header">
                    <strong>{getWeekdayLabel(date.dateKey)}</strong>
                    <span>{date.dateKey}</span>
                  </div>
                ))}

                {[1, 2, 3, 4].map((shift) => (
                  <Fragment key={`${week.range}-${shift}`}>
                    <div className="patient-booking-week-cell shift-label">{getShiftTimeLabel(shift)}</div>
                    {week.dates.map((date) => {
                      const schedule = date.isInBookingRange
                        ? getDoctorScheduleForGridCell({ dateKey: date.dateKey, shift })
                        : null
                      const remainingSlots = schedule
                        ? getRemainingSlots({
                            maChiNhanh: bookingForm.MaChiNhanh,
                            maDichVu: bookingForm.MaDichVu,
                            ngayKham: date.dateKey,
                            caKham: shift,
                          })
                        : 0
                      const isSelected =
                        bookingForm.NgayKham === date.dateKey &&
                        Number(bookingForm.CaKham) === Number(shift)

                      return (
                        <div key={`${date.dateKey}-${shift}`} className="patient-booking-week-cell">
                          {schedule ? (
                            <button
                              type="button"
                              className={`patient-booking-slot-button ${isSelected ? 'active' : ''}`}
                              onClick={() => handleDoctorScheduleCellClick(schedule)}
                            >
                              <strong>Ca {shift}</strong>
                              <span>{getWeekdayLabel(date.dateKey)}</span>
                              <em>Còn {remainingSlots} slot</em>
                            </button>
                          ) : (
                            <span className="patient-booking-slot-empty">-</span>
                          )}
                        </div>
                      )
                    })}
                  </Fragment>
                ))}
              </div>
            </section>
          ))}
        </div>
      )
    }

    return (
      <div className="patient-card">
        <h2>Đặt lịch khám mới</h2>
        <p>Chọn dịch vụ khám lâm sàng rồi đặt theo khung giờ mong muốn hoặc chọn thẳng bác sĩ yêu thích.</p>

        <div className="booking-method-tabs">
          <button
            type="button"
            className={`booking-method-tab ${bookingMethod === 'time' ? 'active' : ''}`}
            onClick={() => handleBookingMethodChange('time')}
          >
            <span>📅</span>
            <strong>Đặt lịch theo thời gian</strong>
            <em>Chọn ngày, ca khám rồi chọn bác sĩ đang trực</em>
          </button>
          <button
            type="button"
            className={`booking-method-tab ${bookingMethod === 'doctor' ? 'active' : ''}`}
            onClick={() => handleBookingMethodChange('doctor')}
          >
            <span>👨‍⚕️</span>
            <strong>Đặt lịch theo bác sĩ</strong>
            <em>Xem lưới lịch trực tương lai của bác sĩ</em>
          </button>
        </div>

        <div className="patient-service-picker">
          <div className="patient-service-picker-head">
            <div>
              <span>Dịch vụ khám lâm sàng</span>
              <strong>{getService(bookingForm.MaDichVu).TenDichVu}</strong>
            </div>
            <input
              type="search"
              value={serviceSearch}
              onChange={(event) => setServiceSearch(event.target.value)}
              placeholder="Tìm mã, tên dịch vụ hoặc chuyên khoa"
            />
          </div>
          <div className="patient-service-groups">
            {groupedClinicalServices.length === 0 && <div className="patient-empty-service">Không tìm thấy dịch vụ phù hợp</div>}
            {groupedClinicalServices.map((group) => (
              <section key={group.department} className="patient-service-group">
                <h3>Khoa {group.department}</h3>
                <div className="patient-service-list">
                  {group.services.map((service) => (
                    <button
                      type="button"
                      key={service.MaDichVu}
                      className={`patient-service-option ${bookingForm.MaDichVu === service.MaDichVu ? 'active' : ''}`}
                      onClick={() => handleBookingFormChange('MaDichVu', service.MaDichVu)}
                    >
                      <span>{service.MaDichVu}</span>
                      <strong>{service.TenDichVu}</strong>
                      <em>{formatMoney(service.GiaGoc)}</em>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        {bookingMethod === 'time' ? (
          <div className="patient-form-grid">
            <label>
              Chi nhánh
              <select
                value={bookingForm.MaChiNhanh}
                onChange={(event) => handleBookingFormChange('MaChiNhanh', event.target.value)}
              >
                {effectiveBranches.map((branch) => (
                  <option key={branch.MaChiNhanh} value={branch.MaChiNhanh}>
                    {branch.TenChiNhanh}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ngày khám
              <input
                type="date"
                value={bookingForm.NgayKham}
                onChange={(event) => handleBookingFormChange('NgayKham', event.target.value)}
              />
            </label>
            <label>
              Ca khám
              <select value={bookingForm.CaKham} onChange={(event) => handleBookingShiftChange(event.target.value)}>
                {bookingAvailableShifts.length === 0 && <option value="">Không có ca trống</option>}
                {bookingAvailableShifts.map((shift) => (
                  <option key={shift} value={shift}>
                    {getShiftTimeLabel(shift)} - còn{' '}
                    {getRemainingSlots({
                      maChiNhanh: bookingForm.MaChiNhanh,
                      maDichVu: bookingForm.MaDichVu,
                      ngayKham: bookingForm.NgayKham,
                      caKham: shift,
                    })}{' '}
                    slot
                  </option>
                ))}
              </select>
            </label>
            <label>
              Chọn Bác sĩ phụ trách
              <select
                value={bookingForm.MaBacSi}
                onChange={(event) => handleBookingDoctorChange(event.target.value)}
                disabled={bookingAvailableDoctors.length === 0}
              >
                {bookingAvailableDoctors.length === 0 && <option value="">Không có bác sĩ đang trực ca này</option>}
                {bookingAvailableDoctors.map((doctor) => (
                  <option key={doctor.MaBacSi} value={doctor.MaBacSi}>
                    {formatDoctorFullInfo({
                      HoTen: doctor.TenBacSi,
                      ChuyenKhoa: doctor.ChuyenKhoa,
                      SDT: doctor.SDT,
                    })}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <>
            <div className="patient-form-grid doctor-first-form">
              <label>
                Chi nhánh
                <select
                  value={bookingForm.MaChiNhanh}
                  onChange={(event) => handleBookingFormChange('MaChiNhanh', event.target.value)}
                >
                  {effectiveBranches.map((branch) => (
                    <option key={branch.MaChiNhanh} value={branch.MaChiNhanh}>
                      {branch.TenChiNhanh}
                    </option>
                  ))}
                </select>
              </label>
              <label className="doctor-first-select">
                Chọn Bác sĩ
                <select
                  value={bookingForm.MaBacSi}
                  onChange={(event) => handleBookingDoctorChange(event.target.value)}
                  disabled={doctorBookingOptions.length === 0}
                >
                  {doctorBookingOptions.length === 0 && <option value="">Chưa có bác sĩ phù hợp</option>}
                  {doctorBookingOptions.map((doctor) => (
                    <option key={doctor.MaBacSi} value={doctor.MaBacSi}>
                      {formatDoctorFullInfo({
                        HoTen: doctor.TenBacSi,
                        ChuyenKhoa: doctor.ChuyenKhoa,
                        SDT: doctor.SDT,
                      })}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="doctor-first-grid-panel">
              <div className="doctor-first-grid-head">
                <div>
                  <span>Lưới lịch trực tương lai</span>
                  <strong>
                    {selectedDoctor
                      ? `${selectedDoctor.HoTen} - ${selectedDoctor.ChuyenKhoa}`
                      : 'Chưa chọn bác sĩ'}
                  </strong>
                </div>
                <p>
                  Nhấn vào ô còn slot để chọn ngày và ca khám. Hệ thống hiển thị từ {patientBookingStartDate} đến{' '}
                  {patientBookingEndDate}.
                </p>
              </div>
              {renderDoctorBookingGrid()}
            </div>
          </>
        )}

        <div id="patient-booking-invoice" className="patient-invoice-preview">
          <strong>Xem trước hóa đơn</strong>
          {canStartPayment && selectedDoctor && (
            <span>
              Lịch chọn: {bookingForm.NgayKham} - {getShiftTimeLabel(bookingForm.CaKham)} - Bác sĩ{' '}
              {selectedDoctor.HoTen}
            </span>
          )}
	          <span>Giá gốc: {formatMoney(invoice.giaGoc)}</span>
	          <span>BHYT giảm: {formatMoney(invoice.bhytAmount)}</span>
	          <span>Giá cuối: {formatMoney(invoice.finalAmount)}</span>
	          {!selectedBranchConfig && (
	            <span className="auth-catalog-error">
	              Dịch vụ này chưa được cấu hình tại chi nhánh đã chọn.
	            </span>
	          )}
	        </div>

        <button
          type="button"
          className="patient-primary-button"
          onClick={openBookingPayment}
          disabled={!canStartPayment}
        >
          Tiến hành thanh toán
        </button>
      </div>
    )
  }

	  const renderMyBookings = () => (
	    <div className="patient-card">
	      <h2>Lịch hẹn của tôi</h2>
	      <div className="patient-appointment-toolbar">
	        <input
	          type="search"
	          value={appointmentSearch}
	          onChange={(event) => { setAppointmentSearch(event.target.value); setAppointmentPage(0) }}
	          placeholder="Tìm kiếm theo mã lịch hẹn, dịch vụ, chi nhánh, ngày, trạng thái..."
	        />
	        <span>{filteredBookings.length} lịch hẹn</span>
	      </div>
	      {appointmentsLoading && <p>Đang tải lịch hẹn từ hệ thống...</p>}
	      {appointmentsError && <p className="auth-catalog-error">{appointmentsError}</p>}
	      <div className="patient-table-wrap">
	        <table className="patient-table">
	          <thead>
	            <tr>
	              <th>Mã lịch hẹn</th>
	              <th>Dịch vụ</th>
	              <th>Chi nhánh</th>
	              <th>Bác sĩ phụ trách</th>
	              <th>Ngày</th>
	              <th>Ca</th>
	              <th>Trạng thái</th>
	              <th>PaymentToken</th>
	            </tr>
	          </thead>
	          <tbody>
	            {getPageRows(filteredBookings, appointmentPage).map((booking) => (
	              <tr key={booking.MaLichHen}>
	                <td>{booking.MaLichHen}</td>
	                <td>{getService(booking.MaDichVu).TenDichVu}</td>
	                <td>{getBranchName(booking.MaChiNhanh)}</td>
	                <td>{booking.MaBacSi ? getDoctorInfo(booking.MaBacSi).HoTen : 'Đang điều phối'}</td>
	                <td>{booking.NgayKham}</td>
	                <td>Ca {booking.CaKham}</td>
	                <td>{booking.TrangThai}</td>
	                <td>{booking.PaymentToken}</td>
	              </tr>
	            ))}
	            {filteredBookings.length === 0 && (
	              <tr>
	                <td colSpan="8" className="patient-empty-row">
	                  Không tìm thấy lịch hẹn phù hợp.
	                </td>
	              </tr>
	            )}
	          </tbody>
	        </table>
	      </div>
	      <TablePagination page={appointmentPage} total={filteredBookings.length} label="lịch hẹn" onPageChange={setAppointmentPage} />
	    </div>
  )

	  const renderTreatmentBookingControl = (treatment) => {
	    const draft = treatmentDrafts[treatment.MaLichTrinh] || {
	      MaChiNhanh: effectiveBranches[0]?.MaChiNhanh || '',
	      NgayKham: '2026-06-05',
	      CaKham: '',
	      MaBacSi: '',
    }
    const shifts = getAvailableShifts({
      maChiNhanh: draft.MaChiNhanh,
      maDichVu: treatment.MaDichVu,
      ngayKham: draft.NgayKham,
    })
    const treatmentDoctors = getAvailableDoctorsForShift({
      maChiNhanh: draft.MaChiNhanh,
      maDichVu: treatment.MaDichVu,
      ngayKham: draft.NgayKham,
      caKham: draft.CaKham,
    })
    const invoice = buildInvoice({
      maDichVu: treatment.MaDichVu,
      maChiNhanh: draft.MaChiNhanh,
      ngayKham: draft.NgayKham,
      caKham: Number(draft.CaKham || 0),
    })

    if (treatment.TrangThai !== 'Chưa đặt lịch') return null

    if (activeTreatmentId !== treatment.MaLichTrinh) {
      return (
        <button
          type="button"
          className="patient-secondary-button"
          onClick={() => startTreatmentBooking(treatment)}
        >
          Đặt lịch cho buổi này
        </button>
      )
    }

    return (
      <div className="treatment-inline-form">
        <select
          value={draft.MaChiNhanh}
          onChange={(event) => handleTreatmentDraftChange(treatment.MaLichTrinh, 'MaChiNhanh', event.target.value)}
        >
	          {effectiveBranches.map((branch) => (
	            <option key={branch.MaChiNhanh} value={branch.MaChiNhanh}>
	              {branch.TenChiNhanh}
	            </option>
          ))}
        </select>
        <input
          type="date"
          value={draft.NgayKham}
          onChange={(event) => handleTreatmentDraftChange(treatment.MaLichTrinh, 'NgayKham', event.target.value)}
        />
        <select
          value={draft.CaKham}
          onChange={(event) => handleTreatmentShiftChange(treatment.MaLichTrinh, event.target.value)}
        >
          {shifts.length === 0 && <option value="">Không có ca trống</option>}
          {shifts.map((shift) => (
            <option key={shift} value={shift}>
              {getShiftTimeLabel(shift)} - còn{' '}
              {getRemainingSlots({
                maChiNhanh: draft.MaChiNhanh,
                maDichVu: treatment.MaDichVu,
                ngayKham: draft.NgayKham,
                caKham: shift,
              })}{' '}
              slot
            </option>
          ))}
        </select>
        {treatmentDoctors.length > 1 ? (
          <select
            value={draft.MaBacSi}
            onChange={(event) => handleTreatmentDoctorChange(treatment.MaLichTrinh, event.target.value)}
          >
            {treatmentDoctors.map((doctor) => (
              <option key={doctor.MaBacSi} value={doctor.MaBacSi}>
                {doctor.TenBacSi} - {doctor.ChuyenKhoa}
              </option>
            ))}
          </select>
        ) : (
          <div className="patient-doctor-note compact">
            {treatmentDoctors[0]
              ? `Bác sĩ phụ trách: ${treatmentDoctors[0].TenBacSi}`
              : 'Ca này không có bác sĩ chuyên khoa phù hợp, vui lòng chọn ca khác'}
          </div>
        )}
        <div className="patient-invoice-preview compact">
          <span>Giá gốc: {formatMoney(invoice.giaGoc)}</span>
          <span>BHYT giảm: {formatMoney(invoice.bhytAmount)}</span>
          <strong>Giá cuối: {formatMoney(invoice.finalAmount)}</strong>
        </div>
        <button
          type="button"
          className="patient-primary-button"
          onClick={() => openTreatmentPayment(treatment)}
        >
          Tiến hành thanh toán
        </button>
      </div>
    )
  }

  const renderHealthRecordSection = () => {
    if (medicalHistoryLoading) {
      return (
        <section className="patient-card">
          <h2>Sổ khám bệnh</h2>
          <p>Đang tải sổ khám bệnh từ hệ thống...</p>
        </section>
      )
    }

    const completedVisits = visitRecords
      .map((visit) => ({
        ...visit,
        booking: bookings.find(
          (booking) =>
            booking.MaLichHen === visit.MaLichHen &&
            booking.MaBenhAn === patient.MaBenhAn &&
            booking.TrangThai === 'Hoàn thành',
        ),
      }))
      .filter((visit) => visit.booking)
      .sort((first, second) => new Date(second.booking.NgayKham) - new Date(first.booking.NgayKham))
    const selectedVisit = completedVisits.find((visit) => visit.MaLuotKham === selectedVisitId) || completedVisits[0]

    if (!selectedVisit) {
      return (
        <section className="patient-card">
          <h2>Sổ khám bệnh</h2>
          {medicalHistoryError && <p className="auth-catalog-error">{medicalHistoryError}</p>}
          <p>Chưa có lượt khám hoàn thành để hiển thị hồ sơ sức khỏe.</p>
        </section>
      )
    }

    const disease = getDiseaseInfo(selectedVisit.MaBenh, selectedVisit.TenBenh)
    const selectedDoctor = getDoctorInfoFromBooking(selectedVisit.booking)
    const selectedPrescriptions = prescriptionDetails.filter((item) => item.MaLuotKham === selectedVisit.MaLuotKham)
    const selectedLabs = labDetails.filter((item) => item.MaLuotKham === selectedVisit.MaLuotKham)
    const selectedTreatments = treatmentSchedules.filter((item) => item.MaLuotKham === selectedVisit.MaLuotKham)
    const treatmentGroups = Object.values(
      selectedTreatments.reduce((groups, item) => {
        const currentGroup = groups[item.MaDichVu] || {
          MaDichVu: item.MaDichVu,
          sessions: [],
        }
        currentGroup.sessions.push(item)
        groups[item.MaDichVu] = currentGroup
        return groups
      }, {}),
    )

    return (
      <section className="patient-card health-record-card">
        <div className="health-record-header">
          <div>
            <h2>Sổ khám bệnh</h2>
            <p>Hồ sơ sức khỏe cá nhân theo từng lượt khám đã hoàn thành.</p>
          </div>
          <span>{completedVisits.length} lượt khám</span>
        </div>

        <div className="health-record-layout">
          <aside className="health-timeline">
            {getPageRows(completedVisits, medicalHistoryPage).map((visit) => {
              const visitDisease = getDiseaseInfo(visit.MaBenh, visit.TenBenh)
              const visitDoctor = getDoctorInfoFromBooking(visit.booking)
              return (
                <button
                  type="button"
                  key={visit.MaLuotKham}
                  className={`health-timeline-card ${selectedVisit.MaLuotKham === visit.MaLuotKham ? 'active' : ''}`}
                  onClick={() => setSelectedVisitId(visit.MaLuotKham)}
                >
                  <span>{visit.booking.NgayKham}</span>
                  <strong>{visit.MaLuotKham}</strong>
                  <em>
                    BS: {visitDoctor.HoTen} ({visitDoctor.ChuyenKhoa || 'Chưa cập nhật'})
                  </em>
                  <small>{visitDisease.TenBenh}</small>
                </button>
              )
            })}
            <TablePagination page={medicalHistoryPage} total={completedVisits.length} label="lượt khám" onPageChange={(page) => {
              setMedicalHistoryPage(page)
              setSelectedVisitId(getPageRows(completedVisits, page)[0]?.MaLuotKham || '')
            }} />
          </aside>

          <div className="health-detail">
            <section className="health-detail-section">
              <div className="health-section-title">
                <span>Chẩn đoán lâm sàng</span>
                <strong>
                  {disease.MaBenh} - {disease.TenBenh}
                </strong>
              </div>
              <div className="clinical-grid">
                <div>
                  <span>Triệu chứng lâm sàng</span>
                  <p>{selectedVisit.TrieuChung}</p>
                </div>
                <div className="clinical-doctor-info">
                  <span>Bác sĩ chủ trị</span>
                  <p>
                    Bác sĩ chủ trị: Bác sĩ {selectedDoctor.HoTen} | Chuyên khoa:{' '}
                    {selectedDoctor.ChuyenKhoa || 'Chưa cập nhật'} | Số điện thoại liên hệ:{' '}
                    {selectedDoctor.SDT || 'Chưa cập nhật'}
                  </p>
                </div>
                <div className="clinical-advice">
                  <span>Lời dặn tái khám</span>
                  <p>{selectedVisit.LoiDan}</p>
                </div>
              </div>
            </section>

            <section className="health-detail-section">
              <div className="health-section-title">
                <span>Đơn thuốc được kê</span>
                <strong>{selectedPrescriptions.length} thuốc</strong>
              </div>
              <div className="patient-table-wrap">
                <table className="patient-table compact">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Tên thuốc</th>
                      <th>Số lượng</th>
                      <th>Đơn vị tính</th>
                      <th>Liều dùng & Cách dùng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPrescriptions.map((item, index) => {
                      const medicine = getMedicineInfo(item.MaThuoc)
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
              </div>
            </section>

            <section className="health-detail-section">
              <div className="health-section-title">
                <span>Nhật ký xét nghiệm cận lâm sàng</span>
                <strong>{selectedLabs.length} chỉ định</strong>
              </div>
              <div className="lab-card-grid">
                {selectedLabs.map((lab) => (
                  <article key={lab.MaChiTietXN} className="lab-result-card">
                    <div>
                      <strong>{getService(lab.MaDichVu).TenDichVu}</strong>
                      <span>{formatMoney(lab.GiaCuoi)}</span>
                    </div>
                    <span className={`lab-status ${lab.TrangThaiXetNghiem === 'Đã có kết quả' ? 'done' : 'pending'}`}>
                      {lab.TrangThaiXetNghiem}
                    </span>
                    {lab.TrangThaiXetNghiem === 'Đã có kết quả' && (
                      <p>
                        {lab.KetQuaXetNghiem}
                        <br />
                        Xét nghiệm viên: {getLabTechnicianName(lab.MaXNV)}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>

            <section className="health-detail-section">
              <div className="health-section-title">
                <span>Liệu trình điều trị chuyên sâu</span>
                <strong>{selectedTreatments.length} buổi</strong>
              </div>
              <div className="treatment-plan-list">
                {treatmentGroups.map((group) => {
                  const orderedSessions = [...group.sessions].sort((first, second) => first.BuoiSo - second.BuoiSo)
                  const completedCount = orderedSessions.filter((item) => item.TrangThai === 'Hoàn thành').length
                  const progressPercent = Math.round((completedCount / orderedSessions.length) * 100)

                  return (
                    <article key={group.MaDichVu} className="treatment-plan-card">
                      <div className="treatment-plan-head">
                        <div>
                          <strong>{getService(group.MaDichVu).TenDichVu}</strong>
                          <span>
                            Đã đi {completedCount} / {orderedSessions.length} buổi
                          </span>
                        </div>
                        <em>{progressPercent}%</em>
                      </div>
                      <div className="treatment-progress">
                        <span style={{ width: `${progressPercent}%` }} />
                      </div>
                      <div className="treatment-session-list">
                        {orderedSessions.map((session) => (
                          <div key={session.MaLichTrinh} className="treatment-session-row">
                            <div>
                              <strong>Buổi {session.BuoiSo}</strong>
                              <span>
                                {session.NgayThucHien || 'Chưa đặt'} {session.CaKham ? `- Ca ${session.CaKham}` : ''}
                              </span>
                            </div>
                            <span className={`treatment-status ${session.TrangThai === 'Hoàn thành' ? 'done' : session.TrangThai === 'Đã đặt lịch' ? 'booked' : 'pending'}`}>
                              {session.TrangThai}
                            </span>
                            {renderTreatmentBookingControl(session)}
                          </div>
                        ))}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          </div>
        </div>
      </section>
    )
  }

  const renderTreatment = () => (
    <div className="patient-stack">
	      <section className="patient-card patient-profile-card">
	        <div className="patient-profile-header">
	          <div>
	            <h2>Thông tin hành chính cá nhân</h2>
	            <p>Quản lý thông tin định danh và cập nhật kênh liên hệ đang sử dụng.</p>
	          </div>
	          <div className="patient-profile-actions">
	            {!isEditingContact ? (
	              <button type="button" className="patient-secondary-button" onClick={handleStartEditContact}>
	                Cập nhật thông tin liên hệ
	              </button>
	            ) : (
	              <>
	                <button type="button" className="patient-primary-button" onClick={handleSaveContact}>
	                  Lưu thay đổi
	                </button>
	                <button type="button" className="patient-plain-button" onClick={handleCancelEditContact}>
	                  Hủy bỏ
	                </button>
	              </>
	            )}
	            <button
	              type="button"
	              className="patient-secondary-button"
	              onClick={() => setShowPasswordForm((current) => !current)}
	            >
	              Đổi mật khẩu
	            </button>
	          </div>
	        </div>

	        <div className="patient-profile-form-grid">
	          <label>
	            Họ tên
	            <input type="text" value={patient.HoTen} disabled />
	          </label>
	          <label>
	            Ngày sinh
	            <input type="date" value={patient.NgaySinh} disabled />
	          </label>
	          <label>
	            Số CCCD
	            <input type="text" value={patient.CCCD} disabled />
	          </label>
	          <label>
	            Mã số BHYT
	            <input type="text" value={patient.MaSoBHYT || 'Không sử dụng'} disabled />
	          </label>
	          <label>
	            Mức hưởng BHYT
	            <input type="text" value={`${Math.round(getBhytRate() * 100)}%`} disabled />
	          </label>
	          <label>
	            Số điện thoại
	            <input
	              type="tel"
	              value={contactForm.SDT}
	              disabled={!isEditingContact}
	              onChange={(event) => setContactForm((current) => ({ ...current, SDT: event.target.value }))}
	            />
	          </label>
	          <label className="patient-profile-address">
	            Địa chỉ
	            <input
	              type="text"
	              value={contactForm.DiaChi}
	              disabled={!isEditingContact}
	              onChange={(event) => setContactForm((current) => ({ ...current, DiaChi: event.target.value }))}
	            />
	          </label>
	        </div>

	        {showPasswordForm && (
	          <div className="patient-password-panel">
	            <label>
	              Mật khẩu hiện tại
	              <input
	                type="password"
	                value={passwordForm.currentPassword}
	                onChange={(event) => handlePasswordFormChange('currentPassword', event.target.value)}
	              />
	            </label>
	            <label>
	              Mật khẩu mới
	              <input
	                type="password"
	                value={passwordForm.newPassword}
	                onChange={(event) => handlePasswordFormChange('newPassword', event.target.value)}
	              />
	            </label>
	            <label>
	              Xác nhận mật khẩu mới
	              <input
	                type="password"
	                value={passwordForm.confirmPassword}
	                onChange={(event) => handlePasswordFormChange('confirmPassword', event.target.value)}
	              />
	            </label>
	            <div className="patient-password-actions">
	              <button type="button" className="patient-primary-button" onClick={handleConfirmPasswordChange}>
	                Xác nhận đổi mật khẩu
	              </button>
	              <button type="button" className="patient-plain-button" onClick={handleCancelPasswordChange}>
	                Hủy bỏ
	              </button>
	            </div>
	          </div>
	        )}
	      </section>

      {renderHealthRecordSection()}

    </div>
  )

  const navItems = [
    { key: 'booking', label: 'Đặt lịch khám mới', icon: '🏥' },
    { key: 'appointments', label: 'Lịch hẹn của tôi', icon: '📅' },
    { key: 'treatment', label: 'Lịch trình Điều trị & Sổ khám bệnh', icon: '📑' },
  ]

  const renderContent = () => {
    if (activeMenu === 'appointments') return renderMyBookings()
    if (activeMenu === 'treatment') return renderTreatment()
    return renderBooking()
  }

  return (
    <main className="patient-shell">
      <aside className="patient-sidebar">
        <div className="patient-brand">
          <img src={medicalLogoImage} alt="Medicare" />
          <div>
            <strong>Medicare</strong>
            <span>Cổng Bệnh nhân</span>
          </div>
        </div>
        <nav className="patient-nav">
          {navItems.map((item) => (
            <button
              type="button"
              key={item.key}
              className={`patient-nav-button ${activeMenu === item.key ? 'active' : ''}`}
              onClick={() => setActiveMenu(item.key)}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <button type="button" className="patient-logout-button" onClick={onLogout}>
          <LogOut size={18} />
          Đăng xuất
        </button>
      </aside>

      <section className="patient-content">
        <header className="patient-topbar">
          <div>
            <span>Xin chào</span>
            <h1>{patient.HoTen}</h1>
          </div>
          <div className="patient-topbar-actions">
            <p>BHYT: {patient.MaSoBHYT || 'Không sử dụng'} - Mức hưởng {Math.round(getBhytRate() * 100)}%</p>
            <NotificationBell
              notifications={patientNotifications}
              onMarkAllRead={() => onMarkNotificationsRead?.(patient.MaBenhAn)}
            />
          </div>
        </header>
        {renderContent()}
      </section>
      {renderPaymentModal()}
    </main>
  )
}
