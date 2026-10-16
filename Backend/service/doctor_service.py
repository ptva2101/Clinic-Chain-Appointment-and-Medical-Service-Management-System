import datetime
import uuid
from check_db import get_connection


async def generate_next_visit_id(conn):
    cursor = await conn.execute("""
        SELECT MaLuotKham
        FROM luot_kham
        WHERE MaLuotKham REGEXP '^LK_[0-9]+$'
        ORDER BY CAST(SUBSTRING(MaLuotKham, 4) AS UNSIGNED) DESC
        LIMIT 1
    """)
    last_lk = await cursor.fetchone()

    next_number = 1
    if last_lk and last_lk.get("MaLuotKham"):
        try:
            next_number = int(last_lk["MaLuotKham"].split("_", 1)[1]) + 1
        except (IndexError, TypeError, ValueError):
            next_number = 1

    for offset in range(1000):
        candidate = f"LK_{next_number + offset:03d}"
        exists_cursor = await conn.execute(
            "SELECT MaLuotKham FROM luot_kham WHERE MaLuotKham = %s LIMIT 1",
            (candidate,),
        )
        if not await exists_cursor.fetchone():
            return candidate

    return f"LK_{uuid.uuid4().hex[:8].upper()}"


async def normalize_disease_id(conn, ma_benh):
    if ma_benh in ["string", "", " ", None]:
        return None

    disease_id = str(ma_benh).strip()
    cursor = await conn.execute(
        "SELECT MaBenh FROM benh WHERE MaBenh = %s LIMIT 1",
        (disease_id,),
    )
    if await cursor.fetchone():
        return disease_id

    raise ValueError(
        f"Mã bệnh '{disease_id}' không tồn tại trong danh mục benh. "
        "Vui lòng chọn chẩn đoán từ danh sách gợi ý."
    )


async def get_patients_by_date(ma_bac_si: str, ngay_kham: str):
    conn = await get_connection()
    try:
        cursor = await conn.execute("""
            SELECT
                LH.MaLichHen, LH.NgayKham, LH.CaKham, LH.STT, LH.TrangThai, LH.GiaCuoi, LH.PaymentToken,
                LH.MaBacSi,
                BN.MaBenhAn, BN.HoTen AS TenBenhNhan, BN.GioiTinh, BN.NgaySinh, BN.SDT AS SDTBenhNhan, BN.DiaChi, BN.MaSoBHYT,
                BHYT.KyTuDauBHYT, BHYT.DoiTuongChinhSach, BHYT.TyLeHuong,
                DV.MaDichVu, DV.TenDichVu, DV.ChuyenKhoa, DV.GiaGoc,
                CN.MaChiNhanh, CN.TenChiNhanh
            FROM lich_hen LH
            JOIN benh_nhan BN ON LH.MaBenhAn = BN.MaBenhAn
            LEFT JOIN danh_muc_bhyt BHYT ON BN.KyTuDauBHYT = BHYT.KyTuDauBHYT
            JOIN chi_nhanh_dich_vu CNDV ON LH.MaCauHinh = CNDV.MaCauHinh
            JOIN dich_vu DV ON CNDV.MaDichVu = DV.MaDichVu
            JOIN chi_nhanh CN ON CNDV.MaChiNhanh = CN.MaChiNhanh
            WHERE LH.MaBacSi = %s AND LH.NgayKham = %s
            ORDER BY LH.CaKham, LH.STT
        """, (ma_bac_si, ngay_kham))

        rows = await cursor.fetchall()

        if not rows:
            return {"success": False, "message": "Không có bệnh nhân nào trong ngày này.", "data": []}

        return {"success": True, "message": "Lấy danh sách bệnh nhân thành công.", "data": [dict(row) for row in rows]}
    finally:
        await conn.close()


