from dataclasses import dataclass
from typing import Dict, Any


@dataclass
class LeTan:
    MaLeTan: str
    HoTen: str
    SDT: str
    MatKhau: str
    MaChiNhanh: str
    TrangThai: str = "Đang hoạt động"

    __tablename__ = "LE_TAN"

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "LeTan":
        return cls(
            MaLeTan=d.get("MaLeTan"),
            HoTen=d.get("HoTen"),
            SDT=d.get("SDT"),
            MatKhau=d.get("MatKhau"),
            MaChiNhanh=d.get("MaChiNhanh"),
            TrangThai=d.get("TrangThai") or "Đang hoạt động",
        )
