import uuid

from check_db import get_connection


async def get_tests_by_branch(ma_chi_nhanh: str):

    conn = await get_connection()

    try:

        cursor = await conn.execute("""
            SELECT
                CTXN.MaChiTietXN,
                CTXN.MaLuotKham,
                CTXN.MaDichVu,
                DV.TenDichVu,
                DV.GiaGoc,
                CAST(DV.GiaGoc * COALESCE(BHYT.TyLeHuong, 0) AS SIGNED) AS BHYTGiamTru,
                CAST(DV.GiaGoc * (1 - COALESCE(BHYT.TyLeHuong, 0)) AS SIGNED) AS GiaCuoiThucTra,
                CTXN.TrangThaiXetNghiem,
                CTXN.PaymentToken,
                CTXN.GiaCuoi,
                CTXN.KetQuaXetNghiem,
                CTXN.MaXNV,
                BN.MaBenhAn,
                BN.HoTen,
                BN.CCCD,
                BN.SDT,
                LH.MaLichHen,
                LH.NgayKham,
                LH.CaKham,
                LH.MaBacSi,
                CNDV.MaChiNhanh,
                BS.HoTen AS TenBacSi,
                BHYT.TyLeHuong
            FROM chi_tiet_xet_nghiem CTXN
            JOIN luot_kham LK
                ON CTXN.MaLuotKham = LK.MaLuotKham
            JOIN lich_hen LH
                ON LK.MaLichHen = LH.MaLichHen
            JOIN benh_nhan BN
                ON LH.MaBenhAn = BN.MaBenhAn
            LEFT JOIN danh_muc_bhyt BHYT
                ON BN.KyTuDauBHYT = BHYT.KyTuDauBHYT
            JOIN dich_vu DV
                ON CTXN.MaDichVu = DV.MaDichVu
            JOIN bac_si BS
                ON LK.MaBacSi = BS.MaBacSi
            JOIN chi_nhanh_dich_vu CNDV
                ON LH.MaCauHinh = CNDV.MaCauHinh
            WHERE CNDV.MaChiNhanh = %s
            ORDER BY LH.NgayKham DESC, LH.CaKham DESC, BN.HoTen
        """, (ma_chi_nhanh,))

        rows = await cursor.fetchall()

        return {
            "success": True,
            "message": "Danh sách xét nghiệm theo chi nhánh.",
            "data": [dict(row) for row in rows],
        }

    finally:
        await conn.close()


async def get_pending_tests(ma_chi_nhanh: str):

    conn = await get_connection()

    try:

        cursor = await conn.execute("""
            SELECT
                CTXN.MaChiTietXN,
                CTXN.MaLuotKham,
                CTXN.MaDichVu,
                DV.TenDichVu,
                DV.GiaGoc,
                CAST(DV.GiaGoc * COALESCE(BHYT.TyLeHuong, 0) AS SIGNED) AS BHYTGiamTru,
                CAST(DV.GiaGoc * (1 - COALESCE(BHYT.TyLeHuong, 0)) AS SIGNED) AS GiaCuoiThucTra,
                CTXN.TrangThaiXetNghiem,
                CTXN.PaymentToken,
                CTXN.GiaCuoi,
                BN.MaBenhAn,
                BN.HoTen,
                LH.MaLichHen,
                LH.MaBacSi,
                CNDV.MaChiNhanh,
                BS.HoTen AS TenBacSi,
                BHYT.TyLeHuong
            FROM chi_tiet_xet_nghiem CTXN
            JOIN luot_kham LK
                ON CTXN.MaLuotKham = LK.MaLuotKham
            JOIN lich_hen LH
                ON LK.MaLichHen = LH.MaLichHen
            JOIN benh_nhan BN
                ON LH.MaBenhAn = BN.MaBenhAn
            LEFT JOIN danh_muc_bhyt BHYT
                ON BN.KyTuDauBHYT = BHYT.KyTuDauBHYT
            JOIN dich_vu DV
                ON CTXN.MaDichVu = DV.MaDichVu
            JOIN bac_si BS
                ON LK.MaBacSi = BS.MaBacSi
            JOIN chi_nhanh_dich_vu CNDV
                ON LH.MaCauHinh = CNDV.MaCauHinh
            WHERE
                CTXN.TrangThaiXetNghiem = 'Chưa thực hiện'
                AND CNDV.MaChiNhanh = %s
            ORDER BY LH.NgayKham, LH.CaKham, BN.HoTen
        """, (ma_chi_nhanh,))

        rows = await cursor.fetchall()

        if not rows:
            return {
                "success": True,
                "message": "Không có yêu cầu xét nghiệm mới.",
                "data": []
            }

        return {
            "success": True,
            "message": "Danh sách yêu cầu xét nghiệm.",
            "data": [dict(row) for row in rows]
        }

    finally:
        await conn.close()