async def get_doctor_queue(ma_bac_si: str):
    conn = await get_connection()
    try:
        cursor = await conn.execute(
            """
            SELECT
                LH.MaLichHen,
                LH.NgayKham,
                LH.CaKham,
                LH.STT,
                LH.TrangThai,
                LH.GiaCuoi,
                LH.PaymentToken,
                LH.MaBacSi,
                LH.MaLeTan,
                LK.MaLuotKham,
                BN.MaBenhAn,
                BN.HoTen AS TenBenhNhan,
                BN.GioiTinh,
                BN.NgaySinh,
                BN.CCCD,
                BN.SDT AS SDTBenhNhan,
                BN.DiaChi,
                DV.MaDichVu,
                DV.TenDichVu,
                DV.ChuyenKhoa,
                DV.LoaiDichVu,
                CN.MaChiNhanh,
                CN.TenChiNhanh
            FROM lich_hen LH
            JOIN benh_nhan BN
                ON LH.MaBenhAn = BN.MaBenhAn
            JOIN chi_nhanh_dich_vu CNDV
                ON LH.MaCauHinh = CNDV.MaCauHinh
            JOIN dich_vu DV
                ON CNDV.MaDichVu = DV.MaDichVu
            JOIN chi_nhanh CN
                ON CNDV.MaChiNhanh = CN.MaChiNhanh
            LEFT JOIN luot_kham LK
                ON LH.MaLichHen = LK.MaLichHen
            WHERE
                LH.MaBacSi = %s
                AND LH.TrangThai IN ('Chờ khám', 'Chờ kết luận', 'Đang khám')
                AND LH.MaLeTan IS NOT NULL
                AND LH.MaLeTan != ''
            ORDER BY LH.NgayKham, LH.CaKham, LH.STT
            """,
            (ma_bac_si,),
        )
        rows = await cursor.fetchall()

        return {
            "success": True,
            "message": "Lấy hàng đợi bác sĩ thành công.",
            "data": [dict(row) for row in rows],
        }
    finally:
        await conn.close()


async def complete_treatment_session(ma_lich_hen: str, ma_bac_si: str):
    conn = await get_connection()
    try:
        cursor = await conn.execute("""
            SELECT
                LH.MaLichHen,
                LH.MaBacSi,
                LH.TrangThai,
                LH.MaBenhAn,
                LH.NgayKham,
                LH.CaKham,
                LH.STT,
                LH.GiaCuoi,
                LH.PaymentToken,
                CNDV.MaChiNhanh,
                CN.TenChiNhanh,
                DV.MaDichVu,
                DV.TenDichVu,
                DV.LoaiDichVu,
                LTDT.MaLichTrinh,
                LTDT.MaLuotKham,
                LTDT.BuoiSo,
                LTDT.TrangThai AS TrangThaiDieuTri
            FROM lich_hen LH
            JOIN chi_nhanh_dich_vu CNDV
                ON LH.MaCauHinh = CNDV.MaCauHinh
            JOIN chi_nhanh CN
                ON CNDV.MaChiNhanh = CN.MaChiNhanh
            JOIN dich_vu DV
                ON CNDV.MaDichVu = DV.MaDichVu
            LEFT JOIN lich_trinh_dieu_tri LTDT
                ON LH.MaLichHen = LTDT.MaLichHen
            WHERE
                LH.MaLichHen = %s
                AND LH.MaBacSi = %s
            LIMIT 1
        """, (ma_lich_hen, ma_bac_si))
        row = await cursor.fetchone()

        if not row:
            return {
                "success": False,
                "message": "Không tìm thấy lịch hẹn điều trị thuộc bác sĩ hiện tại.",
                "data": None,
            }

        if row["LoaiDichVu"] != "Điều trị":
            return {
                "success": False,
                "message": "Lịch hẹn này không phải dịch vụ điều trị.",
                "data": None,
            }

        if not row.get("MaLichTrinh"):
            return {
                "success": False,
                "message": "Không tìm thấy buổi điều trị liên kết với lịch hẹn này.",
                "data": None,
            }

        await conn.execute("""
            UPDATE lich_hen
            SET TrangThai = 'Hoàn thành'
            WHERE MaLichHen = %s
        """, (ma_lich_hen,))

        await conn.execute("""
            UPDATE lich_trinh_dieu_tri
            SET TrangThai = 'Hoàn thành'
            WHERE MaLichHen = %s
        """, (ma_lich_hen,))

        await conn.commit()

        row["TrangThai"] = "Hoàn thành"
        row["TrangThaiDieuTri"] = "Hoàn thành"
        return {
            "success": True,
            "message": "Đã hoàn thành buổi điều trị.",
            "data": dict(row),
        }
    except Exception as exc:
        await conn.rollback()
        return {"success": False, "message": str(exc), "data": None}
    finally:
        await conn.close()


