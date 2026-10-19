import uuid
from datetime import datetime
import re

from check_db import get_connection


ACTIVE_APPOINTMENT_STATUSES = ("Đã xác nhận", "Chờ khám", "Đang khám", "Chờ kết luận")
BRANCH_SERVICE_STATUSES = ("Đang cung cấp", "Tạm ngừng")


async def table_has_column(conn, table_name: str, column_name: str) -> bool:
    cursor = await conn.execute("""
        SELECT COUNT(*) AS total
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE
            TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = %s
            AND COLUMN_NAME = %s
    """, (table_name, column_name))
    row = await cursor.fetchone()
    return bool(row and row["total"])


async def insert_schedule_notification(conn, ma_lich_hen: str, ma_benh_an: str, noi_dung: str):
    ma_thong_bao = f"TB_{uuid.uuid4().hex[:10].upper()}"
    has_notification_status = await table_has_column(conn, "lich_su_thong_bao", "TrangThai")
    thoi_gian_gui = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if has_notification_status:
        await conn.execute("""
            INSERT INTO lich_su_thong_bao (
                MaThongBao,
                MaLichHen,
                MaBenhAn,
                NoiDung,
                TrangThai,
                Loi,
                ThoiGianGui
            )
            VALUES (%s, %s, %s, %s, 'Success', NULL, %s)
        """, (
            ma_thong_bao,
            ma_lich_hen,
            ma_benh_an,
            noi_dung,
            thoi_gian_gui,
        ))
    else:
        await conn.execute("""
            INSERT INTO lich_su_thong_bao (
                MaThongBao,
                MaLichHen,
                MaBenhAn,
                NoiDung,
                Loi,
                ThoiGianGui
            )
            VALUES (%s, %s, %s, %s, NULL, %s)
        """, (
            ma_thong_bao,
            ma_lich_hen,
            ma_benh_an,
            noi_dung,
            thoi_gian_gui,
        ))

    return ma_thong_bao


async def fetch_schedule_by_identity(conn, schedule_id=None, ma_lich_truc=None):
    has_schedule_status = await table_has_column(conn, "lich_truc", "TrangThai")
    status_select = (
        "COALESCE(LTR.TrangThai, 'Đang hoạt động') AS TrangThai"
        if has_schedule_status
        else "'Đang hoạt động' AS TrangThai"
    )

    if schedule_id is not None:
        cursor = await conn.execute(f"""
            SELECT
                LTR.id,
                LTR.MaLichTruc,
                LTR.MaBacSi,
                BS.HoTen AS TenBacSi,
                BS.ChuyenKhoa,
                BS.SDT,
                LTR.MaChiNhanh,
                CN.TenChiNhanh,
                LTR.NgayTruc,
                LTR.CaTruc,
                {status_select}
            FROM lich_truc LTR
            JOIN bac_si BS
                ON LTR.MaBacSi = BS.MaBacSi
            JOIN chi_nhanh CN
                ON LTR.MaChiNhanh = CN.MaChiNhanh
            WHERE LTR.id = %s
            LIMIT 1
        """, (schedule_id,))
    else:
        cursor = await conn.execute(f"""
            SELECT
                LTR.id,
                LTR.MaLichTruc,
                LTR.MaBacSi,
                BS.HoTen AS TenBacSi,
                BS.ChuyenKhoa,
                BS.SDT,
                LTR.MaChiNhanh,
                CN.TenChiNhanh,
                LTR.NgayTruc,
                LTR.CaTruc,
                {status_select}
            FROM lich_truc LTR
            JOIN bac_si BS
                ON LTR.MaBacSi = BS.MaBacSi
            JOIN chi_nhanh CN
                ON LTR.MaChiNhanh = CN.MaChiNhanh
            WHERE LTR.MaLichTruc = %s
            LIMIT 1
        """, (ma_lich_truc,))

    row = await cursor.fetchone()
    return dict(row) if row else None


async def get_schedule_appointments(conn, schedule):
    cursor = await conn.execute("""
        SELECT
            LH.MaLichHen,
            LH.MaBenhAn,
            BN.HoTen AS TenBenhNhan,
            LH.MaCauHinh,
            LH.NgayKham,
            LH.CaKham,
            LH.STT,
            LH.TrangThai,
            LH.MaBacSi,
            DV.TenDichVu
        FROM lich_hen LH
        JOIN benh_nhan BN
            ON LH.MaBenhAn = BN.MaBenhAn
        JOIN chi_nhanh_dich_vu CNDV
            ON LH.MaCauHinh = CNDV.MaCauHinh
        JOIN dich_vu DV
            ON CNDV.MaDichVu = DV.MaDichVu
        WHERE
            CNDV.MaChiNhanh = %s
            AND LH.NgayKham = %s
            AND LH.CaKham = %s
            AND LH.MaBacSi = %s
            AND LH.TrangThai IN ('Đã xác nhận', 'Chờ khám', 'Đang khám', 'Chờ kết luận')
        ORDER BY LH.STT, LH.MaLichHen
    """, (
        schedule["MaChiNhanh"],
        schedule["NgayTruc"],
        schedule["CaTruc"],
        schedule["MaBacSi"],
    ))
    return [dict(row) for row in await cursor.fetchall()]


async def get_admin_doctor_schedules(from_date: str = None, to_date: str = None, ma_bac_si: str = None):
    conn = await get_connection()
    try:
        where_clauses = []
        params = []

        if from_date:
            where_clauses.append("LTR.NgayTruc >= %s")
            params.append(from_date)

        if to_date:
            where_clauses.append("LTR.NgayTruc <= %s")
            params.append(to_date)

        if ma_bac_si and ma_bac_si != "all":
            where_clauses.append("LTR.MaBacSi = %s")
            params.append(ma_bac_si)

        where_sql = ""
        if where_clauses:
            where_sql = "WHERE " + " AND ".join(where_clauses)

        has_schedule_status = await table_has_column(conn, "lich_truc", "TrangThai")
        status_select = "MAX(COALESCE(LTR.TrangThai, 'Đang hoạt động')) AS TrangThai" if has_schedule_status else "'Đang hoạt động' AS TrangThai"

        cursor = await conn.execute(
            f"""
            SELECT
                LTR.id,
                LTR.MaLichTruc,
                LTR.MaBacSi,
                BS.HoTen AS TenBacSi,
                BS.ChuyenKhoa,
                BS.SDT,
                LTR.MaChiNhanh,
                CN.TenChiNhanh,
                LTR.NgayTruc,
                LTR.CaTruc,
                {status_select},
                COUNT(LH.MaLichHen) AS SoLichHenDangCo
            FROM lich_truc LTR
            JOIN bac_si BS
                ON LTR.MaBacSi = BS.MaBacSi
            JOIN chi_nhanh CN
                ON LTR.MaChiNhanh = CN.MaChiNhanh
            LEFT JOIN chi_nhanh_dich_vu CNDV
                ON LTR.MaChiNhanh = CNDV.MaChiNhanh
            LEFT JOIN lich_hen LH
                ON LH.MaCauHinh = CNDV.MaCauHinh
                AND LH.NgayKham = LTR.NgayTruc
                AND LH.CaKham = LTR.CaTruc
                AND LH.MaBacSi = LTR.MaBacSi
                AND LH.TrangThai IN ('Đã xác nhận', 'Chờ khám', 'Đang khám', 'Chờ kết luận')
            {where_sql}
            GROUP BY
                LTR.id,
                LTR.MaLichTruc,
                LTR.MaBacSi,
                BS.HoTen,
                BS.ChuyenKhoa,
                BS.SDT,
                LTR.MaChiNhanh,
                CN.TenChiNhanh,
                LTR.NgayTruc,
                LTR.CaTruc
            ORDER BY LTR.NgayTruc, LTR.CaTruc, LTR.MaChiNhanh, LTR.MaBacSi
            """,
            tuple(params),
        )
        rows = [dict(row) for row in await cursor.fetchall()]

        return {
            "success": True,
            "message": "Lấy danh sách lịch trực Admin thành công.",
            "data": rows,
        }
    except Exception as exc:
        return {"success": False, "message": str(exc), "data": None}
    finally:
        await conn.close()

