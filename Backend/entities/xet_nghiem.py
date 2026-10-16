from dataclasses import dataclass
from typing import Dict, Any


@dataclass
class XetNghiemVien:
    MaXNV: str
    HoTen: str
    SDT: str
    MatKhau: str
    MaChiNhanh: str
    TrangThai: str = "Đang hoạt động"

    __tablename__ = "XET_NGHIEM_VIEN"

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "XetNghiemVien":
        return cls(
            MaXNV=d.get("MaXNV"),
            HoTen=d.get("HoTen"),
            SDT=d.get("SDT"),
            MatKhau=d.get("MatKhau"),
            MaChiNhanh=d.get("MaChiNhanh"),
            TrangThai=d.get("TrangThai") or "Đang hoạt động",
        )