async def update_appointment_status(ma_lich_hen: str, trang_thai: str):
    valid_statuses = [
        "Chờ khám",
        "Đang khám",
        "Chờ kết luận",
        "Hoàn thành",
        "Đã hủy",
    ]
    if trang_thai not in valid_statuses:
        return {"success": False, "message": "Trạng thái không hợp lệ.", "data": None}

    conn = await get_connection()
    try:
        cursor = await conn.execute(
            "UPDATE lich_hen SET TrangThai = %s WHERE MaLichHen = %s",
            (trang_thai, ma_lich_hen)
        )

        if cursor.rowcount == 0:
            exists_cursor = await conn.execute(
                "SELECT MaLichHen FROM lich_hen WHERE MaLichHen = %s",
                (ma_lich_hen,),
            )
            if not await exists_cursor.fetchone():
                return {"success": False, "message": "Không tìm thấy lịch hẹn.", "data": None}

        await conn.commit()

        # Sau khi update, lấy lại toàn bộ thông tin lịch hẹn để trả về
        cursor_lh = await conn.execute("""
            SELECT LH.*, BN.HoTen, BN.SDT
            FROM lich_hen LH
            JOIN benh_nhan BN ON LH.MaBenhAn = BN.MaBenhAn
            WHERE MaLichHen = %s
        """, (ma_lich_hen,))
        updated_row = await cursor_lh.fetchone()

        return {
            "success": True,
            "message": f"Đã cập nhật trạng thái thành {trang_thai}.",
            "data": dict(updated_row)
        }
    except Exception as e:
        await conn.rollback()
        return {"success": False, "message": str(e), "data": None}
    finally:
        await conn.close()


