from check_db import get_connection

from entities.bacsi import BacSi
from entities.benh_nhan import BenhNhan
from entities.le_tan import LeTan
from entities.xet_nghiem import XetNghiemVien


LOCKED_STAFF_STATUS = "Đã khóa"


def is_locked_account(row) -> bool:
    return (row.get("TrangThai") or "Đang hoạt động") == LOCKED_STAFF_STATUS

async def login_doctor(
    MaBacSi: str,
    password: str
):

    conn = await get_connection()

    try:

        cursor = await conn.execute("""
            SELECT *
            FROM bac_si
            WHERE MaBacSi = %s
        """, (MaBacSi,))

        row = await cursor.fetchone()

        if not row:
            return {
                "success": False,
                "message": "Tài khoản hoặc mật khẩu sai.",
                "data": None
            }

        if is_locked_account(row):
            return {
                "success": False,
                "message": "Tài khoản đã bị khóa. Vui lòng liên hệ Admin.",
                "data": None
            }

        bacsi = BacSi.from_dict(dict(row))

        if bacsi.MatKhau != password:
            return {
                "success": False,
                "message": "Tài khoản hoặc mật khẩu sai.",
                "data": None
            }

        return {
            "success": True,
            "message": "Đăng nhập thành công",
            "data": {
                "role": "Bác sĩ",
                "MaBacSi": bacsi.MaBacSi,
                "HoTen": bacsi.HoTen,
                "ChuyenKhoa": bacsi.ChuyenKhoa,
                "SDT": bacsi.SDT,
                "MaChiNhanh": None,
                "MatKhau": bacsi.MatKhau,
                "TrangThai": bacsi.TrangThai,
            }
        }

    finally:
        await conn.close()

async def login_patient(cccd: str, password: str):

    conn = await get_connection()

    try:

        cursor = await conn.execute("""
            SELECT *
            FROM benh_nhan
            WHERE CCCD = %s
        """, (cccd,))

        row = await cursor.fetchone()

        if not row:
            return {
                "success": False,
                "message": "Tài khoản hoặc mật khẩu sai.",
                "data": None
            }

        benhnhan = BenhNhan.from_dict(dict(row))

        if benhnhan.MatKhau != password:
            return {
                "success": False,
                "message": "Tài khoản hoặc mật khẩu sai.",
                "data": None
            }

        return {
            "success": True,
            "message": "Đăng nhập thành công",
            "data": {
                "role": "Bệnh nhân",
                "MaBenhAn": benhnhan.MaBenhAn,
                "HoTen": benhnhan.HoTen,
                "CCCD": benhnhan.CCCD,
                "NgaySinh": benhnhan.NgaySinh,
                "GioiTinh": benhnhan.GioiTinh,
                "SDT": benhnhan.SDT,
                "DiaChi": benhnhan.DiaChi,
                "MatKhau": benhnhan.MatKhau,
                "MaSoBHYT": benhnhan.MaSoBHYT,
                "KyTuDauBHYT": benhnhan.KyTuDauBHYT,
            }
        }

    finally:
        await conn.close()


async def login_le_tan(
    MaLeTan: str,
    password: str
):

    conn = await get_connection()

    try:

        cursor = await conn.execute("""
            SELECT *
            FROM le_tan
            WHERE MaLeTan = %s
        """, (MaLeTan,))

        row = await cursor.fetchone()

        if not row:
            return {
                "success": False,
                "message": "Tài khoản hoặc mật khẩu sai.",
                "data": None
            }

        if is_locked_account(row):
            return {
                "success": False,
                "message": "Tài khoản đã bị khóa. Vui lòng liên hệ Admin.",
                "data": None
            }

        letan = LeTan.from_dict(dict(row))

        if letan.MatKhau != password:
            return {
                "success": False,
                "message": "Tài khoản hoặc mật khẩu sai.",
                "data": None
            }

        return {
            "success": True,
            "message": "Đăng nhập thành công",
            "data": {
                "role": "Lễ tân",
                "MaLeTan": letan.MaLeTan,
                "HoTen": letan.HoTen,
                "SDT": letan.SDT,
                "MatKhau": letan.MatKhau,
                "MaChiNhanh": letan.MaChiNhanh,
                "TrangThai": letan.TrangThai,
            }
        }

    finally:
        await conn.close()


