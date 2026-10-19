from dataclasses import dataclass
from typing import Optional, Dict, Any


@dataclass
class BacSi:
	MaBacSi: str
	HoTen: str
	ChuyenKhoa: str
	SDT: str
	MatKhau: str
	TrangThai: str = "Đang hoạt động"

	__tablename__ = "BAC_SI"

	@classmethod
	def from_dict(cls, d: Dict[str, Any]) -> "BacSi":
		return cls(
			MaBacSi=d.get("MaBacSi"),
			HoTen=d.get("HoTen"),
			ChuyenKhoa=d.get("ChuyenKhoa"),
			SDT=d.get("SDT"),
			MatKhau=d.get("MatKhau"),
			TrangThai=d.get("TrangThai") or "Đang hoạt động",
		)
