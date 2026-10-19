import aiomysql
import pytest
from fastapi.testclient import TestClient

from registry.api import get_identity_client
from registry.catalog import get_catalog_repository
from registry.main import app


class MemoryIdentity:
    async def current_account(self, token):
        return {"id": "admin-id", "role": "admin" if token == "admin" else "patient",
                "is_active": True, "subject_id": None}

    async def active_staff_codes(self, role, codes):
        return {code for code in codes if role == "doctor" and code != "BS_LOCKED"}


class MemoryCatalog:
    def __init__(self):
        self.branches = {}
        self.services = {}
        self.configs = {}
        self.doctors = {
            "BS_ACTIVE": {"MaBacSi": "BS_ACTIVE", "HoTen": "Active Doctor",
                          "ChuyenKhoa": "General", "SDT": None},
            "BS_LOCKED": {"MaBacSi": "BS_LOCKED", "HoTen": "Locked Doctor",
                          "ChuyenKhoa": "General", "SDT": None},
        }

    async def all(self, sql):
        if "FROM staff_profiles" in sql:
            return list(self.doctors.values())
        if "FROM branch_services" in sql:
            return list(self.configs.values())
        if "FROM medical_services" in sql:
            return list(self.services.values())
        return list(self.branches.values())

    async def one(self, sql, params):
        if "FROM staff_profiles" in sql:
            return self.doctors.get(params[0])
        if "FROM branches" in sql:
            return self.branches.get(params[0])
        if "FROM branch_services" in sql:
            return self.configs.get(params[0])
        return self.services.get(params[0])

    async def write(self, sql, params):
        if sql.startswith("INSERT INTO branches"):
            code, name, address, phone, active = params
            if code in self.branches:
                raise aiomysql.IntegrityError(1062, "duplicate")
            self.branches[code] = {
                "MaChiNhanh": code, "TenChiNhanh": name, "DiaChi": address, "SDT": phone,
                "TrangThai": "active" if active else "inactive",
            }
        elif sql.startswith("INSERT INTO medical_services"):
            code, name, specialty, kind, price, active = params
            if code in self.services:
                raise aiomysql.IntegrityError(1062, "duplicate")
            self.services[code] = {
                "MaDichVu": code, "TenDichVu": name, "ChuyenKhoa": specialty,
                "LoaiDichVu": kind, "GiaGoc": price,
                "TrangThai": "active" if active else "inactive",
            }
        elif sql.startswith("UPDATE branch_services SET active = FALSE"):
            code = params[0]
            if code in self.configs:
                self.configs[code]["TrangThai"] = "inactive"
                return 1
            return 0
        else:
            price, code = params
            self.services[code]["GiaGoc"] = price
        return 1

    async def set_catalog_status(self, kind, code, active):
        rows = self.branches if kind == "branch" else self.services
        if code not in rows:
            return False
        rows[code]["TrangThai"] = "active" if active else "inactive"
        if not active:
            column = "MaChiNhanh" if kind == "branch" else "MaDichVu"
            for config in self.configs.values():
                if config[column] == code:
                    config["TrangThai"] = "inactive"
        return True

    async def put_branch_service(self, value):
        if value.MaChiNhanh not in self.branches or value.MaDichVu not in self.services:
            raise aiomysql.IntegrityError(1452, "foreign key")
        if value.TrangThai == "active" and (
            self.branches[value.MaChiNhanh]["TrangThai"] != "active"
            or self.services[value.MaDichVu]["TrangThai"] != "active"
        ):
            raise ValueError("Archived parent")
        self.configs[value.MaCauHinh] = value.model_dump()


@pytest.fixture
def client():
    repository = MemoryCatalog()
    app.dependency_overrides[get_catalog_repository] = lambda: repository
    app.dependency_overrides[get_identity_client] = lambda: MemoryIdentity()
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