async def login_xet_nghiemVien(
    MaXetNghiemVien: str,
    password: str
):

    conn = await get_connection()

    try:

        cursor = await conn.execute("""
            SELECT *
            FROM xet_nghiem_vien
            WHERE MaXNV = %s
        """, (MaXetNghiemVien,))

        row = await cursor.fetchone()

        if not row:
            return {
                "success": False,
                "message": "Tài khoản hoặc mật khẩu sai.",
                "data": None
            }

        if is_locked_account(row):
            return {
                "success": False,
                "message": "Tài khoản đã bị khóa. Vui lòng liên hệ Admin.",
                "data": None
            }

        xnv = XetNghiemVien.from_dict(dict(row))

        if xnv.MatKhau != password:
            return {
                "success": False,
                "message": "Tài khoản hoặc mật khẩu sai.",
                "data": None
            }

        return {
            "success": True,
            "message": "Đăng nhập thành công",
            "data": {
                "role": "Xét nghiệm viên",
                "MaXNV": xnv.MaXNV,
                "HoTen": xnv.HoTen,
                "SDT": xnv.SDT,
                "MatKhau": xnv.MatKhau,
                "MaChiNhanh": xnv.MaChiNhanh,
                "TrangThai": xnv.TrangThai,
            }
        }

    finally:
        await conn.close()


async def logout_service():

    return {
        "success": True,
        "message": "Đăng xuất thành công",
        "data": None
    }