async def accept_test_request(ma_chi_tiet_xn: str, ma_chi_nhanh: str):

    conn = await get_connection()

    try:

        cursor = await conn.execute("""
            SELECT CTXN.*, CNDV.MaChiNhanh
            FROM chi_tiet_xet_nghiem CTXN
            JOIN luot_kham LK
                ON CTXN.MaLuotKham = LK.MaLuotKham
            JOIN lich_hen LH
                ON LK.MaLichHen = LH.MaLichHen
            JOIN chi_nhanh_dich_vu CNDV
                ON LH.MaCauHinh = CNDV.MaCauHinh
            WHERE CTXN.MaChiTietXN = %s
        """, (ma_chi_tiet_xn,))

        req = await cursor.fetchone()

        if not req:
            return {
                "success": False,
                "message": "Yêu cầu xét nghiệm không tồn tại.",
                "data": None
            }

        if req["MaChiNhanh"] != ma_chi_nhanh:
            return {
                "success": False,
                "message": "Xét nghiệm viên không có quyền nhận ca của chi nhánh khác.",
                "data": None
            }

        if req["TrangThaiXetNghiem"] != "Chưa thực hiện":
            return {
                "success": False,
                "message": "Yêu cầu không hợp lệ.",
                "data": None
            }

        payment_token = req["PaymentToken"] or f"PAY_LAB_{uuid.uuid4().hex[:10].upper()}"

        price_cursor = await conn.execute("""
            SELECT
                DV.GiaGoc,
                CAST(DV.GiaGoc * (1 - COALESCE(BHYT.TyLeHuong, 0)) AS SIGNED) AS GiaCuoiThucTra
            FROM chi_tiet_xet_nghiem CTXN
            JOIN luot_kham LK
                ON CTXN.MaLuotKham = LK.MaLuotKham
            JOIN lich_hen LH
                ON LK.MaLichHen = LH.MaLichHen
            JOIN benh_nhan BN
                ON LH.MaBenhAn = BN.MaBenhAn
            LEFT JOIN danh_muc_bhyt BHYT
                ON BN.KyTuDauBHYT = BHYT.KyTuDauBHYT
            JOIN dich_vu DV
                ON CTXN.MaDichVu = DV.MaDichVu
            WHERE CTXN.MaChiTietXN = %s
        """, (ma_chi_tiet_xn,))
        price_row = await price_cursor.fetchone()
        gia_cuoi = price_row["GiaCuoiThucTra"] if price_row else req.get("GiaCuoi")

        await conn.execute("""
            UPDATE chi_tiet_xet_nghiem
            SET PaymentToken = %s,
                GiaCuoi = %s
            WHERE MaChiTietXN = %s
        """, (
            payment_token,
            gia_cuoi,
            ma_chi_tiet_xn,
        ))

        await conn.commit()

        return {
            "success": True,
            "message": "Đã ghi nhận thanh toán xét nghiệm.",
            "data": {
                "MaChiTietXN": ma_chi_tiet_xn,
                "TrangThaiMoi": "Chưa thực hiện",
                "PaymentToken": payment_token,
                "GiaCuoi": gia_cuoi
            }
        }

    except Exception as e:

        await conn.rollback()

        return {
            "success": False,
            "message": str(e),
            "data": None
        }

    finally:
        await conn.close()

async def update_test_result(
    ma_chi_tiet_xn: str,
    ket_qua: str,
    ghi_chu: str = None,
    ma_xnv: str = None,
    ma_chi_nhanh: str = None,
):

    if not ket_qua:
        return {
            "success": False,
            "message": "Thiếu thông tin kết quả xét nghiệm.",
            "data": None
        }

    conn = await get_connection()

    try:

        cursor = await conn.execute("""
            SELECT CTXN.*, CNDV.MaChiNhanh
            FROM chi_tiet_xet_nghiem CTXN
            JOIN luot_kham LK
                ON CTXN.MaLuotKham = LK.MaLuotKham
            JOIN lich_hen LH
                ON LK.MaLichHen = LH.MaLichHen
            JOIN chi_nhanh_dich_vu CNDV
                ON LH.MaCauHinh = CNDV.MaCauHinh
            WHERE CTXN.MaChiTietXN = %s
        """, (ma_chi_tiet_xn,))

        req = await cursor.fetchone()

        if not req:
            return {
                "success": False,
                "message": "Yêu cầu xét nghiệm không tồn tại.",
                "data": None
            }

        if ma_chi_nhanh and req["MaChiNhanh"] != ma_chi_nhanh:
            return {
                "success": False,
                "message": "Xét nghiệm viên không có quyền trả kết quả ca của chi nhánh khác.",
                "data": None
            }

        if req["TrangThaiXetNghiem"] not in ("Chưa thực hiện", "Đã có kết quả"):
            return {
                "success": False,
                "message": "Trạng thái không hợp lệ.",
                "data": None
            }

        await conn.execute("""
            UPDATE chi_tiet_xet_nghiem
            SET KetQuaXetNghiem = %s,
                TrangThaiXetNghiem = 'Đã có kết quả',
                MaXNV = COALESCE(%s, MaXNV)
            WHERE MaChiTietXN = %s
        """, (
            ket_qua,
            ma_xnv,
            ma_chi_tiet_xn
        ))

        await conn.commit()

        return {
            "success": True,
            "message": "Cập nhật kết quả xét nghiệm thành công.",
            "data": {
                "MaChiTietXN": ma_chi_tiet_xn,
                "TrangThaiMoi": "Đã có kết quả",
                "MaXNV": ma_xnv
            }
        }

    except Exception as e:

        await conn.rollback()

        return {
            "success": False,
            "message": str(e),
            "data": None
        }

    finally:
        await conn.close()