def test_catalog_starts_empty_and_writes_require_admin(client):
    base = "/api/v1/registry/catalog"
    assert client.get(f"{base}/branches").json() == []
    assert client.get(f"{base}/services").json() == []
    assert client.get(f"{base}/branch-services").json() == []
    branch = {"MaChiNhanh": "CN_HN", "TenChiNhanh": "Cơ sở Hà Nội", "DiaChi": "Hà Nội", "SDT": None}
    assert client.post(f"{base}/branches", json=branch).status_code == 401
    assert client.post(f"{base}/branches", json=branch,
                       headers={"Authorization": "Bearer patient"}).status_code == 403
    admin = {"Authorization": "Bearer admin"}
    created = client.post(f"{base}/branches", json=branch, headers=admin)
    assert created.status_code == 201
    assert client.get(f"{base}/branches").json() == [{**branch, "TrangThai": "active"}]
    assert client.post(f"{base}/branches", json=branch, headers=admin).status_code == 409
    service = {"MaDichVu": "DV_KHAM", "TenDichVu": "Khám tổng quát", "ChuyenKhoa": "Nội khoa",
               "LoaiDichVu": "Khám lâm sàng", "GiaGoc": 150000}
    assert client.post(f"{base}/services", json=service, headers=admin).status_code == 201
    assert client.patch(f"{base}/services/DV_KHAM/price", json={"GiaGoc": 150000},
                        headers=admin).status_code == 200
    updated = client.patch(f"{base}/services/DV_KHAM/price", json={"GiaGoc": 180000}, headers=admin)
    assert updated.json()["GiaGoc"] == 180000
    assert client.patch(f"{base}/services/UNKNOWN/price", json={"GiaGoc": 1},
                        headers=admin).status_code == 404
    config = {"MaCauHinh": "CH_HN_KHAM", "MaChiNhanh": "CN_HN", "MaDichVu": "DV_KHAM",
              "SlotGioiHan": 10, "TrangThai": "active"}
    assert client.put(f"{base}/branch-services/CH_HN_KHAM", json=config, headers=admin).status_code == 200
    assert client.get(f"{base}/branch-services/CH_HN_KHAM").json() == config
    assert client.get(f"{base}/branch-services/UNKNOWN").status_code == 404
    assert client.patch(f"{base}/branch-services/CH_HN_KHAM",
                        json={"TrangThai": "inactive"}, headers=admin).json()["TrangThai"] == "inactive"
    assert client.get(f"{base}/branch-services").json()[0]["SlotGioiHan"] == 10
    assert client.put(f"{base}/branch-services/WRONG", json=config, headers=admin).status_code == 422


def test_catalog_rejects_invalid_input(client):
    admin = {"Authorization": "Bearer admin"}
    base = "/api/v1/registry/catalog"
    assert client.post(f"{base}/branches", headers=admin, json={
        "MaChiNhanh": "bad code", "TenChiNhanh": "X", "DiaChi": "Y",
    }).status_code == 422
    assert client.post(f"{base}/services", headers=admin, json={
        "MaDichVu": "DV_X", "TenDichVu": "X", "ChuyenKhoa": "Y",
        "LoaiDichVu": "invalid", "GiaGoc": -1,
    }).status_code == 422
    assert client.post(f"{base}/branches", headers=admin, json={
        "MaChiNhanh": "CN_X", "TenChiNhanh": "   ", "DiaChi": "Y",
    }).status_code == 422
    assert client.patch(f"{base}/branch-services/CH_X", headers=admin,
                        json={"SlotGioiHan": None}).status_code == 422
    assert "/api/v1/registry/catalog/branches" in client.get("/openapi.json").json()["paths"]


def test_active_doctors_and_archiving_preserve_catalog_history(client):
    base = "/api/v1/registry/catalog"
    admin = {"Authorization": "Bearer admin"}
    doctor_response = client.get(f"{base}/doctors")
    assert doctor_response.headers["cache-control"] == "no-store"
    assert [row["MaBacSi"] for row in doctor_response.json()] == ["BS_ACTIVE"]
    assert client.get(f"{base}/doctors/BS_LOCKED").status_code == 404
    branch = {"MaChiNhanh": "CN_HN", "TenChiNhanh": "Hanoi", "DiaChi": "Street"}
    service = {"MaDichVu": "DV_KHAM", "TenDichVu": "Exam", "ChuyenKhoa": "General",
               "LoaiDichVu": "Khám lâm sàng", "GiaGoc": 100000}
    assert client.post(f"{base}/branches", json=branch, headers=admin).status_code == 201
    assert client.post(f"{base}/services", json=service, headers=admin).status_code == 201
    config = {"MaCauHinh": "CH_HN_KHAM", "MaChiNhanh": "CN_HN", "MaDichVu": "DV_KHAM",
              "SlotGioiHan": 10}
    assert client.put(f"{base}/branch-services/CH_HN_KHAM", json=config, headers=admin).status_code == 200
    assert client.delete(f"{base}/branches/CN_HN").status_code == 401
    assert client.delete(f"{base}/branches/CN_HN", headers=admin).status_code == 204
    assert client.get(f"{base}/branches").json()[0]["TrangThai"] == "inactive"
    assert client.get(f"{base}/branch-services/CH_HN_KHAM").json()["TrangThai"] == "inactive"
    assert client.patch(f"{base}/branch-services/CH_HN_KHAM", json={"TrangThai": "active"},
                        headers=admin).status_code == 409
    assert client.patch(f"{base}/branches/CN_HN/status", json={"TrangThai": "active"},
                        headers=admin).json()["TrangThai"] == "active"
    assert client.patch(f"{base}/branch-services/CH_HN_KHAM", json={"TrangThai": "active"},
                        headers=admin).status_code == 200
    assert client.delete(f"{base}/services/DV_KHAM", headers=admin).status_code == 204
    assert client.get(f"{base}/services").json()[0]["TrangThai"] == "inactive"
    assert client.get(f"{base}/branch-services/CH_HN_KHAM").json()["TrangThai"] == "inactive"
    assert client.delete(f"{base}/branch-services/CH_HN_KHAM", headers=admin).status_code == 204
    assert client.delete(f"{base}/services/UNKNOWN", headers=admin).status_code == 404
