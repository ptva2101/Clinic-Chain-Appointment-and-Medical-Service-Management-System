from dataclasses import dataclass
from typing import Optional, Dict, Any


@dataclass
class LichSuThongBao:
    MaThongBao: str
    MaLichHen: str
    MaBenhAn: str
    NoiDung: str
    TrangThai: Optional[str]
    DaDoc: int = 0

    __tablename__ = "LICH_SU_THONG_BAO"

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "LichSuThongBao":
        return cls(
            MaThongBao=d.get("MaThongBao"),
            MaLichHen=d.get("MaLichHen"),
            MaBenhAn=d.get("MaBenhAn"),
            NoiDung=d.get("NoiDung"),
            TrangThai=d.get("TrangThai"),
            DaDoc=int(d.get("DaDoc") or 0),
        )