async def get_test_detail(ma_chi_tiet_xn: str):
    conn = await get_connection()

    try:
        cursor = await conn.execute("""
            SELECT
                CTXN.*,

                -- Thông tin dịch vụ xét nghiệm
                DV_XN.TenDichVu,
                DV_XN.ChuyenKhoa,
                DV_XN.LoaiDichVu,
                DV_XN.GiaGoc,

                -- Thông tin lịch hẹn
                LH.MaLichHen,
                LH.NgayKham,
                LH.CaKham,
                LH.TrangThai AS TrangThaiLichHen,

                -- Thông tin bệnh nhân
                BN.MaBenhAn,
                BN.HoTen AS TenBenhNhan,
                BN.NgaySinh,
                BN.GioiTinh,
                BN.SDT AS SDTBenhNhan,

                -- Thông tin Bác sĩ chỉ định (Tìm qua Lịch trực & Cấu hình dịch vụ)
                BS.MaBacSi,
                BS.HoTen AS TenBacSi,
                BS.ChuyenKhoa AS ChuyenKhoaBacSi,

                -- Thông tin Xét nghiệm viên thực hiện
                XNV.MaXNV,
                XNV.HoTen AS TenXetNghiemVien,
                XNV.SDT AS SDTXNV

            FROM chi_tiet_xet_nghiem CTXN

            JOIN luot_kham LK
                ON CTXN.MaLuotKham = LK.MaLuotKham

            JOIN lich_hen LH
                ON LK.MaLichHen = LH.MaLichHen

            JOIN benh_nhan BN
                ON LH.MaBenhAn = BN.MaBenhAn

            -- Dịch vụ CỦA XÉT NGHIỆM
            JOIN dich_vu DV_XN
                ON CTXN.MaDichVu = DV_XN.MaDichVu

            -- TÌM BÁC SĨ CHỈ ĐỊNH
            -- 1. Lấy cấu hình dịch vụ khám ban đầu từ Lịch Hẹn
            JOIN chi_nhanh_dich_vu CNDV
                ON LH.MaCauHinh = CNDV.MaCauHinh
            -- 2. Lấy chi tiết dịch vụ khám để biết Chuyên Khoa
            JOIN dich_vu DV_KHAM
                ON CNDV.MaDichVu = DV_KHAM.MaDichVu
            -- 3. Map với Lịch trực cùng Ngày, cùng Ca, cùng Chi nhánh
            JOIN lich_truc LTR
                ON CNDV.MaChiNhanh = LTR.MaChiNhanh
                AND LH.NgayKham = LTR.NgayTruc
                AND LH.CaKham = LTR.CaTruc
            -- 4. Map Bác sĩ trong ca trực đó (phải đúng chuyên khoa khám)
            JOIN bac_si BS
                ON LTR.MaBacSi = BS.MaBacSi
                AND BS.ChuyenKhoa = DV_KHAM.ChuyenKhoa

            -- Xét nghiệm viên (Dùng LEFT JOIN vì có thể chưa thực hiện)
            LEFT JOIN xet_nghiem_vien XNV
                ON CTXN.MaXNV = XNV.MaXNV

            WHERE CTXN.MaChiTietXN = %s
        """, (ma_chi_tiet_xn,))

        row = await cursor.fetchone()

        if not row:
            return {
                "success": False,
                "message": "Không tìm thấy yêu cầu xét nghiệm.",
                "data": None
            }

        return {
            "success": True,
            "message": "Chi tiết xét nghiệm.",
            "data": dict(row)
        }

    finally:
        await conn.close()