async def get_session_user(role: str, user_id: str):
    normalized_role = (role or "").strip().lower()
    normalized_user_id = (user_id or "").strip()

    if not normalized_role or not normalized_user_id:
        return {
            "success": False,
            "message": "Phiên đăng nhập không hợp lệ.",
            "data": None,
        }

    if normalized_role == "admin":
        if normalized_user_id == "admin":
            return {
                "success": True,
                "message": "Khôi phục phiên Admin thành công.",
                "data": {
                    "role": "Admin",
                    "username": "admin",
                },
            }

        return {
            "success": False,
            "message": "Phiên Admin không hợp lệ.",
            "data": None,
        }

    conn = await get_connection()

    try:
        if normalized_role == "patient":
            cursor = await conn.execute("""
                SELECT *
                FROM benh_nhan
                WHERE MaBenhAn = %s OR CCCD = %s
                LIMIT 1
            """, (normalized_user_id, normalized_user_id))
            row = await cursor.fetchone()

            if not row:
                return {
                    "success": False,
                    "message": "Không tìm thấy tài khoản bệnh nhân.",
                    "data": None,
                }

            benhnhan = BenhNhan.from_dict(dict(row))
            return {
                "success": True,
                "message": "Khôi phục phiên bệnh nhân thành công.",
                "data": {
                    "role": "Bệnh nhân",
                    "MaBenhAn": benhnhan.MaBenhAn,
                    "HoTen": benhnhan.HoTen,
                    "CCCD": benhnhan.CCCD,
                    "NgaySinh": benhnhan.NgaySinh,
                    "GioiTinh": benhnhan.GioiTinh,
                    "SDT": benhnhan.SDT,
                    "DiaChi": benhnhan.DiaChi,
                    "MatKhau": benhnhan.MatKhau,
                    "MaSoBHYT": benhnhan.MaSoBHYT,
                    "KyTuDauBHYT": benhnhan.KyTuDauBHYT,
                },
            }

        if normalized_role == "doctor":
            cursor = await conn.execute("""
                SELECT *
                FROM bac_si
                WHERE MaBacSi = %s
                LIMIT 1
            """, (normalized_user_id,))
            row = await cursor.fetchone()

            if not row:
                return {
                    "success": False,
                    "message": "Không tìm thấy tài khoản bác sĩ.",
                    "data": None,
                }

            if is_locked_account(row):
                return {
                    "success": False,
                    "message": "Tài khoản bác sĩ đã bị khóa.",
                    "data": None,
                }

            bacsi = BacSi.from_dict(dict(row))
            return {
                "success": True,
                "message": "Khôi phục phiên bác sĩ thành công.",
                "data": {
                    "role": "Bác sĩ",
                    "MaBacSi": bacsi.MaBacSi,
                    "HoTen": bacsi.HoTen,
                    "ChuyenKhoa": bacsi.ChuyenKhoa,
                    "SDT": bacsi.SDT,
                    "MaChiNhanh": None,
                    "MatKhau": bacsi.MatKhau,
                    "TrangThai": bacsi.TrangThai,
                },
            }

        if normalized_role == "letan":
            cursor = await conn.execute("""
                SELECT *
                FROM le_tan
                WHERE MaLeTan = %s
                LIMIT 1
            """, (normalized_user_id,))
            row = await cursor.fetchone()

            if not row:
                return {
                    "success": False,
                    "message": "Không tìm thấy tài khoản lễ tân.",
                    "data": None,
                }

            if is_locked_account(row):
                return {
                    "success": False,
                    "message": "Tài khoản lễ tân đã bị khóa.",
                    "data": None,
                }

            letan = LeTan.from_dict(dict(row))
            return {
                "success": True,
                "message": "Khôi phục phiên lễ tân thành công.",
                "data": {
                    "role": "Lễ tân",
                    "MaLeTan": letan.MaLeTan,
                    "HoTen": letan.HoTen,
                    "SDT": letan.SDT,
                    "MatKhau": letan.MatKhau,
                    "MaChiNhanh": letan.MaChiNhanh,
                    "TrangThai": letan.TrangThai,
                },
            }

        if normalized_role == "xnv":
            cursor = await conn.execute("""
                SELECT *
                FROM xet_nghiem_vien
                WHERE MaXNV = %s
                LIMIT 1
            """, (normalized_user_id,))
            row = await cursor.fetchone()

            if not row:
                return {
                    "success": False,
                    "message": "Không tìm thấy tài khoản xét nghiệm viên.",
                    "data": None,
                }

            if is_locked_account(row):
                return {
                    "success": False,
                    "message": "Tài khoản xét nghiệm viên đã bị khóa.",
                    "data": None,
                }

            xnv = XetNghiemVien.from_dict(dict(row))
            return {
                "success": True,
                "message": "Khôi phục phiên xét nghiệm viên thành công.",
                "data": {
                    "role": "Xét nghiệm viên",
                    "MaXNV": xnv.MaXNV,
                    "HoTen": xnv.HoTen,
                    "SDT": xnv.SDT,
                    "MatKhau": xnv.MatKhau,
                    "MaChiNhanh": xnv.MaChiNhanh,
                    "TrangThai": xnv.TrangThai,
                },
            }

        return {
            "success": False,
            "message": "Vai trò trong phiên đăng nhập không hợp lệ.",
            "data": None,
        }
    finally:
        await conn.close()


async def login_admin(
    username: str,
    password: str
):

    if username == "admin" and password in ("admin", "admin123"):

        return {
            "success": True,
            "message": "Đăng nhập thành công",
            "data": {
                "role": "Admin",
                "username": username
            }
        }

    return {
        "success": False,
        "message": "Tài khoản hoặc mật khẩu sai.",
        "data": None
    }


