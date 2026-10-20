from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from scheduling.api import get_identity_client, get_registry_client, get_repository
from scheduling.main import app
from scheduling.registry_client import InvalidScheduleReference
from scheduling.repository import ScheduleConflict


class MemoryIdentity:
    async def current_account(self, token):
        return {
            "id": token,
            "role": "admin" if token == "admin" else "patient",
            "is_active": True,
        }


class MemoryRegistry:
    async def verify_references(self, token, doctor_codes, branch_codes):
        if not doctor_codes.issubset({"BS900", "BS901"}) or branch_codes != {"CN_HN"}:
            raise InvalidScheduleReference("Unknown doctor or branch")


class MemorySchedules:
    def __init__(self):
        self.rows = []
        self.booked_ids = set()

    async def get_schedule(self, schedule_id):
        return next((row for row in self.rows if row["id"] == schedule_id), None)

    async def change_schedule(self, schedule_id, new_doctor_code=None):
        row = await self.get_schedule(schedule_id)
        if row is None or row["status"] != "active":
            raise ScheduleConflict("Doctor schedule is not active")
        if schedule_id in self.booked_ids:
            raise ScheduleConflict("Shift has active appointments")
        if new_doctor_code:
            row["doctor_code"] = new_doctor_code
        else:
            row["status"] = "cancelled"
        return row

    async def list_schedules(self, from_date, to_date, doctor_code):
        return [row for row in self.rows
                if (from_date is None or row["duty_date"] >= from_date)
                and (to_date is None or row["duty_date"] <= to_date)
                and (doctor_code is None or row["doctor_code"] == doctor_code)]

    async def create_many(self, schedules):
        existing = {(row["doctor_code"], row["duty_date"], row["shift"])
                    for row in self.rows}
        if any((item.MaBacSi, item.NgayTruc, item.CaTruc) in existing for item in schedules):
            raise ScheduleConflict("Doctor already has a shift at this time")
        created = []
        for item in schedules:
            row = {
                "id": len(self.rows) + 1,
                "doctor_code": item.MaBacSi,
                "branch_code": item.MaChiNhanh,
                "duty_date": item.NgayTruc,
                "shift": item.CaTruc,
                "status": "active",
            }
            self.rows.append(row)
            created.append(row)
        return created


@pytest.fixture
def client():
    repository = MemorySchedules()
    app.dependency_overrides[get_repository] = lambda: repository
    app.dependency_overrides[get_identity_client] = lambda: MemoryIdentity()
    app.dependency_overrides[get_registry_client] = lambda: MemoryRegistry()
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


def test_schedule_bulk_creation_and_filtering(client):
    base = "/api/v1/scheduling/doctor-schedules"
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    next_day = (date.today() + timedelta(days=2)).isoformat()
    body = {"schedules": [
        {"MaBacSi": "BS900", "MaChiNhanh": "CN_HN", "NgayTruc": tomorrow, "CaTruc": 1},
        {"MaBacSi": "BS900", "MaChiNhanh": "CN_HN", "NgayTruc": next_day, "CaTruc": 2},
    ]}
    assert client.get(base).json() == []
    assert client.post(f"{base}/bulk", json=body).status_code == 401
    assert client.post(f"{base}/bulk", json=body,
                       headers={"Authorization": "Bearer patient"}).status_code == 403
    admin = {"Authorization": "Bearer admin"}
    created = client.post(f"{base}/bulk", json=body, headers=admin)
    assert created.status_code == 201
    assert [row["MaLichTruc"] for row in created.json()] == ["LT_000001", "LT_000002"]
    assert len(client.get(base, params={"from_date": next_day}).json()) == 1
    assert len(client.get(base, params={"ma_bac_si": "BS900"}).json()) == 2
    assert client.post(f"{base}/bulk", json=body, headers=admin).status_code == 409
    assert len(client.get(base).json()) == 2
    assert client.get(base, params={"from_date": next_day, "to_date": tomorrow}).status_code == 422
    assert base in client.get("/openapi.json").json()["paths"]


def test_schedule_validation_and_atomic_conflict(client):
    base = "/api/v1/scheduling/doctor-schedules/bulk"
    day = (date.today() + timedelta(days=1)).isoformat()
    valid = {"MaBacSi": "BS900", "MaChiNhanh": "CN_HN", "NgayTruc": day, "CaTruc": 1}
    admin = {"Authorization": "Bearer admin"}
    assert client.post(base, json={"schedules": [valid, valid]}, headers=admin).status_code == 422
    assert client.post(base, json={"schedules": [{**valid, "CaTruc": 5}]}, headers=admin).status_code == 422
    assert client.post(base, json={"schedules": [{**valid, "MaBacSi": "   "}]},
                       headers=admin).status_code == 422
    assert client.post(base, json={"schedules": [{**valid, "MaBacSi": "UNKNOWN"}]},
                       headers=admin).status_code == 422
    assert client.get("/api/v1/scheduling/doctor-schedules").json() == []


def test_only_unbooked_shifts_can_be_cancelled_or_transferred(client):
    base = "/api/v1/scheduling/doctor-schedules"
    admin = {"Authorization": "Bearer admin"}
    day = (date.today() + timedelta(days=1)).isoformat()
    created = client.post(f"{base}/bulk", json={"schedules": [
        {"MaBacSi": "BS900", "MaChiNhanh": "CN_HN", "NgayTruc": day, "CaTruc": 1},
        {"MaBacSi": "BS900", "MaChiNhanh": "CN_HN", "NgayTruc": day, "CaTruc": 2},
        {"MaBacSi": "BS900", "MaChiNhanh": "CN_HN", "NgayTruc": day, "CaTruc": 3},
    ]}, headers=admin).json()
    repo = app.dependency_overrides[get_repository]()
    repo.booked_ids.add(created[0]["id"])
    assert client.post(f"{base}/1/cancel", headers=admin).status_code == 409
    assert client.post(f"{base}/1/transfer", json={"new_doctor_code": "BS900"},
                       headers=admin).status_code == 409
    assert client.post(f"{base}/2/cancel").status_code == 401
    assert client.post(f"{base}/2/cancel", headers=admin).status_code == 200
    assert client.post(f"{base}/2/cancel", headers=admin).status_code == 409
    transferred = client.post(f"{base}/3/transfer", json={"new_doctor_code": "BS901"}, headers=admin)
    assert transferred.status_code == 200
    assert transferred.json()["MaBacSi"] == "BS901"
