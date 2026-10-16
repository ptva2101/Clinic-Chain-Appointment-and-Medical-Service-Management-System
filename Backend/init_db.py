import sqlite3
from pathlib import Path

drop = input("⚠ This will reset the database. Do you want to continue? (y/n): ")

if drop.lower() != 'y':
    print("Operation cancelled. Database initialization aborted.")
    exit()

DB_PATH = Path(__file__).resolve().parent / "hospital.db"

# Xóa DB cũ nếu tồn tại
if DB_PATH.exists():
    DB_PATH.unlink()
    print("Old database deleted.")

# Tạo DB mới
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Bật foreign key
cursor.execute("PRAGMA foreign_keys = ON;")

# =========================
# CREATE ALL TABLES
# =========================
cursor.executescript("""
-- ==========================================
-- 1. PHÂN HỆ CON NGƯỜI (NHÂN SỰ & BỆNH NHÂN)
-- ==========================================

CREATE TABLE IF NOT EXISTS DANH_MUC_BHYT (
    KyTuDauBHYT TEXT PRIMARY KEY, -- Ví dụ: TE, DN, HT, GD...
    DoiTuongChinhSach TEXT NOT NULL, -- Ví dụ: Trẻ em dưới 6 tuổi, Người lao động...
    TyLeHuong REAL NOT NULL CHECK (TyLeHuong >= 0.0 AND TyLeHuong <= 1.0)
);

CREATE TABLE IF NOT EXISTS BENH_NHAN (
    MaBenhAn TEXT PRIMARY KEY,
    HoTen TEXT NOT NULL,
    CCCD TEXT NOT NULL UNIQUE, -- Bổ sung CCCD 12 số, bắt buộc và không trùng lặp
    NgaySinh TEXT,
    GioiTinh TEXT,
    SDT TEXT NOT NULL, -- Số điện thoại dùng làm Username đăng nhập
    MatKhau TEXT NOT NULL, -- Mật khẩu đăng nhập của bệnh nhân
    DiaChi TEXT,
    MaSoBHYT TEXT, -- Số thẻ BHYT thực tế (nếu có)
    KyTuDauBHYT TEXT, -- Khóa ngoại kết nối danh mục giảm trừ BHYT
    FOREIGN KEY (KyTuDauBHYT) REFERENCES DANH_MUC_BHYT(KyTuDauBHYT) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS BAC_SI (
    MaBacSi TEXT PRIMARY KEY, -- Dùng làm mã đăng nhập
    HoTen TEXT NOT NULL,
    ChuyenKhoa TEXT NOT NULL, -- Dùng để tự động lọc bác sĩ theo dịch vụ
    SDT TEXT,
    MatKhau TEXT NOT NULL,
    TrangThai TEXT NOT NULL DEFAULT 'Đang hoạt động' CHECK (TrangThai IN ('Đang hoạt động', 'Đã khóa'))
);
                     
CREATE TABLE IF NOT EXISTS CHI_NHANH (
    MaChiNhanh TEXT PRIMARY KEY,
    TenChiNhanh TEXT NOT NULL,
    DiaChi TEXT NOT NULL,
    SDT TEXT
);

CREATE TABLE IF NOT EXISTS LE_TAN (
    MaLeTan TEXT PRIMARY KEY,       -- Dùng làm mã đăng nhập
    HoTen TEXT NOT NULL,
    SDT TEXT,
    MatKhau TEXT NOT NULL,
    MaChiNhanh TEXT UNIQUE NOT NULL, -- Khóa ngoại liên kết 1-1 (UNIQUE đảm bảo mỗi chi nhánh chỉ có 1 lễ tân)
    TrangThai TEXT NOT NULL DEFAULT 'Đang hoạt động' CHECK (TrangThai IN ('Đang hoạt động', 'Đã khóa')),
    FOREIGN KEY (MaChiNhanh) REFERENCES CHI_NHANH(MaChiNhanh)
);

CREATE TABLE IF NOT EXISTS XET_NGHIEM_VIEN (
    MaXNV TEXT PRIMARY KEY,         -- Dùng làm mã đăng nhập
    HoTen TEXT NOT NULL,
    SDT TEXT,
    MatKhau TEXT NOT NULL,
    MaChiNhanh TEXT UNIQUE NOT NULL, -- Khóa ngoại liên kết 1-1 (UNIQUE đảm bảo mỗi chi nhánh chỉ có 1 XNV)
    TrangThai TEXT NOT NULL DEFAULT 'Đang hoạt động' CHECK (TrangThai IN ('Đang hoạt động', 'Đã khóa')),
    FOREIGN KEY (MaChiNhanh) REFERENCES CHI_NHANH(MaChiNhanh)
);

-- ==========================================
-- 2. PHÂN HỆ CƠ SỞ VẬT CHẤT & GIÁ DỊCH VỤ
-- ==========================================



CREATE TABLE IF NOT EXISTS DICH_VU (
    MaDichVu TEXT PRIMARY KEY,
    TenDichVu TEXT NOT NULL,
    ChuyenKhoa TEXT NOT NULL,
    LoaiDichVu TEXT NOT NULL CHECK (LoaiDichVu IN ('Khám lâm sàng', 'Xét nghiệm', 'Điều trị')),
    GiaGoc INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS CHI_NHANH_DICH_VU (
    MaCauHinh TEXT PRIMARY KEY,
    MaChiNhanh TEXT NOT NULL,
    MaDichVu TEXT NOT NULL,
    SlotGioiHan INTEGER NOT NULL,
    TrangThai TEXT NOT NULL DEFAULT 'Đang cung cấp' CHECK (TrangThai IN ('Đang cung cấp', 'Tạm ngừng')),
    FOREIGN KEY (MaChiNhanh) REFERENCES CHI_NHANH(MaChiNhanh) ON DELETE CASCADE,
    FOREIGN KEY (MaDichVu) REFERENCES DICH_VU(MaDichVu) ON DELETE CASCADE
);

-- ==========================================
-- 3. PHÂN HỆ VẬN HÀNH, ĐẶT LỊCH & THÔNG BÁO
-- ==========================================

CREATE TABLE IF NOT EXISTS LICH_TRUC (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    MaLichTruc TEXT NOT NULL,
    MaBacSi TEXT NOT NULL,
    MaChiNhanh TEXT NOT NULL,
    NgayTruc TEXT NOT NULL, -- Định dạng YYYY-MM-DD
    CaTruc INTEGER NOT NULL CHECK (CaTruc IN (1, 2, 3, 4)), -- Chốt cứng 4 ca
    TrangThai TEXT NOT NULL DEFAULT 'Đang hoạt động' CHECK (TrangThai IN ('Đang hoạt động', 'Đã hủy')),
    FOREIGN KEY (MaBacSi) REFERENCES BAC_SI(MaBacSi) ON DELETE CASCADE,
    FOREIGN KEY (MaChiNhanh) REFERENCES CHI_NHANH(MaChiNhanh) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS LICH_HEN (
    MaLichHen TEXT PRIMARY KEY,
    MaBenhAn TEXT NOT NULL,
    MaCauHinh TEXT NOT NULL,
    NgayKham TEXT NOT NULL, -- Định dạng YYYY-MM-DD
    CaKham INTEGER NOT NULL CHECK (CaKham IN (1, 2, 3, 4)),
    STT INTEGER NOT NULL, -- Số thứ tự trong ca
    PaymentToken TEXT,
    GiaCuoi INTEGER NOT NULL DEFAULT 0, -- Giá thực tế thu sau chính sách
    TrangThai TEXT NOT NULL CHECK (TrangThai IN ('Đã xác nhận', 'Chờ khám', 'Đang khám', 'Chờ kết luận', 'Hoàn thành', 'Đã hủy')),
    MaLeTan TEXT, -- Ghi nhận người lễ tân bấm check-in tiếp nhận
    MaBacSi TEXT NOT NULL,
    FOREIGN KEY (MaBenhAn) REFERENCES BENH_NHAN(MaBenhAn),
    FOREIGN KEY (MaCauHinh) REFERENCES CHI_NHANH_DICH_VU(MaCauHinh),
    FOREIGN KEY (MaLeTan) REFERENCES LE_TAN(MaLeTan),
    FOREIGN KEY (MaBacSi) REFERENCES BAC_SI(MaBacSi)
);

CREATE TABLE IF NOT EXISTS LICH_SU_THONG_BAO (
    MaThongBao TEXT PRIMARY KEY,
    MaLichHen TEXT NOT NULL,
    MaBenhAn TEXT NOT NULL,
    NoiDung TEXT NOT NULL,
    TrangThai TEXT NOT NULL CHECK (TrangThai IN ('Success', 'Failed')),
    DaDoc INTEGER NOT NULL DEFAULT 0 CHECK (DaDoc IN (0, 1)),
    Loi TEXT,
    ThoiGianGui TEXT NOT NULL, -- Timestamp hệ thống gửi tin
    FOREIGN KEY (MaLichHen) REFERENCES LICH_HEN(MaLichHen) ON DELETE CASCADE,
    FOREIGN KEY (MaBenhAn) REFERENCES BENH_NHAN(MaBenhAn) ON DELETE CASCADE
);

-- ==========================================
-- 4. PHÂN HỆ CHUYÊN MÔN LÂM SÀNG (BÁC SĨ)
-- ==========================================

CREATE TABLE IF NOT EXISTS BENH (
    MaBenh TEXT PRIMARY KEY, -- Mã bệnh chuẩn ICD-10
    TenBenh TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS THUOC (
    MaThuoc TEXT PRIMARY KEY,
    TenThuoc TEXT NOT NULL,
    DonViTinh TEXT NOT NULL -- Viên, Gói, Chai...
);

CREATE TABLE IF NOT EXISTS LUOT_KHAM (
    MaLuotKham TEXT PRIMARY KEY,
    MaLichHen TEXT NOT NULL UNIQUE, -- Đảm bảo ràng buộc quan hệ 1-1 với LICH_HEN
    MaBacSi TEXT NOT NULL,          -- Khóa ngoại liên kết trực tiếp sang bảng BAC_SI
    TrieuChung TEXT,
    LoiDan TEXT,
    MaBenh TEXT,
    FOREIGN KEY (MaLichHen) REFERENCES LICH_HEN(MaLichHen) ON DELETE CASCADE,
    FOREIGN KEY (MaBacSi) REFERENCES BAC_SI(MaBacSi),      -- Khóa ngoại chuẩn theo cấu trúc của bạn
    FOREIGN KEY (MaBenh) REFERENCES BENH(MaBenh)
);

-- ==========================================
-- 5. PHÂN HỆ CHỈ ĐỊNH SAU KHÁM (CẬN LÂM SÀNG & ĐIỀU TRỊ)
-- ==========================================

CREATE TABLE IF NOT EXISTS CHI_TIET_DON_THUOC (
    MaDonThuoc TEXT PRIMARY KEY,
    MaLuotKham TEXT NOT NULL,
    MaThuoc TEXT NOT NULL,
    SoLuong INTEGER NOT NULL CHECK (SoLuong > 0),
    LieuDung TEXT NOT NULL,
    FOREIGN KEY (MaLuotKham) REFERENCES LUOT_KHAM(MaLuotKham) ON DELETE CASCADE,
    FOREIGN KEY (MaThuoc) REFERENCES THUOC(MaThuoc)
);

CREATE TABLE IF NOT EXISTS CHI_TIET_XET_NGHIEM (
    MaChiTietXN TEXT PRIMARY KEY,
    MaLuotKham TEXT NOT NULL,
    MaDichVu TEXT NOT NULL, -- Chỉ chọn dịch vụ có LoaiDichVu = 'Xét nghiệm'
    KetQuaXetNghiem TEXT,
    MaXNV TEXT, -- Ghi nhận mã Xét nghiệm viên thực hiện
    GiaCuoi INTEGER NOT NULL DEFAULT 0, -- Thanh toán luôn lúc chỉ định
    PaymentToken TEXT,
    TrangThaiXetNghiem TEXT NOT NULL CHECK (TrangThaiXetNghiem IN ('Chưa thực hiện', 'Đã có kết quả')),
    FOREIGN KEY (MaLuotKham) REFERENCES LUOT_KHAM(MaLuotKham) ON DELETE CASCADE,
    FOREIGN KEY (MaDichVu) REFERENCES DICH_VU(MaDichVu),
    FOREIGN KEY (MaXNV) REFERENCES XET_NGHIEM_VIEN(MaXNV)
);

CREATE TABLE IF NOT EXISTS LICH_TRINH_DIEU_TRI (
    MaLichTrinh TEXT PRIMARY KEY,
    MaLuotKham TEXT NOT NULL,
    MaDichVu TEXT NOT NULL, -- Chỉ chọn dịch vụ có LoaiDichVu = 'Điều trị'
    BuoiSo INTEGER NOT NULL CHECK (BuoiSo > 0),
    NgayThucHien TEXT, -- Sẽ được cập nhật khi bệnh nhân tự đặt lịch cho buổi này
    CaKham INTEGER CHECK (CaKham IN (NULL, 1, 2, 3, 4)),
    MaLichHen TEXT,
    TrangThai TEXT NOT NULL CHECK (TrangThai IN ('Chưa đặt lịch', 'Đã đặt lịch', 'Hoàn thành')),
    FOREIGN KEY (MaLuotKham) REFERENCES LUOT_KHAM(MaLuotKham) ON DELETE CASCADE,
    FOREIGN KEY (MaDichVu) REFERENCES DICH_VU(MaDichVu),
    FOREIGN KEY (MaLichHen) REFERENCES LICH_HEN(MaLichHen) ON DELETE SET NULL
);

-- =========================================================================
-- SCRIPT CHÈN DATA GIẢ LẬP TOÀN BỘ CÁC BẢNG TRÊN SQLITE (ĐÃ LÀM SẠCH LOGIC)
-- =========================================================================

-- 1. DANH MỤC BHYT
-- 1. CẬP NHẬT BẢNG DANH_MUC_BHYT (Đầy đủ các nhóm đối tượng theo Luật BHYT Việt Nam)
INSERT INTO DANH_MUC_BHYT (KyTuDauBHYT, DoiTuongChinhSach, TyLeHuong) VALUES 
-- Nhóm hưởng 100% chi phí khám chữa bệnh (Tỷ lệ hưởng = 1.00)
('TE', 'Trẻ em dưới 6 tuổi', 1.00),
('CC', 'Người có công với cách mạng, cựu chiến binh', 1.00),
('HN', 'Người thuộc hộ gia đình nghèo, cận nghèo được hỗ trợ', 1.00),
('QN', 'Sĩ quan, quân nhân chuyên nghiệp, lực lượng vũ trang', 1.00),

-- Nhóm hưởng 95% chi phí khám chữa bệnh (Tỷ lệ hưởng = 0.95)
('HT', 'Người hưởng lương hưu, trợ cấp mất sức lao động hàng tháng', 0.95),
('TC', 'Thân nhân của người có công với cách mạng', 0.95),

-- Nhóm hưởng 80% chi phí khám chữa bệnh (Tỷ lệ hưởng = 0.80)
('DN', 'Người lao động trong các doanh nghiệp, cơ quan nhà nước', 0.80),
('HS', 'Học sinh, sinh viên các trường đào tạo', 0.80),
('GD', 'Người tham gia BHYT theo hộ gia đình', 0.80),
('CH', 'Người nước ngoài đang học tập, làm việc được cấp thẻ BHYT', 0.80);

-- 2. DANH MỤC BỆNH (Đưa lên trước để LUOT_KHAM có thể liên kết ngoại)
-- 12. BẢNG BENH (Mở rộng đầy đủ mặt bệnh cho phòng khám 4 chuyên khoa)
INSERT INTO BENH (MaBenh, TenBenh) VALUES 
-- Nhóm Tiêu hóa & Dạ dày (Khoa Nội tổng quát)
('K29', 'Viêm dạ dày và tá tràng'),
('K29.0', 'Viêm dạ dày xuất huyết cấp tính'),
('K29.5', 'Viêm dạ dày mạn tính, không đặc hiệu'),
('K25', 'Loét dạ dày (Có hoặc không có nhiễm H.Pylori)'),
('K30', 'Chứng khó tiêu (Dyspepsia)'),
('K58', 'Hội chứng ruột kích thích (IBS)'),
('K52', 'Viêm dạ dày ruột và đại tràng không nhiễm khuẩn (Rối loạn tiêu hóa)'),

-- Nhóm Hô hấp & Tai Mũi Họng (Khoa Tai mũi họng / Nội)
('J00', 'Viêm mũi họng cấp (Cảm thường)'),
('J01', 'Viêm xoang cấp tính'),
('J02', 'Viêm họng cấp tính'),
('J03', 'Viêm amidan cấp tính'),
('J06', 'Viêm nhiễm khuẩn đường hô hấp trên cấp tính nhiều nơi'),
('J20', 'Viêm phế quản cấp tính'),
('J45', 'Hen phế quản (Suyễn)'),
('H65', 'Viêm tai giữa thanh dịch cấp tính'),
('H66', 'Viêm tai giữa có mủ không đặc hiệu'),

-- Nhóm Răng Hàm Mặt (Khoa Răng hàm mặt)
('K02', 'Sâu răng (Dental caries)'),
('K04', 'Bệnh tủy và mô quanh chóp chân răng (Viêm tủy răng)'),
('K05', 'Viêm lợi và bệnh nha chu'),
('K07', 'Các bất thường về vị trí của răng (Răng mọc lệch/mọc ngầm)'),
('K12', 'Viêm miệng và các tổn thương liên quan (Nhiệt miệng, áp-tơ)'),

-- Nhóm Tim mạch, Chuyển hóa & Khác (Khoa Nội tổng quát)
('I10', 'Tăng huyết áp vô căn (nguyên phát)'),
('E11', 'Đái tháo đường không phụ thuộc insulin (Type 2)'),
('E78', 'Rối loạn chuyển hóa lipoprotein và tình trạng tăng lipid máu (Mỡ máu cao)'),
('M17', 'Thoái hóa khớp gối'),
('M54.5', 'Đau lưng vùng thấp (Lumbago)'),
('G43', 'Bệnh đau nửa đầu (Migraine)'),
('G44', 'Hội chứng đau đầu khác');

-- 3. DANH MỤC THUỐC
-- 13. BẢNG THUOC (Bổ sung đầy đủ các nhóm thuốc kê đơn thực tế)
INSERT INTO THUOC (MaThuoc, TenThuoc, DonViTinh) VALUES 
-- Nhóm Giảm đau, Hạ sốt, Kháng viêm, Giảm phù nề
('TH_PARACETAMOL', 'Paracetamol 500mg', 'Viên'),
('TH_PANADOL_EXTRA', 'Panadol Extra (Paracetamol/Caffeine)', 'Viên'),
('TH_IBUPROFEN', 'Ibuprofen 400mg', 'Viên'),
('TH_CELECOXIB', 'Celecoxib 200mg', 'Viên'),
('TH_MELOXICAM', 'Meloxicam 7.5mg', 'Viên'),
('TH_ALPHA_CHOAY', 'Alphachymotrypsin (Alpha Choay)', 'Viên'),

-- Nhóm Kháng sinh đường uống (Nội & Tai Mũi Họng)
('TH_AMOXICILLIN', 'Amoxicillin 500mg', 'Viên'),
('TH_AUGMENTIN', 'Augmentin 1g (Amoxicillin/Clavulanate)', 'Viên'),
('TH_CEFUROXIME', 'Cefuroxime 500mg', 'Viên'),
('TH_AZITHROMYCIN', 'Azithromycin 500mg', 'Viên'),

-- Nhóm Kháng sinh chuyên biệt Răng Hàm Mặt
('TH_ROVAMYCINE', 'Rovamycine 3MUI (Spiramycin)', 'Viên'),
('TH_RODOGYL', 'Rodogyl (Spiramycin/Metronidazole chuyên trị viêm răng)', 'Viên'),

-- Nhóm Dạ dày, Tiêu hóa & Men vi sinh
('TH_OMEPRAZOLE', 'Omeprazole 20mg', 'Viên'),
('TH_NEXIUM', 'Esomeprazole 40mg (Nexium)', 'Viên'),
('TH_PHOSPHALUGEL', 'Phosphalugel (Thuốc dạ dày chữ P)', 'Gói'),
('TH_GAVISCON', 'Gaviscon đường uống (Trị trào ngược)', 'Gói'),
('TH_MOTILIUM', 'Domperidone 10mg (Motilium)', 'Viên'),
('TH_SPASFON', 'Phloroglucinol 80mg (Spasfon trị co thắt đại tràng)', 'Viên'),
('TH_BIOFLOR', 'Men vi sinh Bioflor 250mg', 'Gói'),

-- Nhóm Thuốc Ho, Sổ mũi, Kháng Histamin (Tai Mũi Họng)
('TH_SINGULAIR', 'Montelukast 10mg (Singulair trị hen/viêm mũi)', 'Viên'),
('TH_ACEMUC', 'Acetylcysteine 200mg (Acemuc long đờm)', 'Gói'),
('TH_TUSSIPLAST', 'Thuốc ho thảo dược Tussiplast', 'Viên'),
('TH_AERIUS', 'Desloratadine 5mg (Aerius trị dị ứng/sổ mũi)', 'Viên'),
('TH_COLDI_B', 'Thuốc xịt mũi Coldi-B', 'Chai'),
('TH_OTIPAX', 'Thuốc nhỏ tai Otipax (Trị viêm tai)', 'Chai'),

-- Nhóm Huyết áp, Tim mạch, Tiểu đường & Mỡ máu
('TH_AMLODIPINE', 'Amlodipine 5mg (Trị cao huyết áp)', 'Viên'),
('TH_LOSARTAN', 'Losartan 50mg (Trị cao huyết áp)', 'Viên'),
('TH_GLUCOPHAGE', 'Metformin 850mg (Glucophage trị tiểu đường)', 'Viên'),
('TH_LIPITOR', 'Atorvastatin 10mg (Lipitor hạ mỡ máu)', 'Viên'),

-- Nhóm Nước súc miệng & Thuốc bôi nhiệt miệng
('TH_CHLORHEXIDINE', 'Nước súc miệng diệt khuẩn Chlorhexidine 0.2%', 'Chai'),
('TH_ORACORTIA', 'Gel bôi nhiệt miệng Oracortia', 'Gói');

-- 4. BỆNH NHÂN
INSERT INTO BENH_NHAN (MaBenhAn, HoTen, CCCD, NgaySinh, GioiTinh, SDT, MatKhau, DiaChi, MaSoBHYT, KyTuDauBHYT) VALUES 
('BN001', 'Trần Quang Hải', '001095012345', '1995-04-12', 'Nam', '0901234567', 'password_hai95', 'Cầu Giấy, Hà Nội', 'DN4010123456789', 'DN'),
('BN002', 'Nguyễn Thị Mai', '001200054321', '2000-08-20', 'Nữ', '0907654321', 'password_mai00', 'Đống Đa, Hà Nội', NULL, NULL),
('BN003', 'Phạm Lê Minh', '001221098765', '2021-11-05', 'Nam', '0911999888', 'password_minh21', 'Hai Bà Trưng, Hà Nội', 'TE1010999888777', 'TE');

-- 1. CẬP NHẬT BẢNG BAC_SI (Phân bổ lại 23 Bác sĩ vào 3 khoa lâm sàng chuẩn)
INSERT INTO BAC_SI (MaBacSi, HoTen, ChuyenKhoa, SDT, MatKhau) VALUES 
('BS001', 'Nguyễn Văn An', 'Nội tổng quát', '0911222333', 'hashed_bs001'),
('BS002', 'Lê Thị Bình', 'Răng hàm mặt', '0922333444', 'hashed_bs002'),
('BS003', 'Phạm Hoàng Long', 'Tai mũi họng', '0933444555', 'hashed_bs003'),
('BS004', 'Trần Trần Đức', 'Nội tổng quát', '0944555666', 'hashed_bs004'),
('BS005', 'Nguyễn Thị Minh', 'Nội tổng quát', '0912345678', 'hashed_bs005'),
('BS006', 'Phan Văn Khải', 'Răng hàm mặt', '0923456789', 'hashed_bs006'),
('BS007', 'Hoàng Lê Giang', 'Tai mũi họng', '0934567890', 'hashed_bs007'),
('BS008', 'Vũ Ngô Hùng', 'Răng hàm mặt', '0945678901', 'hashed_bs008'),
('BS009', 'Đỗ Thúy Hạnh', 'Nội tổng quát', '0913456789', 'hashed_bs009'),
('BS010', 'Bùi Chí Kiên', 'Răng hàm mặt', '0924567890', 'hashed_bs010'),
('BS011', 'Lý Thu Thảo', 'Tai mũi họng', '0935678901', 'hashed_bs011'),
('BS012', 'Đặng Quốc Bảo', 'Tai mũi họng', '0946789012', 'hashed_bs012'),
('BS013', 'Ngô Bảo Ngọc', 'Nội tổng quát', '0914567890', 'hashed_bs013'),
('BS014', 'Dương Văn Lâm', 'Răng hàm mặt', '0925678901', 'hashed_bs014'),
('BS015', 'Võ Thị Sáu', 'Tai mũi họng', '0936789012', 'hashed_bs015'),
('BS016', 'Tống Phước Hải', 'Nội tổng quát', '0947890123', 'hashed_bs016'),
('BS017', 'Đinh Công Mạnh', 'Nội tổng quát', '0915678901', 'hashed_bs017'),
('BS018', 'Mai Phương Thảo', 'Răng hàm mặt', '0926789012', 'hashed_bs018'),
('BS019', 'Hồ Tiến Dũng', 'Tai mũi họng', '0937890123', 'hashed_bs019'),
('BS020', 'Trịnh Đình Quang', 'Răng hàm mặt', '0948901234', 'hashed_bs020'),
('BS021', 'Vương Kim Chi', 'Nội tổng quát', '0916789012', 'hashed_bs021'),
('BS022', 'Đoàn Nguyên Đức', 'Răng hàm mặt', '0927890123', 'hashed_bs022'),
('BS023', 'Lưu Hồng Quang', 'Tai mũi họng', '0938901234', 'hashed_bs023');
                     
-- 6. CHI NHÁNH
INSERT INTO CHI_NHANH (MaChiNhanh, TenChiNhanh, DiaChi, SDT) VALUES 
('CN_CG', 'Smart Clinic - Cơ sở Cầu Giấy', 'Số 1 Dịch Vọng Hậu, Cầu Giấy, Hà Nội', '0241234567'),
('CN_HBT', 'Smart Clinic - Cơ sở Hai Bà Trưng', 'Số 99 Đại Cồ Việt, Hai Bà Trưng, Hà Nội', '0247654321');

-- 7. LỄ TÂN
INSERT INTO LE_TAN (MaLeTan, HoTen, SDT, MatKhau, MaChiNhanh) VALUES 
('LT001', 'Phạm Minh Thư', '0988777666', 'hashed_lt001', 'CN_CG'),  -- Lễ tân cơ sở Cầu Giấy
('LT002', 'Nguyễn Hoàng Yến', '0988555444', 'hashed_lt002', 'CN_HBT'); -- Lễ tân cơ sở Hai Bà Trưng

-- 8. XÉT NGHIỆM VIÊN
INSERT INTO XET_NGHIEM_VIEN (MaXNV, HoTen, SDT, MatKhau, MaChiNhanh) VALUES 
('XNV001', 'Trần Văn Cường', '0966111222', 'hashed_xnv001', 'CN_CG'),  -- XNV cơ sở Cầu Giấy
('XNV002', 'Vũ Hồng Ngọc', '0966333444', 'hashed_xnv002', 'CN_HBT'); -- XNV cơ sở Hai Bà Trưng



-- 9. DANH MỤC DỊCH VỤ
-- 2. CẬP NHẬT BẢNG DICH_VU (Đúng 30 bản ghi, tập trung mạnh vào Khám lâm sàng)
INSERT INTO DICH_VU (MaDichVu, TenDichVu, ChuyenKhoa, LoaiDichVu, GiaGoc) VALUES 
-- === CHUYÊN KHOA: NỘI TỔNG QUÁT (10 Dịch vụ) ===
('DV_KHAM_NOI', 'Khám Nội Tổng Quát', 'Nội tổng quát', 'Khám lâm sàng', 150000),
('DV_KHAM_GIA_DINH', 'Khám Sức Khỏe Gia Đình', 'Nội tổng quát', 'Khám lâm sàng', 250000),
('DV_KHAM_LAO_KHOA', 'Khám Tư Vấn Sức Khỏe Lão Khoa', 'Nội tổng quát', 'Khám lâm sàng', 180000),
('DV_KHAM_TIM_MACH', 'Khám Sàng Lọc Tim Mạch - Huyết Áp', 'Nội tổng quát', 'Khám lâm sàng', 200000),
('DV_KHAM_TIEU_HOA', 'Khám Tiêu Hóa - Gan Mật', 'Nội tổng quát', 'Khám lâm sàng', 180000),
('DV_KHAM_HO_HAP', 'Khám Bệnh Lý Đường Hô Hấp', 'Nội tổng quát', 'Khám lâm sàng', 170000),
('DV_KHAM_NOI_TIET', 'Khám Sàng Lọc Tiểu Đường & Nội Tiết', 'Nội tổng quát', 'Khám lâm sàng', 220000),
('DV_KHAM_DINH_DUONG', 'Khám Tư Vấn Dinh Dưỡng Chuyên Sâu', 'Nội tổng quát', 'Khám lâm sàng', 150000),
('DT_TRUYEN_DICH', 'Liệu trình truyền dịch giải độc, bù nước', 'Nội tổng quát', 'Điều trị', 250000),
('DT_TIEM_KHANG_SINH', 'Dịch vụ tiêm thuốc/kháng sinh theo chỉ định', 'Nội tổng quát', 'Điều trị', 80000),

-- === CHUYÊN KHOA: RĂNG HÀM MẶT (8 Dịch vụ) ===
('DV_KHAM_RANG', 'Khám Răng Hàm Mặt Định Kỳ', 'Răng hàm mặt', 'Khám lâm sàng', 200000),
('DV_LAY_CAO', 'Lấy Cao Răng Và Đánh Bóng Thẩm Mỹ', 'Răng hàm mặt', 'Khám lâm sàng', 150000),
('DV_KHAM_NIENG_RANG', 'Khám Tư Vấn Chỉnh Nha/Niềng Răng', 'Răng hàm mặt', 'Khám lâm sàng', 300000),
('DV_KHAM_IMPLANT', 'Khám Tư Vấn Trồng Răng Implant', 'Răng hàm mặt', 'Khám lâm sàng', 300000),
('DT_HAN_RANG', 'Hàn Răng Composite Thẩm Mỹ (1 Răng)', 'Răng hàm mặt', 'Điều trị', 300000),
('DT_RANG_TUY', 'Liệu Trình Điều Trị Tủy Răng Toàn Diện', 'Răng hàm mặt', 'Điều trị', 1200000),
('DT_NHO_RANG_KHON', 'Phẫu Thuật Nhổ Răng Khôn Mọc Lệch', 'Răng hàm mặt', 'Điều trị', 1000000),
('DT_TAY_TRANG', 'Tẩy Trắng Răng Công Nghệ Laser', 'Răng hàm mặt', 'Điều trị', 2000000),

-- === CHUYÊN KHOA: TAI MŨI HỌNG (7 Dịch vụ) ===
('DV_KHAM_TMH', 'Khám Tai Mũi Họng Thông Thường', 'Tai mũi họng', 'Khám lâm sàng', 180000),
('DV_NOI_SOI_TMH', 'Nội Soi Tai Mũi Họng Ống Mềm', 'Tai mũi họng', 'Khám lâm sàng', 250000),
('DV_KHAM_THINH_LUC', 'Khám Đo Thính Lực Đơn Âm', 'Tai mũi họng', 'Khám lâm sàng', 200000),
('DT_KHIDUNG', 'Liệu Trình Khí Dung Mũi Họng', 'Tai mũi họng', 'Điều trị', 450000),
('DT_VIEM_AMIDAN', 'Liệu Trình Điều Trị Viêm Amidan Hạt', 'Tai mũi họng', 'Điều trị', 600000),
('DT_RUA_XOANG', 'Hút Mủ Và Chọc Rửa Xoang Điều Trị', 'Tai mũi họng', 'Điều trị', 350000),
('DT_LAY_DI_VAT', 'Thủ Thuật Lấy Dị Vật Vùng Tai/Mũi/Họng', 'Tai mũi họng', 'Điều trị', 400000),

-- === CHUYÊN KHOA: XÉT NGHIỆM (5 Dịch vụ - Chỉ làm Xét nghiệm/Cận lâm sàng) ===
('XN_MAU', 'Xét Nghiệm Công Thức Máu 24 Chỉ Số', 'Xét nghiệm', 'Xét nghiệm', 250000),
('SA_O_BUNG', 'Siêu Âm Ổ Bụng Tổng Quát', 'Xét nghiệm', 'Xét nghiệm', 300000),
('XN_NUOC_TIEU', 'Xét Nghiệm Nước Tiểu Toàn Bộ (10 Thông Số)', 'Xét nghiệm', 'Xét nghiệm', 120000),
('XN_SINH_HOA', 'Xét Nghiệm Sinh Hóa Máu (Gan, Thận, Mỡ Máu)', 'Xét nghiệm', 'Xét nghiệm', 350000),
('XN_DUONG_HUYET', 'Xét Nghiệm Đường Huyết Nhanh', 'Xét nghiệm', 'Xét nghiệm', 80000);

-- 10. CẤU HÌNH DỊCH VỤ CHI NHÁNH (CHUẨN HÓA MÃ 100% - PHỦ KÍN 60 BẢN GHI)
INSERT INTO CHI_NHANH_DICH_VU (MaCauHinh, MaChiNhanh, MaDichVu, SlotGioiHan) VALUES 
-- === CHI NHÁNH CẦU GIẤY (CN_CG) ===
('CH_CG_DV_KHAM_NOI', 'CN_CG', 'DV_KHAM_NOI', 15),
('CH_CG_DV_KHAM_GIA_DINH', 'CN_CG', 'DV_KHAM_GIA_DINH', 15),
('CH_CG_DV_KHAM_LAO_KHOA', 'CN_CG', 'DV_KHAM_LAO_KHOA', 15),
('CH_CG_DV_KHAM_TIM_MACH', 'CN_CG', 'DV_KHAM_TIM_MACH', 15),
('CH_CG_DV_KHAM_TIEU_HOA', 'CN_CG', 'DV_KHAM_TIEU_HOA', 15),
('CH_CG_DV_KHAM_HO_HAP', 'CN_CG', 'DV_KHAM_HO_HAP', 15),
('CH_CG_DV_KHAM_NOI_TIET', 'CN_CG', 'DV_KHAM_NOI_TIET', 15),
('CH_CG_DV_KHAM_DINH_DUONG', 'CN_CG', 'DV_KHAM_DINH_DUONG', 15),
('CH_CG_DT_TRUYEN_DICH', 'CN_CG', 'DT_TRUYEN_DICH', 15),
('CH_CG_DT_TIEM_KHANG_SINH', 'CN_CG', 'DT_TIEM_KHANG_SINH', 15),
('CH_CG_DV_KHAM_RANG', 'CN_CG', 'DV_KHAM_RANG', 15),
('CH_CG_DV_LAY_CAO', 'CN_CG', 'DV_LAY_CAO', 15),
('CH_CG_DV_KHAM_NIENG_RANG', 'CN_CG', 'DV_KHAM_NIENG_RANG', 15),
('CH_CG_DV_KHAM_IMPLANT', 'CN_CG', 'DV_KHAM_IMPLANT', 15),
('CH_CG_DT_HAN_RANG', 'CN_CG', 'DT_HAN_RANG', 15),
('CH_CG_DT_RANG_TUY', 'CN_CG', 'DT_RANG_TUY', 15),
('CH_CG_DT_NHO_RANG_KHON', 'CN_CG', 'DT_NHO_RANG_KHON', 15),
('CH_CG_DT_TAY_TRANG', 'CN_CG', 'DT_TAY_TRANG', 15),
('CH_CG_DV_KHAM_TMH', 'CN_CG', 'DV_KHAM_TMH', 15),
('CH_CG_DV_NOI_SOI_TMH', 'CN_CG', 'DV_NOI_SOI_TMH', 15),
('CH_CG_DV_KHAM_THINH_LUC', 'CN_CG', 'DV_KHAM_THINH_LUC', 15),
('CH_CG_DT_KHIDUNG', 'CN_CG', 'DT_KHIDUNG', 15),
('CH_CG_DT_VIEM_AMIDAN', 'CN_CG', 'DT_VIEM_AMIDAN', 15),
('CH_CG_DT_RUA_XOANG', 'CN_CG', 'DT_RUA_XOANG', 15),
('CH_CG_DT_LAY_DI_VAT', 'CN_CG', 'DT_LAY_DI_VAT', 15),
('CH_CG_XN_MAU', 'CN_CG', 'XN_MAU', 15),
('CH_CG_SA_O_BUNG', 'CN_CG', 'SA_O_BUNG', 15),
('CH_CG_XN_NUOC_TIEU', 'CN_CG', 'XN_NUOC_TIEU', 15),
('CH_CG_XN_SINH_HOA', 'CN_CG', 'XN_SINH_HOA', 15),
('CH_CG_XN_DUONG_HUYET', 'CN_CG', 'XN_DUONG_HUYET', 15),

-- === CHI NHÁNH HAI BÀ TRƯNG (CN_HBT) ===
('CH_HBT_DV_KHAM_NOI', 'CN_HBT', 'DV_KHAM_NOI', 15),
('CH_HBT_DV_KHAM_GIA_DINH', 'CN_HBT', 'DV_KHAM_GIA_DINH', 15),
('CH_HBT_DV_KHAM_LAO_KHOA', 'CN_HBT', 'DV_KHAM_LAO_KHOA', 15),
('CH_HBT_DV_KHAM_TIM_MACH', 'CN_HBT', 'DV_KHAM_TIM_MACH', 15),
('CH_HBT_DV_KHAM_TIEU_HOA', 'CN_HBT', 'DV_KHAM_TIEU_HOA', 15),
('CH_HBT_DV_KHAM_HO_HAP', 'CN_HBT', 'DV_KHAM_HO_HAP', 15),
('CH_HBT_DV_KHAM_NOI_TIET', 'CN_HBT', 'DV_KHAM_NOI_TIET', 15),
('CH_HBT_DV_KHAM_DINH_DUONG', 'CN_HBT', 'DV_KHAM_DINH_DUONG', 15),
('CH_HBT_DT_TRUYEN_DICH', 'CN_HBT', 'DT_TRUYEN_DICH', 15),
('CH_HBT_DT_TIEM_KHANG_SINH', 'CN_HBT', 'DT_TIEM_KHANG_SINH', 15),
('CH_HBT_DV_KHAM_RANG', 'CN_HBT', 'DV_KHAM_RANG', 15),
('CH_HBT_DV_LAY_CAO', 'CN_HBT', 'DV_LAY_CAO', 15),
('CH_HBT_DV_KHAM_NIENG_RANG', 'CN_HBT', 'DV_KHAM_NIENG_RANG', 15),
('CH_HBT_DV_KHAM_IMPLANT', 'CN_HBT', 'DV_KHAM_IMPLANT', 15),
('CH_HBT_DT_HAN_RANG', 'CN_HBT', 'DT_HAN_RANG', 15),
('CH_HBT_DT_RANG_TUY', 'CN_HBT', 'DT_RANG_TUY', 15),
('CH_HBT_DT_NHO_RANG_KHON', 'CN_HBT', 'DT_NHO_RANG_KHON', 15),
('CH_HBT_DT_TAY_TRANG', 'CN_HBT', 'DT_TAY_TRANG', 15),
('CH_HBT_DV_KHAM_TMH', 'CN_HBT', 'DV_KHAM_TMH', 15),
('CH_HBT_DV_NOI_SOI_TMH', 'CN_HBT', 'DV_NOI_SOI_TMH', 15),
('CH_HBT_DV_KHAM_THINH_LUC', 'CN_HBT', 'DV_KHAM_THINH_LUC', 15),
('CH_HBT_DT_KHIDUNG', 'CN_HBT', 'DT_KHIDUNG', 15),
('CH_HBT_DT_VIEM_AMIDAN', 'CN_HBT', 'DT_VIEM_AMIDAN', 15),
('CH_HBT_DT_RUA_XOANG', 'CN_HBT', 'DT_RUA_XOANG', 15),
('CH_HBT_DT_LAY_DI_VAT', 'CN_HBT', 'DT_LAY_DI_VAT', 15),
('CH_HBT_XN_MAU', 'CN_HBT', 'XN_MAU', 15),
('CH_HBT_SA_O_BUNG', 'CN_HBT', 'SA_O_BUNG', 15),
('CH_HBT_XN_NUOC_TIEU', 'CN_HBT', 'XN_NUOC_TIEU', 15),
('CH_HBT_XN_SINH_HOA', 'CN_HBT', 'XN_SINH_HOA', 15),
('CH_HBT_XN_DUONG_HUYET', 'CN_HBT', 'XN_DUONG_HUYET', 15);

-- 11. LỊCH TRỰC BÁC SĨ (FULL CÁC CA TỪ 01/06/2026 ĐẾN 01/07/2026)
INSERT INTO LICH_TRUC (MaLichTruc, MaBacSi, MaChiNhanh, NgayTruc, CaTruc) VALUES 
('LT_001', 'BS001', 'CN_CG', '2026-06-01', 1),
('LT_002', 'BS002', 'CN_CG', '2026-06-01', 2),
('LT_003', 'BS003', 'CN_CG', '2026-06-01', 3),
('LT_004', 'BS004', 'CN_CG', '2026-06-01', 4),
('LT_005', 'BS013', 'CN_HBT', '2026-06-01', 1),
('LT_006', 'BS014', 'CN_HBT', '2026-06-01', 2),
('LT_007', 'BS015', 'CN_HBT', '2026-06-01', 3),
('LT_008', 'BS016', 'CN_HBT', '2026-06-01', 4),
('LT_009', 'BS005', 'CN_CG', '2026-06-02', 1),
('LT_010', 'BS006', 'CN_CG', '2026-06-02', 2),
('LT_011', 'BS007', 'CN_CG', '2026-06-02', 3),
('LT_012', 'BS008', 'CN_CG', '2026-06-02', 4),
('LT_013', 'BS017', 'CN_HBT', '2026-06-02', 1),
('LT_014', 'BS018', 'CN_HBT', '2026-06-02', 2),
('LT_015', 'BS019', 'CN_HBT', '2026-06-02', 3),
('LT_016', 'BS020', 'CN_HBT', '2026-06-02', 4),
('LT_017', 'BS009', 'CN_CG', '2026-06-03', 1),
('LT_018', 'BS010', 'CN_CG', '2026-06-03', 2),
('LT_019', 'BS011', 'CN_CG', '2026-06-03', 3),
('LT_020', 'BS012', 'CN_CG', '2026-06-03', 4),
('LT_021', 'BS021', 'CN_HBT', '2026-06-03', 1),
('LT_022', 'BS022', 'CN_HBT', '2026-06-03', 2),
('LT_023', 'BS023', 'CN_HBT', '2026-06-03', 3),
('LT_024', 'BS013', 'CN_HBT', '2026-06-03', 4),
('LT_025', 'BS001', 'CN_CG', '2026-06-04', 1),
('LT_026', 'BS002', 'CN_CG', '2026-06-04', 2),
('LT_027', 'BS003', 'CN_CG', '2026-06-04', 3),
('LT_028', 'BS004', 'CN_CG', '2026-06-04', 4),
('LT_029', 'BS014', 'CN_HBT', '2026-06-04', 1),
('LT_030', 'BS015', 'CN_HBT', '2026-06-04', 2),
('LT_031', 'BS016', 'CN_HBT', '2026-06-04', 3),
('LT_032', 'BS017', 'CN_HBT', '2026-06-04', 4),
('LT_033', 'BS005', 'CN_CG', '2026-06-05', 1),
('LT_034', 'BS006', 'CN_CG', '2026-06-05', 2),
('LT_035', 'BS007', 'CN_CG', '2026-06-05', 3),
('LT_036', 'BS008', 'CN_CG', '2026-06-05', 4),
('LT_037', 'BS018', 'CN_HBT', '2026-06-05', 1),
('LT_038', 'BS019', 'CN_HBT', '2026-06-05', 2),
('LT_039', 'BS020', 'CN_HBT', '2026-06-05', 3),
('LT_040', 'BS021', 'CN_HBT', '2026-06-05', 4),
('LT_041', 'BS009', 'CN_CG', '2026-06-06', 1),
('LT_042', 'BS010', 'CN_CG', '2026-06-06', 2),
('LT_043', 'BS011', 'CN_CG', '2026-06-06', 3),
('LT_044', 'BS012', 'CN_CG', '2026-06-06', 4),
('LT_045', 'BS022', 'CN_HBT', '2026-06-06', 1),
('LT_046', 'BS023', 'CN_HBT', '2026-06-06', 2),
('LT_047', 'BS013', 'CN_HBT', '2026-06-06', 3),
('LT_048', 'BS014', 'CN_HBT', '2026-06-06', 4),
('LT_049', 'BS001', 'CN_CG', '2026-06-07', 1),
('LT_050', 'BS002', 'CN_CG', '2026-06-07', 2),
('LT_051', 'BS003', 'CN_CG', '2026-06-07', 3),
('LT_052', 'BS004', 'CN_CG', '2026-06-07', 4),
('LT_053', 'BS015', 'CN_HBT', '2026-06-07', 1),
('LT_054', 'BS016', 'CN_HBT', '2026-06-07', 2),
('LT_055', 'BS017', 'CN_HBT', '2026-06-07', 3),
('LT_056', 'BS018', 'CN_HBT', '2026-06-07', 4),
('LT_057', 'BS005', 'CN_CG', '2026-06-08', 1),
('LT_058', 'BS006', 'CN_CG', '2026-06-08', 2),
('LT_059', 'BS007', 'CN_CG', '2026-06-08', 3),
('LT_060', 'BS008', 'CN_CG', '2026-06-08', 4),
('LT_061', 'BS019', 'CN_HBT', '2026-06-08', 1),
('LT_062', 'BS020', 'CN_HBT', '2026-06-08', 2),
('LT_063', 'BS021', 'CN_HBT', '2026-06-08', 3),
('LT_064', 'BS022', 'CN_HBT', '2026-06-08', 4),
('LT_065', 'BS009', 'CN_CG', '2026-06-09', 1),
('LT_066', 'BS010', 'CN_CG', '2026-06-09', 2),
('LT_067', 'BS011', 'CN_CG', '2026-06-09', 3),
('LT_068', 'BS012', 'CN_CG', '2026-06-09', 4),
('LT_069', 'BS023', 'CN_HBT', '2026-06-09', 1),
('LT_070', 'BS013', 'CN_HBT', '2026-06-09', 2),
('LT_071', 'BS014', 'CN_HBT', '2026-06-09', 3),
('LT_072', 'BS015', 'CN_HBT', '2026-06-09', 4),
('LT_073', 'BS001', 'CN_CG', '2026-06-10', 1),
('LT_074', 'BS002', 'CN_CG', '2026-06-10', 2),
('LT_075', 'BS003', 'CN_CG', '2026-06-10', 3),
('LT_076', 'BS004', 'CN_CG', '2026-06-10', 4),
('LT_077', 'BS016', 'CN_HBT', '2026-06-10', 1),
('LT_078', 'BS017', 'CN_HBT', '2026-06-10', 2),
('LT_079', 'BS018', 'CN_HBT', '2026-06-10', 3),
('LT_080', 'BS019', 'CN_HBT', '2026-06-10', 4),
('LT_081', 'BS005', 'CN_CG', '2026-06-11', 1),
('LT_082', 'BS006', 'CN_CG', '2026-06-11', 2),
('LT_083', 'BS007', 'CN_CG', '2026-06-11', 3),
('LT_084', 'BS008', 'CN_CG', '2026-06-11', 4),
('LT_085', 'BS020', 'CN_HBT', '2026-06-11', 1),
('LT_086', 'BS021', 'CN_HBT', '2026-06-11', 2),
('LT_087', 'BS022', 'CN_HBT', '2026-06-11', 3),
('LT_088', 'BS023', 'CN_HBT', '2026-06-11', 4),
('LT_089', 'BS009', 'CN_CG', '2026-06-12', 1),
('LT_090', 'BS010', 'CN_CG', '2026-06-12', 2),
('LT_091', 'BS011', 'CN_CG', '2026-06-12', 3),
('LT_092', 'BS012', 'CN_CG', '2026-06-12', 4),
('LT_093', 'BS013', 'CN_HBT', '2026-06-12', 1),
('LT_094', 'BS014', 'CN_HBT', '2026-06-12', 2),
('LT_095', 'BS015', 'CN_HBT', '2026-06-12', 3),
('LT_096', 'BS016', 'CN_HBT', '2026-06-12', 4),
('LT_097', 'BS001', 'CN_CG', '2026-06-13', 1),
('LT_098', 'BS002', 'CN_CG', '2026-06-13', 2),
('LT_099', 'BS003', 'CN_CG', '2026-06-13', 3),
('LT_100', 'BS004', 'CN_CG', '2026-06-13', 4),
('LT_101', 'BS017', 'CN_HBT', '2026-06-13', 1),
('LT_102', 'BS018', 'CN_HBT', '2026-06-13', 2),
('LT_103', 'BS019', 'CN_HBT', '2026-06-13', 3),
('LT_104', 'BS020', 'CN_HBT', '2026-06-13', 4),
('LT_105', 'BS005', 'CN_CG', '2026-06-14', 1),
('LT_106', 'BS006', 'CN_CG', '2026-06-14', 2),
('LT_107', 'BS007', 'CN_CG', '2026-06-14', 3),
('LT_108', 'BS008', 'CN_CG', '2026-06-14', 4),
('LT_109', 'BS021', 'CN_HBT', '2026-06-14', 1),
('LT_110', 'BS022', 'CN_HBT', '2026-06-14', 2),
('LT_111', 'BS023', 'CN_HBT', '2026-06-14', 3),
('LT_112', 'BS013', 'CN_HBT', '2026-06-14', 4),
('LT_113', 'BS009', 'CN_CG', '2026-06-15', 1),
('LT_114', 'BS010', 'CN_CG', '2026-06-15', 2),
('LT_115', 'BS011', 'CN_CG', '2026-06-15', 3),
('LT_116', 'BS012', 'CN_CG', '2026-06-15', 4),
('LT_117', 'BS014', 'CN_HBT', '2026-06-15', 1),
('LT_118', 'BS015', 'CN_HBT', '2026-06-15', 2),
('LT_119', 'BS016', 'CN_HBT', '2026-06-15', 3),
('LT_120', 'BS017', 'CN_HBT', '2026-06-15', 4),
('LT_121', 'BS001', 'CN_CG', '2026-06-16', 1),
('LT_122', 'BS002', 'CN_CG', '2026-06-16', 2),
('LT_123', 'BS003', 'CN_CG', '2026-06-16', 3),
('LT_124', 'BS004', 'CN_CG', '2026-06-16', 4),
('LT_125', 'BS018', 'CN_HBT', '2026-06-16', 1),
('LT_126', 'BS019', 'CN_HBT', '2026-06-16', 2),
('LT_127', 'BS020', 'CN_HBT', '2026-06-16', 3),
('LT_128', 'BS021', 'CN_HBT', '2026-06-16', 4),
('LT_129', 'BS005', 'CN_CG', '2026-06-17', 1),
('LT_130', 'BS006', 'CN_CG', '2026-06-17', 2),
('LT_131', 'BS007', 'CN_CG', '2026-06-17', 3),
('LT_132', 'BS008', 'CN_CG', '2026-06-17', 4),
('LT_133', 'BS022', 'CN_HBT', '2026-06-17', 1),
('LT_134', 'BS023', 'CN_HBT', '2026-06-17', 2),
('LT_135', 'BS013', 'CN_HBT', '2026-06-17', 3),
('LT_136', 'BS014', 'CN_HBT', '2026-06-17', 4),
('LT_137', 'BS009', 'CN_CG', '2026-06-18', 1),
('LT_138', 'BS010', 'CN_CG', '2026-06-18', 2),
('LT_139', 'BS011', 'CN_CG', '2026-06-18', 3),
('LT_140', 'BS012', 'CN_CG', '2026-06-18', 4),
('LT_141', 'BS015', 'CN_HBT', '2026-06-18', 1),
('LT_142', 'BS016', 'CN_HBT', '2026-06-18', 2),
('LT_143', 'BS017', 'CN_HBT', '2026-06-18', 3),
('LT_144', 'BS018', 'CN_HBT', '2026-06-18', 4),
('LT_145', 'BS001', 'CN_CG', '2026-06-19', 1),
('LT_146', 'BS002', 'CN_CG', '2026-06-19', 2),
('LT_147', 'BS003', 'CN_CG', '2026-06-19', 3),
('LT_148', 'BS004', 'CN_CG', '2026-06-19', 4),
('LT_149', 'BS019', 'CN_HBT', '2026-06-19', 1),
('LT_150', 'BS020', 'CN_HBT', '2026-06-19', 2),
('LT_151', 'BS021', 'CN_HBT', '2026-06-19', 3),
('LT_152', 'BS022', 'CN_HBT', '2026-06-19', 4),
('LT_153', 'BS005', 'CN_CG', '2026-06-20', 1),
('LT_154', 'BS006', 'CN_CG', '2026-06-20', 2),
('LT_155', 'BS007', 'CN_CG', '2026-06-20', 3),
('LT_156', 'BS008', 'CN_CG', '2026-06-20', 4),
('LT_157', 'BS023', 'CN_HBT', '2026-06-20', 1),
('LT_158', 'BS013', 'CN_HBT', '2026-06-20', 2),
('LT_159', 'BS014', 'CN_HBT', '2026-06-20', 3),
('LT_160', 'BS015', 'CN_HBT', '2026-06-20', 4),
('LT_161', 'BS009', 'CN_CG', '2026-06-21', 1),
('LT_162', 'BS010', 'CN_CG', '2026-06-21', 2),
('LT_163', 'BS011', 'CN_CG', '2026-06-21', 3),
('LT_164', 'BS012', 'CN_CG', '2026-06-21', 4),
('LT_165', 'BS016', 'CN_HBT', '2026-06-21', 1),
('LT_166', 'BS017', 'CN_HBT', '2026-06-21', 2),
('LT_167', 'BS018', 'CN_HBT', '2026-06-21', 3),
('LT_168', 'BS019', 'CN_HBT', '2026-06-21', 4),
('LT_169', 'BS001', 'CN_CG', '2026-06-22', 1),
('LT_170', 'BS002', 'CN_CG', '2026-06-22', 2),
('LT_171', 'BS003', 'CN_CG', '2026-06-22', 3),
('LT_172', 'BS004', 'CN_CG', '2026-06-22', 4),
('LT_173', 'BS020', 'CN_HBT', '2026-06-22', 1),
('LT_174', 'BS021', 'CN_HBT', '2026-06-22', 2),
('LT_175', 'BS022', 'CN_HBT', '2026-06-22', 3),
('LT_176', 'BS023', 'CN_HBT', '2026-06-22', 4),
('LT_177', 'BS005', 'CN_CG', '2026-06-23', 1),
('LT_178', 'BS006', 'CN_CG', '2026-06-23', 2),
('LT_179', 'BS007', 'CN_CG', '2026-06-23', 3),
('LT_180', 'BS008', 'CN_CG', '2026-06-23', 4),
('LT_181', 'BS013', 'CN_HBT', '2026-06-23', 1),
('LT_182', 'BS014', 'CN_HBT', '2026-06-23', 2),
('LT_183', 'BS015', 'CN_HBT', '2026-06-23', 3),
('LT_184', 'BS016', 'CN_HBT', '2026-06-23', 4),
('LT_185', 'BS009', 'CN_CG', '2026-06-24', 1),
('LT_186', 'BS010', 'CN_CG', '2026-06-24', 2),
('LT_187', 'BS011', 'CN_CG', '2026-06-24', 3),
('LT_188', 'BS012', 'CN_CG', '2026-06-24', 4),
('LT_189', 'BS017', 'CN_HBT', '2026-06-24', 1),
('LT_190', 'BS018', 'CN_HBT', '2026-06-24', 2),
('LT_191', 'BS019', 'CN_HBT', '2026-06-24', 3),
('LT_192', 'BS020', 'CN_HBT', '2026-06-24', 4),
('LT_193', 'BS001', 'CN_CG', '2026-06-25', 1),
('LT_194', 'BS002', 'CN_CG', '2026-06-25', 2),
('LT_195', 'BS003', 'CN_CG', '2026-06-25', 3),
('LT_196', 'BS004', 'CN_CG', '2026-06-25', 4),
('LT_197', 'BS021', 'CN_HBT', '2026-06-25', 1),
('LT_198', 'BS022', 'CN_HBT', '2026-06-25', 2),
('LT_199', 'BS023', 'CN_HBT', '2026-06-25', 3),
('LT_200', 'BS013', 'CN_HBT', '2026-06-25', 4),
('LT_201', 'BS005', 'CN_CG', '2026-06-26', 1),
('LT_202', 'BS006', 'CN_CG', '2026-06-26', 2),
('LT_203', 'BS007', 'CN_CG', '2026-06-26', 3),
('LT_204', 'BS008', 'CN_CG', '2026-06-26', 4),
('LT_205', 'BS014', 'CN_HBT', '2026-06-26', 1),
('LT_206', 'BS015', 'CN_HBT', '2026-06-26', 2),
('LT_207', 'BS016', 'CN_HBT', '2026-06-26', 3),
('LT_208', 'BS017', 'CN_HBT', '2026-06-26', 4),
('LT_209', 'BS009', 'CN_CG', '2026-06-27', 1),
('LT_210', 'BS010', 'CN_CG', '2026-06-27', 2),
('LT_211', 'BS011', 'CN_CG', '2026-06-27', 3),
('LT_212', 'BS012', 'CN_CG', '2026-06-27', 4),
('LT_213', 'BS018', 'CN_HBT', '2026-06-27', 1),
('LT_214', 'BS019', 'CN_HBT', '2026-06-27', 2),
('LT_215', 'BS020', 'CN_HBT', '2026-06-27', 3),
('LT_216', 'BS021', 'CN_HBT', '2026-06-27', 4),
('LT_217', 'BS001', 'CN_CG', '2026-06-28', 1),
('LT_218', 'BS002', 'CN_CG', '2026-06-28', 2),
('LT_219', 'BS003', 'CN_CG', '2026-06-28', 3),
('LT_220', 'BS004', 'CN_CG', '2026-06-28', 4),
('LT_221', 'BS022', 'CN_HBT', '2026-06-28', 1),
('LT_222', 'BS023', 'CN_HBT', '2026-06-28', 2),
('LT_223', 'BS013', 'CN_HBT', '2026-06-28', 3),
('LT_224', 'BS014', 'CN_HBT', '2026-06-28', 4),
('LT_225', 'BS005', 'CN_CG', '2026-06-29', 1),
('LT_226', 'BS006', 'CN_CG', '2026-06-29', 2),
('LT_227', 'BS007', 'CN_CG', '2026-06-29', 3),
('LT_228', 'BS008', 'CN_CG', '2026-06-29', 4),
('LT_229', 'BS015', 'CN_HBT', '2026-06-29', 1),
('LT_230', 'BS016', 'CN_HBT', '2026-06-29', 2),
('LT_231', 'BS017', 'CN_HBT', '2026-06-29', 3),
('LT_232', 'BS018', 'CN_HBT', '2026-06-29', 4),
('LT_233', 'BS009', 'CN_CG', '2026-06-30', 1),
('LT_234', 'BS010', 'CN_CG', '2026-06-30', 2),
('LT_235', 'BS011', 'CN_CG', '2026-06-30', 3),
('LT_236', 'BS012', 'CN_CG', '2026-06-30', 4),
('LT_237', 'BS019', 'CN_HBT', '2026-06-30', 1),
('LT_238', 'BS020', 'CN_HBT', '2026-06-30', 2),
('LT_239', 'BS021', 'CN_HBT', '2026-06-30', 3),
('LT_240', 'BS022', 'CN_HBT', '2026-06-30', 4),
('LT_241', 'BS001', 'CN_CG', '2026-07-01', 1),
('LT_242', 'BS002', 'CN_CG', '2026-07-01', 2),
('LT_243', 'BS003', 'CN_CG', '2026-07-01', 3),
('LT_244', 'BS004', 'CN_CG', '2026-07-01', 4),
('LT_245', 'BS023', 'CN_HBT', '2026-07-01', 1),
('LT_246', 'BS013', 'CN_HBT', '2026-07-01', 2),
('LT_247', 'BS014', 'CN_HBT', '2026-07-01', 3),
('LT_248', 'BS015', 'CN_HBT', '2026-07-01', 4);


-- 12. LỊCH HẸN (ĐÃ ĐỒNG BỘ MA_CAU_HINH THEO CHUẨN MỚI)
INSERT INTO LICH_HEN (MaLichHen, MaBenhAn, MaCauHinh, NgayKham, CaKham, STT, PaymentToken, GiaCuoi, TrangThai, MaLeTan, MaBacSi) VALUES 
('LH_001', 'BN001', 'CH_CG_DV_KHAM_NOI', '2026-06-01', 1, 1, 'TOK_PAID_001', 30000, 'Hoàn thành', 'LT001', 'BS001'),
('LH_002', 'BN002', 'CH_CG_DV_KHAM_RANG', '2026-06-01', 3, 1, 'TOK_PAID_002', 200000, 'Đã xác nhận', NULL, 'BS002'),
('LH_003', 'BN003', 'CH_CG_DV_KHAM_NOI', '2026-06-01', 2, 1, 'TOK_FREE_003', 0, 'Chờ khám', 'LT001', 'BS001'),
('LH_004', 'BN002', 'CH_CG_DV_KHAM_NOI', '2026-06-01', 2, 2, 'TOK_PAID_004', 150000, 'Hoàn thành', 'LT001', 'BS001'),
('LH_005', 'BN003', 'CH_HBT_DV_KHAM_TMH', '2026-06-01', 1, 1, 'TOK_FREE_005', 0, 'Hoàn thành', 'LT002', 'BS015');

-- 13. NHẬT KÝ THÔNG BÁO SMS
INSERT INTO LICH_SU_THONG_BAO (MaThongBao, MaLichHen, MaBenhAn, NoiDung, TrangThai, Loi, ThoiGianGui) VALUES 
('TB_001', 'LH_001', 'BN001', 'Smart Clinic: Lich hen Ma LH_001 cua ban da duoc thanh toan va xac nhan thanh cong.', 'Success', NULL, '2026-05-31 20:00:00'),
('TB_002', 'LH_002', 'BN002', 'Smart Clinic: Lich hen Ma LH_002 cua ban da duoc thanh toan va xac nhan thanh cong.', 'Success', NULL, '2026-05-31 21:15:00');

-- 14. LƯỢT KHÁM BÁC SĨ (Kết nối an toàn sau khi danh mục BENH đã được nạp)
INSERT INTO LUOT_KHAM (MaLuotKham, MaLichHen, MaBacSi, TrieuChung, LoiDan, MaBenh) VALUES 
('LK_001', 'LH_001', 'BS001', 'Đau rát vùng thượng vị theo chu kỳ, đầy hơi sau ăn', 'Ăn uống đúng giờ, kiêng đồ chua cay, không uống bia rượu. Nghỉ ngroi hợp lý.', 'K29'),
('LK_002', 'LH_004', 'BS001', 'Đau đầu âm ỉ vùng gáy, chóng mặt khi đứng dậy', 'Đo huyết áp hàng ngày, hạn chế ăn mặn, giảm căng thẳng.', 'I10'),
('LK_003', 'LH_005', 'BS015', 'Ho có đờm đặc, đau rát họng, sốt nhẹ về chiều', 'Uống nhiều nước ấm, súc họng nước muối hàng ngày, giữ ấm cổ.', 'J20');

-- 15. CHI TIẾT ĐƠN THUỐC
INSERT INTO CHI_TIET_DON_THUOC (MaDonThuoc, MaLuotKham, MaThuoc, SoLuong, LieuDung) VALUES 
('MDT_001', 'LK_001', 'TH_OMEPRAZOLE', 14, 'Uống 1 viên trước khi ăn sáng 30 phút'),
('MDT_002', 'LK_001', 'TH_PARACETAMOL', 10, 'Uống 1 viên khi đau nhiều hoặc sốt trên 38.5 độ'),
('MDT_003', 'LK_002', 'TH_AMLODIPINE', 30, 'Uống 1 viên vào buổi sáng sau ăn cố định giờ'),
('MDT_004', 'LK_002', 'TH_PANADOL_EXTRA', 10, 'Uống 1 viên khi đau đầu nhiều, cách tối thiểu 4-6 tiếng'),
('MDT_005', 'LK_003', 'TH_CEFUROXIME', 14, 'Uống ngày 2 lần, mỗi lần 1 viên sau ăn sáng/tối'),
('MDT_006', 'LK_003', 'TH_ACEMUC', 20, 'Uống ngày 2 lần, mỗi lần 1 gói hòa tan với nước ấm');                     

-- 16. KẾT QUẢ XÉT NGHIỆM
INSERT INTO CHI_TIET_XET_NGHIEM (MaChiTietXN, MaLuotKham, MaDichVu, KetQuaXetNghiem, MaXNV, GiaCuoi, PaymentToken, TrangThaiXetNghiem) VALUES 
('CTXN_001', 'LK_001', 'XN_MAU', 'Số lượng hồng cầu ổn định, bạch cầu tăng nhẹ (10.8 giga/L). Nghi ngờ có ổ viêm nhiễm.', 'XNV001', 50000, 'TOK_LAB_001', 'Đã có kết quả');

-- 17. LỊCH TRÌNH ĐIỀU TRỊ TRONG TƯƠNG LAI (Mục này giữ nguyên vì map theo MaLuotKham)
INSERT INTO LICH_TRINH_DIEU_TRI (MaLichTrinh, MaLuotKham, MaDichVu, BuoiSo, NgayThucHien, CaKham, TrangThai) VALUES 
('LTDT_001', 'LK_001', 'DT_RANG_TUY', 1, '2026-06-02', 3, 'Hoàn thành'),
('LTDT_002', 'LK_001', 'DT_RANG_TUY', 2, '2026-06-05', 2, 'Đã đặt lịch'),
('LTDT_003', 'LK_001', 'DT_RANG_TUY', 3, NULL, NULL, 'Chưa đặt lịch');

""")
conn.commit()

# Kiểm tra bảng trước khi close
cursor.execute("""
    SELECT name
    FROM sqlite_master
    WHERE type='table';
""")

tables = cursor.fetchall()

print("✔ hospital.db created successfully")
print("Path:", DB_PATH)

print("\nDanh sách bảng:")
for table in tables:
    print("-", table[0])

conn.close()