async def create_branch(
    ten_chi_nhanh: str,
    dia_chi: str,
    sdt: str = None,
    ma_chi_nhanh: str = None,
):

    if not ten_chi_nhanh or not dia_chi:
        return {
            "success": False,
            "message": "Thiếu thông tin chi nhánh.",
            "data": None
        }

    conn = await get_connection()

    try:

        ma_chi_nhanh = (ma_chi_nhanh or "CN_" + uuid.uuid4().hex[:6].upper()).strip().upper()

        existed_cursor = await conn.execute("""
            SELECT MaChiNhanh
            FROM chi_nhanh
            WHERE MaChiNhanh = %s
            LIMIT 1
        """, (ma_chi_nhanh,))
        if await existed_cursor.fetchone():
            return {
                "success": False,
                "message": "Mã chi nhánh đã tồn tại.",
                "data": None,
            }

        await conn.execute("""
            INSERT INTO chi_nhanh (
                MaChiNhanh,
                TenChiNhanh,
                DiaChi,
                SDT
            )
            VALUES (%s, %s, %s, %s)
        """, (
            ma_chi_nhanh,
            ten_chi_nhanh,
            dia_chi,
            sdt
        ))

        await conn.commit()

        return {
            "success": True,
            "message": "Tạo chi nhánh thành công.",
            "data": {
                "MaChiNhanh": ma_chi_nhanh
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

async def create_service(
    ten_dich_vu: str,
    chuyen_khoa: str,
    loai_dich_vu: str,
    gia_goc: int,
    ma_dich_vu: str = None,
):

    if not ten_dich_vu:
        return {
            "success": False,
            "message": "Thiếu tên dịch vụ.",
            "data": None
        }

    VALID_SERVICE_TYPES = ["Khám lâm sàng", "Xét nghiệm", "Điều trị"]

    if loai_dich_vu not in VALID_SERVICE_TYPES:
        return {
            "success": False,
            "message": "Loại dịch vụ không hợp lệ.",
            "data": None
        }

    if gia_goc < 0:
        return {
            "success": False,
            "message": "Giá dịch vụ không được âm.",
            "data": None
        }

    conn = await get_connection()

    try:

        ma_dich_vu = (ma_dich_vu or "DV_" + uuid.uuid4().hex[:6].upper()).strip().upper()

        existed_cursor = await conn.execute("""
            SELECT MaDichVu
            FROM dich_vu
            WHERE MaDichVu = %s
            LIMIT 1
        """, (ma_dich_vu,))
        if await existed_cursor.fetchone():
            return {
                "success": False,
                "message": "Mã dịch vụ đã tồn tại.",
                "data": None,
            }

        await conn.execute("""
            INSERT INTO dich_vu (
                MaDichVu,
                TenDichVu,
                ChuyenKhoa,
                LoaiDichVu,
                GiaGoc
            )
            VALUES (%s, %s, %s, %s, %s)
        """, (
            ma_dich_vu,
            ten_dich_vu,
            chuyen_khoa,
            loai_dich_vu,
            gia_goc
        ))

        await conn.commit()

        return {
            "success": True,
            "message": "Tạo dịch vụ thành công.",
            "data": {
                "MaDichVu": ma_dich_vu
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


async def update_service_price(ma_dich_vu: str, gia_goc: int):
    if not ma_dich_vu:
        return {"success": False, "message": "Thiếu mã dịch vụ.", "data": None}

    if gia_goc < 0:
        return {"success": False, "message": "Giá dịch vụ không được âm.", "data": None}

    conn = await get_connection()
    try:
        cursor = await conn.execute("""
            UPDATE dich_vu
            SET GiaGoc = %s
            WHERE MaDichVu = %s
        """, (gia_goc, ma_dich_vu))
        await conn.commit()

        if cursor.rowcount == 0:
            return {"success": False, "message": "Không tìm thấy dịch vụ cần cập nhật.", "data": None}

        return {
            "success": True,
            "message": "Cập nhật giá dịch vụ thành công.",
            "data": {"MaDichVu": ma_dich_vu, "GiaGoc": gia_goc},
        }
    except Exception as e:
        await conn.rollback()
        return {"success": False, "message": str(e), "data": None}
    finally:
        await conn.close()


async def delete_service(ma_dich_vu: str):
    if not ma_dich_vu:
        return {"success": False, "message": "Thiếu mã dịch vụ.", "data": None}

    conn = await get_connection()
    try:
        appointment_cursor = await conn.execute("""
            SELECT COUNT(*) AS total
            FROM lich_hen LH
            JOIN chi_nhanh_dich_vu CNDV
                ON LH.MaCauHinh = CNDV.MaCauHinh
            WHERE CNDV.MaDichVu = %s
        """, (ma_dich_vu,))
        appointment_row = await appointment_cursor.fetchone()

        lab_cursor = await conn.execute("""
            SELECT COUNT(*) AS total
            FROM chi_tiet_xet_nghiem
            WHERE MaDichVu = %s
        """, (ma_dich_vu,))
        lab_row = await lab_cursor.fetchone()

        treatment_cursor = await conn.execute("""
            SELECT COUNT(*) AS total
            FROM lich_trinh_dieu_tri
            WHERE MaDichVu = %s
        """, (ma_dich_vu,))
        treatment_row = await treatment_cursor.fetchone()

        linked_total = (
            int(appointment_row["total"] or 0)
            + int(lab_row["total"] or 0)
            + int(treatment_row["total"] or 0)
        )
        if linked_total:
            return {
                "success": False,
                "message": "Không thể xóa dịch vụ đã phát sinh lịch hẹn, xét nghiệm hoặc lịch trình điều trị.",
                "data": {"linkedCount": linked_total},
            }

        await conn.execute("""
            DELETE FROM chi_nhanh_dich_vu
            WHERE MaDichVu = %s
        """, (ma_dich_vu,))
        delete_cursor = await conn.execute("""
            DELETE FROM dich_vu
            WHERE MaDichVu = %s
        """, (ma_dich_vu,))
        await conn.commit()

        if delete_cursor.rowcount == 0:
            return {"success": False, "message": "Không tìm thấy dịch vụ cần xóa.", "data": None}

        return {
            "success": True,
            "message": "Đã xóa dịch vụ và cấu hình chi nhánh chưa phát sinh liên quan.",
            "data": {"MaDichVu": ma_dich_vu},
        }
    except Exception as e:
        await conn.rollback()
        return {"success": False, "message": str(e), "data": None}
    finally:
        await conn.close()


async def delete_branch(ma_chi_nhanh: str):
    if not ma_chi_nhanh:
        return {"success": False, "message": "Thiếu mã chi nhánh.", "data": None}

    conn = await get_connection()
    try:
        checks = [
            ("lich_truc", "lịch trực", "SELECT COUNT(*) AS total FROM lich_truc WHERE MaChiNhanh = %s"),
            (
                "lich_hen",
                "lịch hẹn",
                """
                SELECT COUNT(*) AS total
                FROM lich_hen LH
                JOIN chi_nhanh_dich_vu CNDV
                    ON LH.MaCauHinh = CNDV.MaCauHinh
                WHERE CNDV.MaChiNhanh = %s
                """,
            ),
            ("le_tan", "lễ tân", "SELECT COUNT(*) AS total FROM le_tan WHERE MaChiNhanh = %s"),
            (
                "xet_nghiem_vien",
                "xét nghiệm viên",
                "SELECT COUNT(*) AS total FROM xet_nghiem_vien WHERE MaChiNhanh = %s",
            ),
        ]

        blockers = []
        for _, label, sql in checks:
            cursor = await conn.execute(sql, (ma_chi_nhanh,))
            row = await cursor.fetchone()
            total = int(row["total"] or 0)
            if total:
                blockers.append(f"{total} {label}")

        if blockers:
            return {
                "success": False,
                "message": "Không thể xóa chi nhánh đã phát sinh dữ liệu: " + ", ".join(blockers) + ".",
                "data": {"blockers": blockers},
            }

        await conn.execute("""
            DELETE FROM chi_nhanh_dich_vu
            WHERE MaChiNhanh = %s
        """, (ma_chi_nhanh,))
        delete_cursor = await conn.execute("""
            DELETE FROM chi_nhanh
            WHERE MaChiNhanh = %s
        """, (ma_chi_nhanh,))
        await conn.commit()

        if delete_cursor.rowcount == 0:
            return {"success": False, "message": "Không tìm thấy chi nhánh cần xóa.", "data": None}

        return {
            "success": True,
            "message": "Đã xóa chi nhánh chưa phát sinh dữ liệu liên quan.",
            "data": {"MaChiNhanh": ma_chi_nhanh},
        }
    except Exception as e:
        await conn.rollback()
        return {"success": False, "message": str(e), "data": None}
    finally:
        await conn.close()


def build_branch_service_code(ma_chi_nhanh: str, ma_dich_vu: str) -> str:
    candidate = f"{ma_chi_nhanh}_{ma_dich_vu}".upper()
    if len(candidate) <= 20:
        return candidate
    return "CH_" + uuid.uuid4().hex[:10].upper()


async def upsert_branch_service(ma_chi_nhanh: str, ma_dich_vu: str, slot_gioi_han: int):
    if not ma_chi_nhanh or not ma_dich_vu:
        return {"success": False, "message": "Thiếu chi nhánh hoặc dịch vụ.", "data": None}

    if slot_gioi_han < 0:
        return {"success": False, "message": "Slot giới hạn không được âm.", "data": None}

    conn = await get_connection()
    try:
        branch_cursor = await conn.execute("""
            SELECT MaChiNhanh
            FROM chi_nhanh
            WHERE MaChiNhanh = %s
            LIMIT 1
        """, (ma_chi_nhanh,))
        if not await branch_cursor.fetchone():
            return {"success": False, "message": "Chi nhánh không tồn tại.", "data": None}

        service_cursor = await conn.execute("""
            SELECT MaDichVu
            FROM dich_vu
            WHERE MaDichVu = %s
            LIMIT 1
        """, (ma_dich_vu,))
        if not await service_cursor.fetchone():
            return {"success": False, "message": "Dịch vụ không tồn tại.", "data": None}

        existed_cursor = await conn.execute("""
            SELECT MaCauHinh
            FROM chi_nhanh_dich_vu
            WHERE MaChiNhanh = %s AND MaDichVu = %s
            LIMIT 1
        """, (ma_chi_nhanh, ma_dich_vu))
        existed = await existed_cursor.fetchone()

        if existed:
            ma_cau_hinh = existed["MaCauHinh"]
            await conn.execute("""
                UPDATE chi_nhanh_dich_vu
                SET
                    SlotGioiHan = %s,
                    TrangThai = 'Đang cung cấp'
                WHERE MaCauHinh = %s
            """, (slot_gioi_han, ma_cau_hinh))
            message = "Cập nhật cấu hình dịch vụ chi nhánh thành công."
        else:
            ma_cau_hinh = build_branch_service_code(ma_chi_nhanh, ma_dich_vu)
            await conn.execute("""
                INSERT INTO chi_nhanh_dich_vu (
                    MaCauHinh,
                    MaChiNhanh,
                    MaDichVu,
                    SlotGioiHan,
                    TrangThai
                )
                VALUES (%s, %s, %s, %s, 'Đang cung cấp')
            """, (ma_cau_hinh, ma_chi_nhanh, ma_dich_vu, slot_gioi_han))
            message = "Thêm cấu hình dịch vụ chi nhánh thành công."

        await conn.commit()
        return {
            "success": True,
            "message": message,
            "data": {
                "MaCauHinh": ma_cau_hinh,
                "MaChiNhanh": ma_chi_nhanh,
                "MaDichVu": ma_dich_vu,
                "SlotGioiHan": slot_gioi_han,
                "TrangThai": "Đang cung cấp",
            },
        }
    except Exception as e:
        await conn.rollback()
        return {"success": False, "message": str(e), "data": None}
    finally:
        await conn.close()


async def update_branch_service_slot(ma_cau_hinh: str, slot_gioi_han: int):
    if not ma_cau_hinh:
        return {"success": False, "message": "Thiếu mã cấu hình.", "data": None}

    if slot_gioi_han < 0:
        return {"success": False, "message": "Slot giới hạn không được âm.", "data": None}

    conn = await get_connection()
    try:
        cursor = await conn.execute("""
            UPDATE chi_nhanh_dich_vu
            SET SlotGioiHan = %s
            WHERE MaCauHinh = %s
        """, (slot_gioi_han, ma_cau_hinh))
        await conn.commit()

        if cursor.rowcount == 0:
            return {"success": False, "message": "Không tìm thấy cấu hình dịch vụ chi nhánh.", "data": None}

        return {
            "success": True,
            "message": "Cập nhật SlotGioiHan thành công.",
            "data": {"MaCauHinh": ma_cau_hinh, "SlotGioiHan": slot_gioi_han},
        }
    except Exception as e:
        await conn.rollback()
        return {"success": False, "message": str(e), "data": None}
    finally:
        await conn.close()


async def update_branch_service_status(ma_cau_hinh: str, trang_thai: str):
    if not ma_cau_hinh:
        return {"success": False, "message": "Thiếu mã cấu hình.", "data": None}

    if trang_thai not in BRANCH_SERVICE_STATUSES:
        return {
            "success": False,
            "message": "Trạng thái cấu hình dịch vụ chi nhánh không hợp lệ.",
            "data": None,
        }

    conn = await get_connection()
    try:
        cursor = await conn.execute("""
            UPDATE chi_nhanh_dich_vu
            SET TrangThai = %s
            WHERE MaCauHinh = %s
        """, (trang_thai, ma_cau_hinh))
        await conn.commit()

        if cursor.rowcount == 0:
            return {"success": False, "message": "Không tìm thấy cấu hình dịch vụ chi nhánh.", "data": None}

        return {
            "success": True,
            "message": "Cập nhật trạng thái cấu hình dịch vụ chi nhánh thành công.",
            "data": {"MaCauHinh": ma_cau_hinh, "TrangThai": trang_thai},
        }
    except Exception as e:
        await conn.rollback()
        return {"success": False, "message": str(e), "data": None}
    finally:
        await conn.close()


async def delete_branch_service(ma_cau_hinh: str):
    if not ma_cau_hinh:
        return {"success": False, "message": "Thiếu mã cấu hình.", "data": None}

    conn = await get_connection()
    try:
        appointment_cursor = await conn.execute("""
            SELECT COUNT(*) AS total
            FROM lich_hen
            WHERE MaCauHinh = %s
        """, (ma_cau_hinh,))
        appointment_row = await appointment_cursor.fetchone()
        if int(appointment_row["total"] or 0):
            return {
                "success": False,
                "message": "Không thể xóa cấu hình đã phát sinh lịch hẹn.",
                "data": {"linkedCount": int(appointment_row["total"] or 0)},
            }

        cursor = await conn.execute("""
            DELETE FROM chi_nhanh_dich_vu
            WHERE MaCauHinh = %s
        """, (ma_cau_hinh,))
        await conn.commit()

        if cursor.rowcount == 0:
            return {"success": False, "message": "Không tìm thấy cấu hình cần xóa.", "data": None}

        return {
            "success": True,
            "message": "Đã xóa cấu hình dịch vụ chi nhánh.",
            "data": {"MaCauHinh": ma_cau_hinh},
        }
    except Exception as e:
        await conn.rollback()
        return {"success": False, "message": str(e), "data": None}
    finally:
        await conn.close()


STAFF_ACTIVE_STATUS = "Đang hoạt động"
STAFF_LOCKED_STATUS = "Đã khóa"
STAFF_STATUSES = (STAFF_ACTIVE_STATUS, STAFF_LOCKED_STATUS)


def normalize_staff_status(trang_thai: str = None) -> str:
    if trang_thai in STAFF_STATUSES:
        return trang_thai
    if trang_thai == "active":
        return STAFF_ACTIVE_STATUS
    if trang_thai == "inactive":
        return STAFF_LOCKED_STATUS
    return STAFF_ACTIVE_STATUS


def get_staff_table_by_role(vai_tro: str):
    role_map = {
        "Bác sĩ": {
            "table": "bac_si",
            "id_column": "MaBacSi",
            "branch_required": False,
        },
        "Lễ tân": {
            "table": "le_tan",
            "id_column": "MaLeTan",
            "branch_required": True,
        },
        "Xét nghiệm viên": {
            "table": "xet_nghiem_vien",
            "id_column": "MaXNV",
            "branch_required": True,
        },
    }
    return role_map.get(vai_tro)


def get_staff_role_by_identifier(ma_nhan_su: str):
    if ma_nhan_su.startswith("BS"):
        return "Bác sĩ"
    if ma_nhan_su.startswith("LT"):
        return "Lễ tân"
    if ma_nhan_su.startswith("XNV"):
        return "Xét nghiệm viên"
    return None


async def generate_staff_identifier(conn, vai_tro: str) -> str:
    role_config = get_staff_table_by_role(vai_tro)
    prefix_map = {
        "Bác sĩ": "BS",
        "Lễ tân": "LT",
        "Xét nghiệm viên": "XNV",
    }
    prefix = prefix_map[vai_tro]

    cursor = await conn.execute(f"""
        SELECT {role_config["id_column"]} AS MaNhanSu
        FROM {role_config["table"]}
        WHERE {role_config["id_column"]} LIKE %s
    """, (f"{prefix}%",))
    rows = await cursor.fetchall()

    max_number = 0
    for row in rows:
        raw_value = row["MaNhanSu"] or ""
        numeric_part = raw_value.replace(prefix, "", 1)
        if numeric_part.isdigit():
            max_number = max(max_number, int(numeric_part))

    return f"{prefix}{str(max_number + 1).zfill(3)}"


async def get_admin_staff():
    conn = await get_connection()
    try:
        doctor_status_select = (
            "COALESCE(TrangThai, 'Đang hoạt động') AS TrangThai"
            if await table_has_column(conn, "bac_si", "TrangThai")
            else "'Đang hoạt động' AS TrangThai"
        )
        receptionist_status_select = (
            "COALESCE(TrangThai, 'Đang hoạt động') AS TrangThai"
            if await table_has_column(conn, "le_tan", "TrangThai")
            else "'Đang hoạt động' AS TrangThai"
        )
        technician_status_select = (
            "COALESCE(TrangThai, 'Đang hoạt động') AS TrangThai"
            if await table_has_column(conn, "xet_nghiem_vien", "TrangThai")
            else "'Đang hoạt động' AS TrangThai"
        )

        cursor = await conn.execute(f"""
            SELECT
                MaBacSi AS MaNhanSu,
                HoTen,
                'Bác sĩ' AS VaiTro,
                ChuyenKhoa,
                SDT,
                MatKhau,
                NULL AS MaChiNhanh,
                {doctor_status_select}
            FROM bac_si
            UNION ALL
            SELECT
                MaLeTan AS MaNhanSu,
                HoTen,
                'Lễ tân' AS VaiTro,
                'Tiếp nhận' AS ChuyenKhoa,
                SDT,
                MatKhau,
                MaChiNhanh,
                {receptionist_status_select}
            FROM le_tan
            UNION ALL
            SELECT
                MaXNV AS MaNhanSu,
                HoTen,
                'Xét nghiệm viên' AS VaiTro,
                'Xét nghiệm' AS ChuyenKhoa,
                SDT,
                MatKhau,
                MaChiNhanh,
                {technician_status_select}
            FROM xet_nghiem_vien
        """)
        rows = [dict(row) for row in await cursor.fetchall()]
        rows.sort(key=lambda item: (
            1 if item["VaiTro"] == "Bác sĩ" else 2 if item["VaiTro"] == "Lễ tân" else 3,
            item["MaNhanSu"],
        ))
        for row in rows:
            row["TrangThai"] = normalize_staff_status(row.get("TrangThai"))

        return {
            "success": True,
            "message": "Lấy danh sách nhân sự thành công.",
            "data": rows,
        }
    except Exception as exc:
        return {"success": False, "message": str(exc), "data": None}
    finally:
        await conn.close()


async def get_admin_patients():
    conn = await get_connection()
    try:
        cursor = await conn.execute("""
            SELECT
                MaBenhAn,
                HoTen,
                CCCD,
                NgaySinh,
                GioiTinh,
                SDT,
                MatKhau,
                DiaChi,
                MaSoBHYT,
                KyTuDauBHYT
            FROM benh_nhan
            ORDER BY MaBenhAn
        """)
        rows = [dict(row) for row in await cursor.fetchall()]

        return {
            "success": True,
            "message": "Lấy danh sách bệnh nhân thành công.",
            "data": rows,
        }
    except Exception as exc:
        return {"success": False, "message": str(exc), "data": None}
    finally:
        await conn.close()


async def create_staff_account(
    ho_ten: str,
    vai_tro: str,
    chuyen_khoa: str,
    sdt: str,
    mat_khau: str,
    ma_chi_nhanh: str = None,
):
    ho_ten = (ho_ten or "").strip()
    vai_tro = (vai_tro or "").strip()
    chuyen_khoa = (chuyen_khoa or "").strip()
    sdt = (sdt or "").strip()
    mat_khau = (mat_khau or "").strip()
    ma_chi_nhanh = (ma_chi_nhanh or "").strip() or None

    if not ho_ten or not vai_tro or not sdt or not mat_khau:
        return {"success": False, "message": "Thiếu thông tin tạo tài khoản nhân sự.", "data": None}

    role_config = get_staff_table_by_role(vai_tro)
    if not role_config:
        return {"success": False, "message": "Vai trò nhân sự không hợp lệ.", "data": None}

    if vai_tro == "Bác sĩ" and not chuyen_khoa:
        return {"success": False, "message": "Vui lòng chọn chuyên khoa cho bác sĩ.", "data": None}

    if role_config["branch_required"] and not ma_chi_nhanh:
        return {"success": False, "message": "Vui lòng chọn chi nhánh phụ trách.", "data": None}

    conn = await get_connection()
    try:
        has_status_column = await table_has_column(conn, role_config["table"], "TrangThai")

        if ma_chi_nhanh:
            branch_cursor = await conn.execute("""
                SELECT MaChiNhanh
                FROM chi_nhanh
                WHERE MaChiNhanh = %s
                LIMIT 1
            """, (ma_chi_nhanh,))
            if not await branch_cursor.fetchone():
                return {"success": False, "message": "Chi nhánh phụ trách không tồn tại.", "data": None}

            duplicate_cursor = await conn.execute(f"""
                SELECT {role_config["id_column"]} AS MaNhanSu
                FROM {role_config["table"]}
                WHERE MaChiNhanh = %s
                LIMIT 1
            """, (ma_chi_nhanh,))
            if await duplicate_cursor.fetchone():
                return {
                    "success": False,
                    "message": "Mỗi chi nhánh chỉ được phép có duy nhất 1 Lễ tân và 1 Xét nghiệm viên cố định!",
                    "data": None,
                }

        ma_nhan_su = await generate_staff_identifier(conn, vai_tro)
        trang_thai = STAFF_ACTIVE_STATUS

        if vai_tro == "Bác sĩ":
            if has_status_column:
                await conn.execute("""
                    INSERT INTO bac_si (
                        MaBacSi,
                        HoTen,
                        ChuyenKhoa,
                        SDT,
                        MatKhau,
                        TrangThai
                    )
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (ma_nhan_su, ho_ten, chuyen_khoa, sdt, mat_khau, trang_thai))
            else:
                await conn.execute("""
                    INSERT INTO bac_si (
                        MaBacSi,
                        HoTen,
                        ChuyenKhoa,
                        SDT,
                        MatKhau
                    )
                    VALUES (%s, %s, %s, %s, %s)
                """, (ma_nhan_su, ho_ten, chuyen_khoa, sdt, mat_khau))
        elif vai_tro == "Lễ tân":
            chuyen_khoa = "Tiếp nhận"
            if has_status_column:
                await conn.execute("""
                    INSERT INTO le_tan (
                        MaLeTan,
                        HoTen,
                        SDT,
                        MatKhau,
                        MaChiNhanh,
                        TrangThai
                    )
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (ma_nhan_su, ho_ten, sdt, mat_khau, ma_chi_nhanh, trang_thai))
            else:
                await conn.execute("""
                    INSERT INTO le_tan (
                        MaLeTan,
                        HoTen,
                        SDT,
                        MatKhau,
                        MaChiNhanh
                    )
                    VALUES (%s, %s, %s, %s, %s)
                """, (ma_nhan_su, ho_ten, sdt, mat_khau, ma_chi_nhanh))
        else:
            chuyen_khoa = "Xét nghiệm"
            if has_status_column:
                await conn.execute("""
                    INSERT INTO xet_nghiem_vien (
                        MaXNV,
                        HoTen,
                        SDT,
                        MatKhau,
                        MaChiNhanh,
                        TrangThai
                    )
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (ma_nhan_su, ho_ten, sdt, mat_khau, ma_chi_nhanh, trang_thai))
            else:
                await conn.execute("""
                    INSERT INTO xet_nghiem_vien (
                        MaXNV,
                        HoTen,
                        SDT,
                        MatKhau,
                        MaChiNhanh
                    )
                    VALUES (%s, %s, %s, %s, %s)
                """, (ma_nhan_su, ho_ten, sdt, mat_khau, ma_chi_nhanh))

        await conn.commit()

        return {
            "success": True,
            "message": "Tạo tài khoản nhân sự thành công.",
            "data": {
                "MaNhanSu": ma_nhan_su,
                "HoTen": ho_ten,
                "VaiTro": vai_tro,
                "ChuyenKhoa": chuyen_khoa,
                "SDT": sdt,
                "MatKhau": mat_khau,
                "MaChiNhanh": ma_chi_nhanh,
                "TrangThai": trang_thai,
            },
        }
    except Exception as exc:
        await conn.rollback()
        return {"success": False, "message": str(exc), "data": None}
    finally:
        await conn.close()


async def update_staff_status(ma_nhan_su: str, trang_thai: str):
    ma_nhan_su = (ma_nhan_su or "").strip()
    trang_thai = normalize_staff_status(trang_thai)
    vai_tro = get_staff_role_by_identifier(ma_nhan_su)
    role_config = get_staff_table_by_role(vai_tro)

    if not ma_nhan_su or not role_config:
        return {"success": False, "message": "Mã nhân sự không hợp lệ.", "data": None}

    conn = await get_connection()
    try:
        if not await table_has_column(conn, role_config["table"], "TrangThai"):
            return {
                "success": False,
                "message": "Database chưa có cột trạng thái nhân sự. Vui lòng chạy migration trước.",
                "data": None,
            }

        cursor = await conn.execute(f"""
            UPDATE {role_config["table"]}
            SET TrangThai = %s
            WHERE {role_config["id_column"]} = %s
        """, (trang_thai, ma_nhan_su))
        await conn.commit()

        if cursor.rowcount == 0:
            return {"success": False, "message": "Không tìm thấy nhân sự cần cập nhật.", "data": None}

        return {
            "success": True,
            "message": "Cập nhật trạng thái nhân sự thành công.",
            "data": {
                "MaNhanSu": ma_nhan_su,
                "VaiTro": vai_tro,
                "TrangThai": trang_thai,
            },
        }
    except Exception as exc:
        await conn.rollback()
        return {"success": False, "message": str(exc), "data": None}
    finally:
        await conn.close()


async def create_doctor_schedule(
    ma_bac_si: str,
    ma_chi_nhanh: str,
    ngay_truc: str,
    ca_truc: int
):

    conn = await get_connection()

    try:

        # check doctor exists
        cursor = await conn.execute("""
            SELECT MaBacSi
            FROM bac_si
            WHERE MaBacSi = %s
        """, (ma_bac_si,))

        bac_si = await cursor.fetchone()

        if not bac_si:
            return {
                "success": False,
                "message": "Bác sĩ không tồn tại.",
                "data": None
            }

        # check duplicate active schedule
        has_schedule_status = await table_has_column(conn, "lich_truc", "TrangThai")
        duplicate_status_filter = (
            "AND COALESCE(TrangThai, 'Đang hoạt động') <> 'Đã hủy'"
            if has_schedule_status
            else ""
        )

        cursor = await conn.execute(f"""
            SELECT id, MaLichTruc
            FROM lich_truc
            WHERE MaBacSi = %s
              AND NgayTruc = %s
              AND CaTruc = %s
              {duplicate_status_filter}
        """, (ma_bac_si, ngay_truc, ca_truc))

        existed = await cursor.fetchone()

        if existed:
            return {
                "success": False,
                "message": "Lịch trực đã tồn tại.",
                "data": None
            }

        ma_lich_truc = "LT_" + uuid.uuid4().hex[:6].upper()

        insert_cursor = await conn.execute("""
            INSERT INTO lich_truc (
                MaLichTruc,
                MaBacSi,
                MaChiNhanh,
                NgayTruc,
                CaTruc
            )
            VALUES (%s, %s, %s, %s, %s)
        """, (
            ma_lich_truc,
            ma_bac_si,
            ma_chi_nhanh,
            ngay_truc,
            ca_truc
        ))

        await conn.commit()

        return {
            "success": True,
            "message": "Tạo lịch trực thành công.",
            "data": {
                "id": insert_cursor.lastrowid,
                "MaLichTruc": ma_lich_truc
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


async def cancel_doctor_schedule(schedule_id=None, ma_lich_truc: str = None):
    conn = await get_connection()
    try:
        schedule = await fetch_schedule_by_identity(conn, schedule_id=schedule_id, ma_lich_truc=ma_lich_truc)
        if not schedule:
            return {
                "success": False,
                "message": "Không tìm thấy ca trực cần hủy.",
                "data": None,
            }

        if schedule.get("TrangThai") == "Đã hủy":
            return {
                "success": False,
                "message": "Ca trực này đã được hủy trước đó.",
                "data": None,
            }

        affected_appointments = await get_schedule_appointments(conn, schedule)
        notification_rows = []

        for appointment in affected_appointments:
            message = (
                f"⚠️ CẢNH BÁO SỰ CỐ: Ca khám ngày {schedule['NgayTruc']} - "
                f"Ca {schedule['CaTruc']} của bạn đã bị hủy do bác sĩ gặp sự cố đột xuất. "
                "Vui lòng đặt lại lịch mới hoặc liên hệ hotline để được hỗ trợ xếp lịch lại!"
            )
            ma_thong_bao = await insert_schedule_notification(
                conn,
                appointment["MaLichHen"],
                appointment["MaBenhAn"],
                message,
            )
            notification_rows.append({
                "id": ma_thong_bao,
                "MaThongBao": ma_thong_bao,
                "MaBenhAn": appointment["MaBenhAn"],
                "MaBenhNhan": appointment["MaBenhAn"],
                "MaLichHen": appointment["MaLichHen"],
                "message": message,
                "read": False,
            })

        await conn.execute("""
            UPDATE lich_hen LH
            JOIN chi_nhanh_dich_vu CNDV
                ON LH.MaCauHinh = CNDV.MaCauHinh
            SET LH.TrangThai = 'Đã hủy'
            WHERE
                CNDV.MaChiNhanh = %s
                AND LH.NgayKham = %s
                AND LH.CaKham = %s
                AND LH.MaBacSi = %s
                AND LH.TrangThai IN ('Đã xác nhận', 'Chờ khám', 'Đang khám', 'Chờ kết luận')
        """, (
            schedule["MaChiNhanh"],
            schedule["NgayTruc"],
            schedule["CaTruc"],
            schedule["MaBacSi"],
        ))

        has_schedule_status = await table_has_column(conn, "lich_truc", "TrangThai")
        if has_schedule_status:
            await conn.execute("""
                UPDATE lich_truc
                SET TrangThai = 'Đã hủy'
                WHERE id = %s
            """, (schedule["id"],))
        else:
            await conn.execute("""
                DELETE FROM lich_truc
                WHERE id = %s
            """, (schedule["id"],))

        await conn.commit()

        return {
            "success": True,
            "message": "Đã hủy ca trực và phát thông báo cho bệnh nhân liên quan.",
            "data": {
                "schedule": {
                    **schedule,
                    "TrangThai": "Đã hủy",
                    "SoLichHenDangCo": 0,
                },
                "affectedPatients": notification_rows,
                "affectedCount": len(notification_rows),
            },
        }
    except Exception as exc:
        await conn.rollback()
        return {"success": False, "message": str(exc), "data": None}
    finally:
        await conn.close()


async def transfer_doctor_schedule(schedule_id=None, ma_lich_truc: str = None, new_ma_bac_si: str = None):
    conn = await get_connection()
    try:
        if not new_ma_bac_si:
            return {
                "success": False,
                "message": "Vui lòng chọn bác sĩ mới.",
                "data": None,
            }

        schedule = await fetch_schedule_by_identity(conn, schedule_id=schedule_id, ma_lich_truc=ma_lich_truc)
        if not schedule:
            return {
                "success": False,
                "message": "Không tìm thấy ca trực cần điều chuyển.",
                "data": None,
            }

        if schedule.get("TrangThai") == "Đã hủy":
            return {
                "success": False,
                "message": "Không thể điều chuyển một ca trực đã hủy.",
                "data": None,
            }

        doctor_cursor = await conn.execute("""
            SELECT MaBacSi, HoTen, ChuyenKhoa, SDT
            FROM bac_si
            WHERE MaBacSi = %s
            LIMIT 1
        """, (new_ma_bac_si,))
        new_doctor = await doctor_cursor.fetchone()
        if not new_doctor:
            return {
                "success": False,
                "message": "Bác sĩ mới không tồn tại.",
                "data": None,
            }

        has_schedule_status = await table_has_column(conn, "lich_truc", "TrangThai")
        duplicate_status_filter = "AND COALESCE(TrangThai, 'Đang hoạt động') <> 'Đã hủy'" if has_schedule_status else ""

        duplicate_cursor = await conn.execute(f"""
            SELECT id
            FROM lich_truc
            WHERE
                MaBacSi = %s
                AND MaChiNhanh = %s
                AND NgayTruc = %s
                AND CaTruc = %s
                AND id <> %s
                {duplicate_status_filter}
            LIMIT 1
        """, (
            new_ma_bac_si,
            schedule["MaChiNhanh"],
            schedule["NgayTruc"],
            schedule["CaTruc"],
            schedule["id"],
        ))
        if await duplicate_cursor.fetchone():
            return {
                "success": False,
                "message": "Bác sĩ mới đã có lịch trực tại chi nhánh, ngày và ca này.",
                "data": None,
            }

        affected_appointments = await get_schedule_appointments(conn, schedule)
        notification_rows = []

        for appointment in affected_appointments:
            message = (
                f"📢 THÔNG BÁO THAY ĐỔI: Ca khám ngày {schedule['NgayTruc']} - "
                f"Ca {schedule['CaTruc']} của bạn đã được điều chuyển sang Bác sĩ "
                f"{new_doctor['HoTen']} phụ trách do thay đổi lịch công tác của viện. "
                "Giờ khám giữ nguyên không đổi!"
            )
            ma_thong_bao = await insert_schedule_notification(
                conn,
                appointment["MaLichHen"],
                appointment["MaBenhAn"],
                message,
            )
            notification_rows.append({
                "id": ma_thong_bao,
                "MaThongBao": ma_thong_bao,
                "MaBenhAn": appointment["MaBenhAn"],
                "MaBenhNhan": appointment["MaBenhAn"],
                "MaLichHen": appointment["MaLichHen"],
                "message": message,
                "read": False,
            })

        await conn.execute("""
            UPDATE lich_truc
            SET MaBacSi = %s
            WHERE id = %s
        """, (new_ma_bac_si, schedule["id"]))

        await conn.execute("""
            UPDATE lich_hen LH
            JOIN chi_nhanh_dich_vu CNDV
                ON LH.MaCauHinh = CNDV.MaCauHinh
            SET LH.MaBacSi = %s
            WHERE
                CNDV.MaChiNhanh = %s
                AND LH.NgayKham = %s
                AND LH.CaKham = %s
                AND LH.MaBacSi = %s
                AND LH.TrangThai IN ('Đã xác nhận', 'Chờ khám', 'Đang khám', 'Chờ kết luận')
        """, (
            new_ma_bac_si,
            schedule["MaChiNhanh"],
            schedule["NgayTruc"],
            schedule["CaTruc"],
            schedule["MaBacSi"],
        ))

        await conn.commit()

        return {
            "success": True,
            "message": "Đã điều chuyển bác sĩ trực và phát thông báo cho bệnh nhân liên quan.",
            "data": {
                "schedule": {
                    **schedule,
                    "MaBacSi": new_ma_bac_si,
                    "TenBacSi": new_doctor["HoTen"],
                    "ChuyenKhoa": new_doctor["ChuyenKhoa"],
                    "SDT": new_doctor["SDT"],
                    "TrangThai": schedule.get("TrangThai") or "Đang hoạt động",
                    "SoLichHenDangCo": len(notification_rows),
                },
                "oldMaBacSi": schedule["MaBacSi"],
                "newMaBacSi": new_ma_bac_si,
                "affectedPatients": notification_rows,
                "affectedCount": len(notification_rows),
            },
        }
    except Exception as exc:
        await conn.rollback()
        return {"success": False, "message": str(exc), "data": None}
    finally:
        await conn.close()


async def get_report(
    start_date: str,
    end_date: str
):

    conn = await get_connection()

    try:

        # TOTAL VISITS
        cursor = await conn.execute("""
            SELECT COUNT(*) as total
            FROM lich_hen
            WHERE NgayKham BETWEEN %s AND %s
        """, (start_date, end_date))

        total_row = await cursor.fetchone()

        # BY BRANCH
        cursor = await conn.execute("""
            SELECT
                CN.TenChiNhanh AS TenChiNhanh,
                COUNT(*) AS SoLuotKham
            FROM lich_hen LH
            JOIN chi_nhanh_dich_vu CHDV
                ON LH.MaCauHinh = CHDV.MaCauHinh
            JOIN chi_nhanh CN
                ON CN.MaChiNhanh = CHDV.MaChiNhanh
            WHERE LH.NgayKham BETWEEN %s AND %s
            GROUP BY CN.MaChiNhanh
        """, (start_date, end_date))

        branch_rows = await cursor.fetchall()

        # BY SPECIALTY
        cursor = await conn.execute("""
            SELECT
                DV.ChuyenKhoa AS ChuyenKhoa,
                COUNT(*) AS SoLuotKham
            FROM lich_hen LH
            JOIN chi_nhanh_dich_vu CHDV
                ON LH.MaCauHinh = CHDV.MaCauHinh
            JOIN dich_vu DV
                ON DV.MaDichVu = CHDV.MaDichVu
            WHERE LH.NgayKham BETWEEN %s AND %s
            GROUP BY DV.ChuyenKhoa
        """, (start_date, end_date))

        specialty_rows = await cursor.fetchall()

        # TOP SERVICE
        cursor = await conn.execute("""
            SELECT
                DV.TenDichVu,
                COUNT(*) AS SoLan
            FROM lich_hen LH
            JOIN chi_nhanh_dich_vu CHDV
                ON LH.MaCauHinh = CHDV.MaCauHinh
            JOIN dich_vu DV
                ON DV.MaDichVu = CHDV.MaDichVu
            WHERE LH.NgayKham BETWEEN %s AND %s
            GROUP BY DV.MaDichVu
            ORDER BY SoLan DESC
            LIMIT 1
        """, (start_date, end_date))

        top_service = await cursor.fetchone()

        return {
            "success": True,
            "message": "Lấy báo cáo thành công.",
            "data": {
                "TongLuotKham": total_row["total"] if total_row else 0,
                "TheoChiNhanh": [dict(row) for row in branch_rows],
                "TheoChuyenKhoa": [dict(row) for row in specialty_rows],
                "DichVuPhoBienNhat": dict(top_service) if top_service else None
            }
        }

    except Exception as e:

        return {
            "success": False,
            "message": str(e),
            "data": None
        }

    finally:
        await conn.close()


async def get_monthly_report(month: str):
    if not re.fullmatch(r"\d{4}-\d{2}", month or ""):
        return {
            "success": False,
            "message": "Tháng báo cáo không hợp lệ. Định dạng đúng là YYYY-MM.",
            "data": None,
        }

    start_date = f"{month}-01"
    year, month_number = month.split("-")
    next_month = int(month_number) + 1
    next_year = int(year)
    if next_month == 13:
        next_month = 1
        next_year += 1
    end_exclusive = f"{next_year}-{next_month:02d}-01"

    conn = await get_connection()

    try:
        branch_cursor = await conn.execute("""
            SELECT MaChiNhanh, TenChiNhanh
            FROM chi_nhanh
            ORDER BY MaChiNhanh
        """)
        branch_rows_source = [dict(row) for row in await branch_cursor.fetchall()]

        appointment_cursor = await conn.execute("""
            SELECT
                LH.MaLichHen AS id,
                'appointment' AS sourceKind,
                DV.LoaiDichVu AS type,
                CNDV.MaChiNhanh AS maChiNhanh,
                CN.TenChiNhanh AS tenChiNhanh,
                DV.MaDichVu AS maDichVu,
                DV.TenDichVu AS tenDichVu,
                DV.LoaiDichVu AS loaiDichVu,
                DV.ChuyenKhoa AS chuyenKhoa,
                DV.GiaGoc AS giaGoc,
                LH.GiaCuoi AS netRevenue,
                GREATEST(DV.GiaGoc - COALESCE(LH.GiaCuoi, DV.GiaGoc), 0) AS insuranceAmount,
                LH.MaBacSi AS maBacSi,
                BS.HoTen AS hoTenBacSi,
                LH.NgayKham AS ngayPhatSinh
            FROM lich_hen LH
            JOIN chi_nhanh_dich_vu CNDV ON LH.MaCauHinh = CNDV.MaCauHinh
            JOIN chi_nhanh CN ON CNDV.MaChiNhanh = CN.MaChiNhanh
            JOIN dich_vu DV ON CNDV.MaDichVu = DV.MaDichVu
            LEFT JOIN bac_si BS ON LH.MaBacSi = BS.MaBacSi
            WHERE
                LH.NgayKham >= %s
                AND LH.NgayKham < %s
                AND LH.TrangThai IN ('Hoàn thành', 'Đã khám')
        """, (start_date, end_exclusive))
        appointment_rows = [dict(row) for row in await appointment_cursor.fetchall()]

        lab_cursor = await conn.execute("""
            SELECT
                CTXN.MaChiTietXN AS id,
                'lab' AS sourceKind,
                'Xét nghiệm' AS type,
                CNDV.MaChiNhanh AS maChiNhanh,
                CN.TenChiNhanh AS tenChiNhanh,
                DV.MaDichVu AS maDichVu,
                DV.TenDichVu AS tenDichVu,
                DV.LoaiDichVu AS loaiDichVu,
                DV.ChuyenKhoa AS chuyenKhoa,
                DV.GiaGoc AS giaGoc,
                COALESCE(CTXN.GiaCuoi, DV.GiaGoc) AS netRevenue,
                GREATEST(DV.GiaGoc - COALESCE(CTXN.GiaCuoi, DV.GiaGoc), 0) AS insuranceAmount,
                LK.MaBacSi AS maBacSi,
                BS.HoTen AS hoTenBacSi,
                LH.NgayKham AS ngayPhatSinh
            FROM chi_tiet_xet_nghiem CTXN
            JOIN luot_kham LK ON CTXN.MaLuotKham = LK.MaLuotKham
            JOIN lich_hen LH ON LK.MaLichHen = LH.MaLichHen
            JOIN chi_nhanh_dich_vu CNDV ON LH.MaCauHinh = CNDV.MaCauHinh
            JOIN chi_nhanh CN ON CNDV.MaChiNhanh = CN.MaChiNhanh
            JOIN dich_vu DV ON CTXN.MaDichVu = DV.MaDichVu
            LEFT JOIN bac_si BS ON LK.MaBacSi = BS.MaBacSi
            WHERE
                LH.NgayKham >= %s
                AND LH.NgayKham < %s
                AND CTXN.TrangThaiXetNghiem = 'Đã có kết quả'
        """, (start_date, end_exclusive))
        lab_rows = [dict(row) for row in await lab_cursor.fetchall()]

        records = appointment_rows + lab_rows
        total_net_revenue = sum(int(row.get("netRevenue") or 0) for row in records)
        total_insurance_amount = sum(int(row.get("insuranceAmount") or 0) for row in records)

        total_appointments_cursor = await conn.execute("""
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN TrangThai = 'Đã hủy' THEN 1 ELSE 0 END) AS cancelled
            FROM lich_hen
            WHERE NgayKham >= %s AND NgayKham < %s
        """, (start_date, end_exclusive))
        total_appointment_row = await total_appointments_cursor.fetchone()
        total_appointments = int(total_appointment_row["total"] or 0) if total_appointment_row else 0
        cancelled_appointments = int(total_appointment_row["cancelled"] or 0) if total_appointment_row else 0
        cancellation_rate = round(cancelled_appointments / total_appointments * 100, 1) if total_appointments else 0

        branch_map = {}
        service_map = {}
        doctor_map = {}

        for branch_source in branch_rows_source:
            branch_map[branch_source["MaChiNhanh"]] = {
                "maChiNhanh": branch_source["MaChiNhanh"],
                "tenChiNhanh": branch_source["TenChiNhanh"],
                "completedCount": 0,
                "netRevenue": 0,
                "insuranceAmount": 0,
            }

        for record in records:
            branch_key = record.get("maChiNhanh")
            if branch_key:
                branch = branch_map.setdefault(branch_key, {
                    "maChiNhanh": branch_key,
                    "tenChiNhanh": record.get("tenChiNhanh") or branch_key,
                    "completedCount": 0,
                    "netRevenue": 0,
                    "insuranceAmount": 0,
                })
                if record.get("sourceKind") == "appointment":
                    branch["completedCount"] += 1
                branch["netRevenue"] += int(record.get("netRevenue") or 0)
                branch["insuranceAmount"] += int(record.get("insuranceAmount") or 0)

            service_key = record.get("maDichVu")
            if service_key:
                service = service_map.setdefault(service_key, {
                    "key": service_key,
                    "count": 0,
                    "value": 0,
                    "tenDichVu": record.get("tenDichVu") or service_key,
                    "loaiDichVu": record.get("loaiDichVu") or record.get("type") or "",
                })
                service["count"] += 1
                service["value"] += int(record.get("netRevenue") or 0)

            doctor_key = record.get("maBacSi")
            if doctor_key and record.get("sourceKind") == "appointment":
                doctor = doctor_map.setdefault(doctor_key, {
                    "key": doctor_key,
                    "count": 0,
                    "value": 0,
                    "hoTen": record.get("hoTenBacSi") or doctor_key,
                    "chuyenKhoa": record.get("chuyenKhoa") or "",
                })
                doctor["count"] += 1
                doctor["value"] += 1

        return {
            "success": True,
            "message": "Lấy báo cáo tháng thành công.",
            "data": {
                "totalNetRevenue": total_net_revenue,
                "totalInsuranceAmount": total_insurance_amount,
                "completedAppointmentCount": len(appointment_rows),
                "cancellationRate": cancellation_rate,
                "totalServiceUsage": len(records),
                "branchRows": list(branch_map.values()),
                "doctorRows": sorted(doctor_map.values(), key=lambda row: row["value"], reverse=True),
                "serviceContributionRows": sorted(service_map.values(), key=lambda row: row["value"], reverse=True),
            },
        }

    except Exception as e:
        return {
            "success": False,
            "message": str(e),
            "data": None,
        }

    finally:
        await conn.close()