async def create_doctor_account(
    name: str,
    MaBacSi: str,
    chuyen_khoa: str,
    sdt: str,
    password: str
):

    conn = await get_connection()

    try:

        cursor = await conn.execute("""
            SELECT *
            FROM bac_si
            WHERE MaBacSi = %s
        """, (MaBacSi,))

        existed = await cursor.fetchone()

        if existed:
            return {
                "success": False,
                "message": "Tài khoản đã tồn tại.",
                "data": None
            }

        await conn.execute("""
            INSERT INTO bac_si (
                MaBacSi,
                HoTen,
                ChuyenKhoa,
                SDT,
                MatKhau
            )
            VALUES (%s, %s, %s, %s, %s)
        """, (
            MaBacSi,
            name,
            chuyen_khoa,
            sdt,
            password
        ))

        await conn.commit()

        return {
            "success": True,
            "message": "Tạo tài khoản bác sĩ thành công",
            "data": {
                "MaBacSi": MaBacSi
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
        
async def delete_doctor_account(
    MaBacSi: str
):

    conn = await get_connection()

    try:

        cursor = await conn.execute("""
            SELECT *
            FROM bac_si
            WHERE MaBacSi = %s
        """, (MaBacSi,))

        doctor = await cursor.fetchone()

        if not doctor:
            return {
                "success": False,
                "message": "Tài khoản không tồn tại.",
                "data": None
            }

        await conn.execute("""
            DELETE FROM bac_si
            WHERE MaBacSi = %s
        """, (MaBacSi,))

        await conn.commit()

        return {
            "success": True,
            "message": "Xóa tài khoản bác sĩ thành công",
            "data": None
        }

    finally:
        await conn.close()


async def create_xnv_account(
    name: str,
    MaXNV: str,
    sdt: str,
    password: str,
    ma_chi_nhanh: str
):

    conn = await get_connection()

    try:

        cursor = await conn.execute("""
            SELECT *
            FROM xet_nghiem_vien
            WHERE MaXNV = %s
        """, (MaXNV,))

        existed = await cursor.fetchone()

        if existed:
            return {
                "success": False,
                "message": "Tài khoản đã tồn tại.",
                "data": None
            }

        await conn.execute("""
            INSERT INTO xet_nghiem_vien (
                MaXNV,
                HoTen,
                SDT,
                MatKhau,
                MaChiNhanh
            )
            VALUES (%s, %s, %s, %s, %s)
        """, (
            MaXNV,
            name,
            sdt,
            password,
            ma_chi_nhanh
        ))

        await conn.commit()

        return {
            "success": True,
            "message": "Tạo tài khoản xét nghiệm viên thành công",
            "data": {
                "MaXNV": MaXNV,
                "MaChiNhanh": ma_chi_nhanh
            }
        }

    finally:
        await conn.close()


async def delete_xnv_account(
    MaXNV: str
):

    conn = await get_connection()

    try:

        cursor = await conn.execute("""
            SELECT *
            FROM xet_nghiem_vien
            WHERE MaXNV = %s
        """, (MaXNV,))

        xnv = await cursor.fetchone()

        if not xnv:
            return {
                "success": False,
                "message": "Tài khoản không tồn tại.",
                "data": None
            }

        await conn.execute("""
            DELETE FROM xet_nghiem_vien
            WHERE MaXNV = %s
        """, (MaXNV,))

        await conn.commit()

        return {
            "success": True,
            "message": "Xóa tài khoản xét nghiệm viên thành công",
            "data": None
        }

    finally:
        await conn.close()


async def change_doctor_password(
    MaBacSi: str,
    new_password: str
):

    conn = await get_connection()

    try:

        cursor = await conn.execute("""
            SELECT *
            FROM bac_si
            WHERE MaBacSi = %s
        """, (MaBacSi,))

        doctor = await cursor.fetchone()

        if not doctor:
            return {
                "success": False,
                "message": "Tài khoản không tồn tại.",
                "data": None
            }

        await conn.execute("""
            UPDATE bac_si
            SET MatKhau = %s
            WHERE MaBacSi = %s
        """, (
            new_password,
            MaBacSi
        ))

        await conn.commit()

        return {
            "success": True,
            "message": "Đổi mật khẩu bác sĩ thành công",
            "data": None
        }

    finally:
        await conn.close()


async def change_xnv_password(
    MaXNV: str,
    new_password: str
):

    conn = await get_connection()

    try:

        cursor = await conn.execute("""
            SELECT *
            FROM xet_nghiem_vien
            WHERE MaXNV = %s
        """, (MaXNV,))

        xnv = await cursor.fetchone()

        if not xnv:
            return {
                "success": False,
                "message": "Tài khoản không tồn tại.",
                "data": None
            }

        await conn.execute("""
            UPDATE xet_nghiem_vien
            SET MatKhau = %s
            WHERE MaXNV = %s
        """, (
            new_password,
            MaXNV
        ))

        await conn.commit()

        return {
            "success": True,
            "message": "Đổi mật khẩu xét nghiệm viên thành công",
            "data": None
        }

    finally:
        await conn.close()