async def save_examination_record(exam_data: dict):
    conn = await get_connection()
    try:
        ma_lich_hen = exam_data.get('ma_lich_hen')
        is_draft = exam_data.get('is_draft', False)
        ma_benh = exam_data.get('ma_benh')
        ma_bac_si = exam_data.get('ma_bac_si')
        if not ma_bac_si:
            doctor_cursor = await conn.execute(
                "SELECT MaBacSi FROM lich_hen WHERE MaLichHen = %s",
                (ma_lich_hen,),
            )
            doctor_row = await doctor_cursor.fetchone()
            ma_bac_si = doctor_row["MaBacSi"] if doctor_row else None

        ma_benh = await normalize_disease_id(conn, ma_benh)

        xet_nghiem_hop_le = []
        for xn in (exam_data.get('xet_nghiem') or []):
            if xn.get('ma_dich_vu') not in ["string", "", " ", None]:
                xet_nghiem_hop_le.append(xn)

        don_thuoc_hop_le = []
        for t in (exam_data.get('don_thuoc') or []):
            if t.get('ma_thuoc') not in ["string", "", " ", None]:
                t['so_luong'] = max(1, t.get('so_luong', 1))
                don_thuoc_hop_le.append(t)

        dieu_tri_hop_le = []
        for dt in (exam_data.get('dieu_tri') or []):
            if dt.get('ma_dich_vu') not in ["string", "", " ", None]:
                dt['so_buoi'] = max(1, dt.get('so_buoi', 1))
                dieu_tri_hop_le.append(dt)
        cursor = await conn.execute("SELECT MaLuotKham FROM luot_kham WHERE MaLichHen = %s", (ma_lich_hen,))
        row = await cursor.fetchone()
        existing_lab_service_ids = set()

        if row:
            ma_luot_kham = row["MaLuotKham"]
            await conn.execute("""
                UPDATE luot_kham
                SET TrieuChung = %s, LoiDan = %s, MaBenh = %s
                WHERE MaLuotKham = %s
            """, (exam_data.get('trieu_chung'), exam_data.get('loi_dan'), ma_benh, ma_luot_kham))

            existing_lab_cursor = await conn.execute(
                "SELECT MaDichVu FROM chi_tiet_xet_nghiem WHERE MaLuotKham = %s",
                (ma_luot_kham,),
            )
            existing_lab_service_ids = {
                lab_row["MaDichVu"]
                for lab_row in await existing_lab_cursor.fetchall()
            }
            await conn.execute("DELETE FROM chi_tiet_don_thuoc WHERE MaLuotKham = %s", (ma_luot_kham,))
            await conn.execute("DELETE FROM lich_trinh_dieu_tri WHERE MaLuotKham = %s", (ma_luot_kham,))
        else:
            ma_luot_kham = await generate_next_visit_id(conn)

            await conn.execute("""
                INSERT INTO luot_kham (MaLuotKham, MaLichHen, MaBacSi, TrieuChung, LoiDan, MaBenh)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                ma_luot_kham,
                ma_lich_hen,
                ma_bac_si,
                exam_data.get('trieu_chung'),
                exam_data.get('loi_dan'),
                ma_benh,
            ))

        for xn in xet_nghiem_hop_le:
            if xn['ma_dich_vu'] in existing_lab_service_ids:
                continue

            ma_ctxn = f"CTXN_{uuid.uuid4().hex[:6].upper()}"
            price_cursor = await conn.execute("""
                SELECT
                    CAST(DV.GiaGoc * (1 - COALESCE(BHYT.TyLeHuong, 0)) AS SIGNED) AS GiaCuoi
                FROM lich_hen LH
                JOIN benh_nhan BN
                    ON LH.MaBenhAn = BN.MaBenhAn
                LEFT JOIN danh_muc_bhyt BHYT
                    ON BN.KyTuDauBHYT = BHYT.KyTuDauBHYT
                JOIN dich_vu DV
                    ON DV.MaDichVu = %s
                WHERE LH.MaLichHen = %s
            """, (xn['ma_dich_vu'], ma_lich_hen))
            price_row = await price_cursor.fetchone()
            gia_cuoi_xn = price_row["GiaCuoi"] if price_row else 0
            await conn.execute("""
                INSERT INTO chi_tiet_xet_nghiem (
                    MaChiTietXN,
                    MaLuotKham,
                    MaDichVu,
                    TrangThaiXetNghiem,
                    GiaCuoi
                )
                VALUES (%s, %s, %s, 'Chưa thực hiện', %s)
            """, (ma_ctxn, ma_luot_kham, xn['ma_dich_vu'], gia_cuoi_xn))

        for thuoc in don_thuoc_hop_le:
            ma_don_thuoc = f"MDT_{uuid.uuid4().hex[:6].upper()}"
            await conn.execute("""
                INSERT INTO chi_tiet_don_thuoc (MaDonThuoc, MaLuotKham, MaThuoc, SoLuong, LieuDung)
                VALUES (%s, %s, %s, %s, %s)
            """, (ma_don_thuoc, ma_luot_kham, thuoc['ma_thuoc'], thuoc['so_luong'], thuoc['lieu_dung']))

        for dt in dieu_tri_hop_le:
            for buoi in range(1, dt['so_buoi'] + 1):
                ma_lt = f"LTDT_{uuid.uuid4().hex[:6].upper()}"
                await conn.execute("""
                    INSERT INTO lich_trinh_dieu_tri (MaLichTrinh, MaLuotKham, MaDichVu, BuoiSo, TrangThai)
                    VALUES (%s, %s, %s, %s, 'Chưa đặt lịch')
                """, (ma_lt, ma_luot_kham, dt['ma_dich_vu'], buoi))

        next_status = "Hoàn thành"
        if is_draft:
            next_status = "Chờ kết luận" if xet_nghiem_hop_le else "Đang khám"

        await conn.execute("UPDATE lich_hen SET TrangThai = %s WHERE MaLichHen = %s", (next_status, ma_lich_hen))

        if next_status == "Hoàn thành":
            await conn.execute("""
                UPDATE lich_trinh_dieu_tri
                SET TrangThai = 'Hoàn thành'
                WHERE MaLichHen = %s
            """, (ma_lich_hen,))

        await conn.commit()
        response_data = {
            "MaLuotKham": ma_luot_kham,
            "MaLichHen": ma_lich_hen,
            "TrieuChung": exam_data.get('trieu_chung') or "",
            "LoiDan": exam_data.get('loi_dan') or "",
            "MaBenh": ma_benh or "",
            "TrangThai": next_status
        }

        if xet_nghiem_hop_le:
            cur_xn = await conn.execute("""
                SELECT
                    CTXN.MaChiTietXN,
                    DV.MaDichVu,
                    DV.TenDichVu,
                    CTXN.KetQuaXetNghiem,
                    CTXN.MaXNV,
                    CTXN.PaymentToken,
                    CTXN.GiaCuoi,
                    CTXN.TrangThaiXetNghiem
                FROM chi_tiet_xet_nghiem CTXN
                JOIN dich_vu DV
                    ON CTXN.MaDichVu = DV.MaDichVu
                WHERE CTXN.MaLuotKham = %s
            """, (ma_luot_kham,))
            response_data["XetNghiem"] = [dict(x) for x in await cur_xn.fetchall()]
        else:
            response_data["XetNghiem"] = []

        if don_thuoc_hop_le:
            cur_thuoc = await conn.execute("""
                SELECT CTDT.MaDonThuoc, T.MaThuoc, T.TenThuoc, CTDT.SoLuong, CTDT.LieuDung
                FROM chi_tiet_don_thuoc CTDT JOIN thuoc T ON CTDT.MaThuoc = T.MaThuoc WHERE CTDT.MaLuotKham = %s
            """, (ma_luot_kham,))
            response_data["DonThuoc"] = [dict(t) for t in await cur_thuoc.fetchall()]
        else:
            response_data["DonThuoc"] = []

        cur_dt = await conn.execute("""
            SELECT
                LTDT.MaLichTrinh,
                LTDT.MaLichHen,
                LTDT.MaLuotKham,
                DV.MaDichVu,
                DV.TenDichVu,
                LTDT.BuoiSo,
                LTDT.NgayThucHien,
                LTDT.CaKham,
                LTDT.TrangThai
            FROM lich_trinh_dieu_tri LTDT
            JOIN dich_vu DV
                ON LTDT.MaDichVu = DV.MaDichVu
            WHERE
                LTDT.MaLuotKham = %s
                OR LTDT.MaLichHen = %s
            ORDER BY DV.MaDichVu, LTDT.BuoiSo
        """, (ma_luot_kham, ma_lich_hen))
        response_data["DieuTri"] = [dict(d) for d in await cur_dt.fetchall()]

        return {"success": True, "message": "Lưu thông tin khám thành công.", "data": response_data}
    except ValueError as e:
        await conn.rollback()
        return {"success": False, "message": str(e), "data": None}
    except Exception as e:
        await conn.rollback()
        return {"success": False, "message": str(e), "data": None}
    finally:
        await conn.close()


async def get_encounter_detail(ma_luot_kham: str, ma_bac_si: str):
    conn = await get_connection()
    try:
        cursor = await conn.execute("""
            SELECT
                LK.MaLuotKham,
                LK.MaLichHen,
                LK.MaBacSi,
                LK.TrieuChung,
                LK.LoiDan,
                LK.MaBenh,
                LH.MaBenhAn,
                LH.NgayKham,
                LH.CaKham,
                LH.TrangThai,
                B.TenBenh
            FROM luot_kham LK
            JOIN lich_hen LH
                ON LK.MaLichHen = LH.MaLichHen
            LEFT JOIN benh B
                ON LK.MaBenh = B.MaBenh
            WHERE
                LK.MaLuotKham = %s
                AND LK.MaBacSi = %s
            LIMIT 1
        """, (ma_luot_kham, ma_bac_si))
        visit = await cursor.fetchone()

        if not visit:
            return {
                "success": False,
                "message": "Không tìm thấy lượt khám thuộc bác sĩ hiện tại.",
                "data": None,
            }

        prescription_cursor = await conn.execute("""
            SELECT
                CTDT.MaDonThuoc,
                CTDT.MaLuotKham,
                T.MaThuoc,
                T.TenThuoc,
                T.DonViTinh,
                CTDT.SoLuong,
                CTDT.LieuDung
            FROM chi_tiet_don_thuoc CTDT
            JOIN thuoc T
                ON CTDT.MaThuoc = T.MaThuoc
            WHERE CTDT.MaLuotKham = %s
            ORDER BY CTDT.MaDonThuoc
        """, (ma_luot_kham,))

        lab_cursor = await conn.execute("""
            SELECT
                CTXN.MaChiTietXN,
                CTXN.MaLuotKham,
                DV.MaDichVu,
                DV.TenDichVu,
                CTXN.KetQuaXetNghiem,
                CTXN.MaXNV,
                CTXN.PaymentToken,
                CTXN.GiaCuoi,
                CTXN.TrangThaiXetNghiem
            FROM chi_tiet_xet_nghiem CTXN
            JOIN dich_vu DV
                ON CTXN.MaDichVu = DV.MaDichVu
            WHERE CTXN.MaLuotKham = %s
            ORDER BY CTXN.MaChiTietXN
        """, (ma_luot_kham,))

        treatment_cursor = await conn.execute("""
            SELECT
                LTDT.MaLichTrinh,
                LTDT.MaLichHen,
                LTDT.MaLuotKham,
                DV.MaDichVu,
                DV.TenDichVu,
                LTDT.BuoiSo,
                LTDT.NgayThucHien,
                LTDT.CaKham,
                LTDT.TrangThai
            FROM lich_trinh_dieu_tri LTDT
            JOIN dich_vu DV
                ON LTDT.MaDichVu = DV.MaDichVu
            WHERE LTDT.MaLuotKham = %s
            ORDER BY DV.MaDichVu, LTDT.BuoiSo
        """, (ma_luot_kham,))

        return {
            "success": True,
            "message": "Lấy chi tiết lượt khám thành công.",
            "data": {
                "LuotKham": dict(visit),
                "DonThuoc": [dict(row) for row in await prescription_cursor.fetchall()],
                "XetNghiem": [dict(row) for row in await lab_cursor.fetchall()],
                "DieuTri": [dict(row) for row in await treatment_cursor.fetchall()],
            },
        }
    except Exception as exc:
        return {"success": False, "message": str(exc), "data": None}
    finally:
        await conn.close()


async def attach_encounter_children(conn, encounters):
    for encounter in encounters:
        ma_luot_kham = encounter["MaLuotKham"]

        prescription_cursor = await conn.execute("""
            SELECT
                CTDT.MaDonThuoc,
                CTDT.MaLuotKham,
                T.MaThuoc,
                T.TenThuoc,
                T.DonViTinh,
                CTDT.SoLuong,
                CTDT.LieuDung
            FROM chi_tiet_don_thuoc CTDT
            JOIN thuoc T
                ON CTDT.MaThuoc = T.MaThuoc
            WHERE CTDT.MaLuotKham = %s
            ORDER BY CTDT.MaDonThuoc
        """, (ma_luot_kham,))
        encounter["DonThuoc"] = [dict(row) for row in await prescription_cursor.fetchall()]

        lab_cursor = await conn.execute("""
            SELECT
                CTXN.MaChiTietXN,
                CTXN.MaLuotKham,
                DV.MaDichVu,
                DV.TenDichVu,
                CTXN.KetQuaXetNghiem,
                CTXN.MaXNV,
                CTXN.PaymentToken,
                CTXN.GiaCuoi,
                CTXN.TrangThaiXetNghiem
            FROM chi_tiet_xet_nghiem CTXN
            JOIN dich_vu DV
                ON CTXN.MaDichVu = DV.MaDichVu
            WHERE CTXN.MaLuotKham = %s
            ORDER BY CTXN.MaChiTietXN
        """, (ma_luot_kham,))
        encounter["XetNghiem"] = [dict(row) for row in await lab_cursor.fetchall()]

        treatment_cursor = await conn.execute("""
            SELECT
                LTDT.MaLichTrinh,
                LTDT.MaLichHen,
                LTDT.MaLuotKham,
                DV.MaDichVu,
                DV.TenDichVu,
                LTDT.BuoiSo,
                LTDT.NgayThucHien,
                LTDT.CaKham,
                LTDT.TrangThai
            FROM lich_trinh_dieu_tri LTDT
            JOIN dich_vu DV
                ON LTDT.MaDichVu = DV.MaDichVu
            WHERE LTDT.MaLuotKham = %s
            ORDER BY DV.MaDichVu, LTDT.BuoiSo
        """, (ma_luot_kham,))
        encounter["DieuTri"] = [dict(row) for row in await treatment_cursor.fetchall()]

    return encounters


async def get_doctor_completed_encounters(ma_bac_si: str):
    conn = await get_connection()
    try:
        cursor = await conn.execute("""
            SELECT
                LK.MaLuotKham,
                LK.MaLichHen,
                LK.MaBacSi,
                LK.TrieuChung,
                LK.LoiDan,
                LK.MaBenh,
                B.TenBenh,
                LH.MaBenhAn,
                BN.HoTen AS TenBenhNhan,
                BN.CCCD,
                BN.NgaySinh,
                BN.SDT AS SDTBenhNhan,
                BN.DiaChi,
                LH.NgayKham,
                LH.CaKham,
                LH.STT,
                LH.TrangThai,
                LH.GiaCuoi,
                LH.PaymentToken,
                CNDV.MaChiNhanh,
                CN.TenChiNhanh,
                DV.MaDichVu AS MaDichVuKham,
                DV.TenDichVu AS TenDichVuKham
            FROM luot_kham LK
            JOIN lich_hen LH
                ON LK.MaLichHen = LH.MaLichHen
            JOIN benh_nhan BN
                ON LH.MaBenhAn = BN.MaBenhAn
            JOIN chi_nhanh_dich_vu CNDV
                ON LH.MaCauHinh = CNDV.MaCauHinh
            JOIN chi_nhanh CN
                ON CNDV.MaChiNhanh = CN.MaChiNhanh
            JOIN dich_vu DV
                ON CNDV.MaDichVu = DV.MaDichVu
            LEFT JOIN benh B
                ON LK.MaBenh = B.MaBenh
            WHERE
                LK.MaBacSi = %s
                AND LH.TrangThai = 'Hoàn thành'
            ORDER BY LH.NgayKham DESC, LH.CaKham DESC
        """, (ma_bac_si,))
        rows = [dict(row) for row in await cursor.fetchall()]
        rows = await attach_encounter_children(conn, rows)

        return {
            "success": True,
            "message": f"Lấy {len(rows)} lượt khám đã hoàn thành.",
            "data": rows,
        }
    except Exception as exc:
        return {"success": False, "message": str(exc), "data": None}
    finally:
        await conn.close()


async def get_patient_history_for_doctor(ma_benh_an: str):
    conn = await get_connection()
    try:
        cursor = await conn.execute("""
            SELECT
                LK.MaLuotKham,
                LK.MaLichHen,
                LK.MaBacSi,
                LK.TrieuChung,
                LK.LoiDan,
                LK.MaBenh,
                B.TenBenh,
                LH.MaBenhAn,
                BN.HoTen AS TenBenhNhan,
                BN.CCCD,
                BN.NgaySinh,
                BN.SDT AS SDTBenhNhan,
                BN.DiaChi,
                LH.NgayKham,
                LH.CaKham,
                LH.STT,
                LH.TrangThai,
                LH.GiaCuoi,
                LH.PaymentToken,
                CNDV.MaChiNhanh,
                CN.TenChiNhanh,
                DV.MaDichVu AS MaDichVuKham,
                DV.TenDichVu AS TenDichVuKham
            FROM luot_kham LK
            JOIN lich_hen LH
                ON LK.MaLichHen = LH.MaLichHen
            JOIN benh_nhan BN
                ON LH.MaBenhAn = BN.MaBenhAn
            JOIN chi_nhanh_dich_vu CNDV
                ON LH.MaCauHinh = CNDV.MaCauHinh
            JOIN chi_nhanh CN
                ON CNDV.MaChiNhanh = CN.MaChiNhanh
            JOIN dich_vu DV
                ON CNDV.MaDichVu = DV.MaDichVu
            LEFT JOIN benh B
                ON LK.MaBenh = B.MaBenh
            WHERE LH.MaBenhAn = %s
            ORDER BY LH.NgayKham DESC, LH.CaKham DESC
        """, (ma_benh_an,))
        rows = [dict(row) for row in await cursor.fetchall()]
        rows = await attach_encounter_children(conn, rows)

        return {
            "success": True,
            "message": f"Lấy {len(rows)} lượt khám của bệnh nhân.",
            "data": rows,
        }
    except Exception as exc:
        return {"success": False, "message": str(exc), "data": None}
    finally:
        await conn.close()


async def search_patient_history(keyword: str):
    conn = await get_connection()
    try:
        like_keyword = f"%{keyword}%"
        cursor = await conn.execute("""
            SELECT
                BN.MaBenhAn,
                BN.HoTen AS TenBenhNhan,
                BN.GioiTinh,
                BN.NgaySinh,
                BN.CCCD,
                BN.SDT AS SDTBenhNhan,
                BN.DiaChi,
                BN.MaSoBHYT,
                BHYT.KyTuDauBHYT,
                BHYT.DoiTuongChinhSach,
                BHYT.TyLeHuong,
                LH.MaLichHen,
                LH.NgayKham,
                LH.CaKham,
                LH.STT,
                LH.TrangThai,
                LH.GiaCuoi,
                LH.MaBacSi,
                DV.MaDichVu,
                DV.TenDichVu
            FROM benh_nhan BN
            JOIN lich_hen LH
                ON BN.MaBenhAn = LH.MaBenhAn
            LEFT JOIN danh_muc_bhyt BHYT
                ON BN.KyTuDauBHYT = BHYT.KyTuDauBHYT
            JOIN chi_nhanh_dich_vu CNDV
                ON LH.MaCauHinh = CNDV.MaCauHinh
            JOIN dich_vu DV
                ON CNDV.MaDichVu = DV.MaDichVu
            WHERE
                BN.HoTen LIKE %s
                OR BN.CCCD LIKE %s
                OR BN.SDT LIKE %s
                OR BN.DiaChi LIKE %s
                OR BN.MaSoBHYT LIKE %s
                OR LH.MaLichHen LIKE %s
            ORDER BY LH.NgayKham DESC, LH.CaKham DESC
            LIMIT 50
        """, (
            like_keyword,
            like_keyword,
            like_keyword,
            like_keyword,
            like_keyword,
            like_keyword,
        ))

        rows = [dict(row) for row in await cursor.fetchall()]
        return {
            "success": True,
            "message": f"Tìm thấy {len(rows)} kết quả.",
            "data": rows,
        }
    except Exception as exc:
        return {"success": False, "message": str(exc), "data": None}
    finally:
        await conn.close()
