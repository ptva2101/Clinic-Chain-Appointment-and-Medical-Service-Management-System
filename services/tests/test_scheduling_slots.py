from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from scheduling.api import get_identity_client, get_registry_client
from scheduling.main import app
from scheduling.registry_client import InvalidScheduleReference
from scheduling.slot_repository import HoldConflict, HoldNotFound, SlotUnavailable
from scheduling.slots import get_slot_repository


CONFIG = {"MaCauHinh": "CH_HN_KHAM", "MaChiNhanh": "CN_HN", "MaDichVu": "DV_KHAM",
          "SlotGioiHan": 1, "TrangThai": "active"}


class MemoryIdentity:
    async def current_account(self, token):
        return {"id": token, "role": "admin" if token == "admin" else "patient",
                "is_active": True, "subject_id": f"profile-{token}"}


class MemoryRegistry:
    active_doctors = {"BS900"}

    async def active_doctor_codes(self, codes):
        return codes & self.active_doctors

    async def booking_config(self, code):
        if code != CONFIG["MaCauHinh"]:
            raise InvalidScheduleReference("Branch/service configuration not found")
        return CONFIG.copy()


class MemorySlots:
    def __init__(self):
        self.holds = {}
        self.doctors = ["BS900"]

    async def availability(self, config_code, branch_code, duty_date, shift):
        held = sum(row["state"] == "held" and row["expires_at"] > datetime.now(timezone.utc).replace(tzinfo=None)
                   for row in self.holds.values())
        confirmed = sum(row["state"] == "confirmed" for row in self.holds.values())
        return {"doctors": self.doctors, "held": held, "confirmed": confirmed}

    async def create_hold(self, body, config, patient_id, ttl_seconds):
        for row in self.holds.values():
            if row["patient_id"] == patient_id and row["request_key"] == body.idempotency_key:
                if row["doctor_code"] != body.doctor_code or row["duty_date"] != body.date:
                    raise HoldConflict("Idempotency key belongs to another request")
                return row
        usage = await self.availability(body.config_code, config["MaChiNhanh"], body.date,
                                        body.shift)
        if (config["TrangThai"] != "active" or body.doctor_code not in self.doctors
                or usage["held"] + usage["confirmed"] >= config["SlotGioiHan"]):
            raise SlotUnavailable("No available slot")
        row = {"id": str(uuid4()), "patient_id": patient_id,
               "request_key": body.idempotency_key, "config_code": body.config_code,
               "branch_code": config["MaChiNhanh"], "service_code": config["MaDichVu"],
               "doctor_code": body.doctor_code, "duty_date": body.date,
               "shift": body.shift, "state": "held",
               "expires_at": datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(seconds=ttl_seconds),
               "appointment_id": None}
        self.holds[row["id"]] = row
        return row

    async def get_hold(self, hold_id, patient_id=None):
        row = self.holds.get(hold_id)
        if row and (patient_id is None or row["patient_id"] == patient_id):
            return row
        return None

    async def transition_hold(self, hold_id, action, patient_id=None, appointment_id=None):
        row = await self.get_hold(hold_id, patient_id)
        if row is None:
            raise HoldNotFound("Hold not found")
        if row["state"] == "held" and row["expires_at"] <= datetime.now(timezone.utc).replace(tzinfo=None):
            row["state"] = "expired"
        if action == "confirm":
            if row["state"] == "confirmed" and row["appointment_id"] == appointment_id:
                return row
            if row["state"] != "held":
                raise HoldConflict("Hold has expired or was released")
            row["state"] = "confirmed"
            row["appointment_id"] = appointment_id
        elif action == "release":
            if row["state"] == "confirmed" and patient_id is not None:
                raise HoldConflict("Confirmed hold must be released by Appointment")
            if row["state"] in ("held", "confirmed"):
                row["state"] = "released"
        return row


@pytest.fixture
def client(monkeypatch):
    store = MemorySlots()
    monkeypatch.setenv("SCHEDULING_INTERNAL_TOKEN", "service-secret")
    app.dependency_overrides[get_slot_repository] = lambda: store
    app.dependency_overrides[get_identity_client] = lambda: MemoryIdentity()
    app.dependency_overrides[get_registry_client] = lambda: MemoryRegistry()
    try:
        with TestClient(app) as test_client:
            yield test_client, store
    finally:
        app.dependency_overrides.clear()


def payload(**overrides):
    return {"config_code": "CH_HN_KHAM", "doctor_code": "BS900",
            "date": (date.today() + timedelta(days=1)).isoformat(), "shift": 1,
            "idempotency_key": "request-001", **overrides}


def test_availability_hold_idempotency_and_capacity(client):
    http, _store = client
    base = "/api/v1/scheduling"
    query = {"config_code": "CH_HN_KHAM", "date": payload()["date"], "shift": 1}
    assert http.get(f"{base}/availability", params=query).json()["available"] == 1
    assert http.get(f"{base}/availability", params={**query, "date": "2020-01-01"}).json()["available"] == 0
    assert http.get(f"{base}/availability", params={**query, "doctor_code": "OTHER"}).json()["available"] == 0
    assert http.get(f"{base}/availability", params={**query, "config_code": "NOPE"}).status_code == 404
    assert http.post(f"{base}/holds", json=payload()).status_code == 401
    assert http.post(f"{base}/holds", json=payload(),
                     headers={"Authorization": "Bearer admin"}).status_code == 403
    headers = {"Authorization": "Bearer patient-a"}
    first = http.post(f"{base}/holds", json=payload(), headers=headers)
    assert first.status_code == 200
    hold_id = first.json()["id"]
    assert first.json()["state"] == "held"
    assert http.post(f"{base}/holds", json=payload(), headers=headers).json()["id"] == hold_id
    assert http.get(f"{base}/availability", params=query).json()["available"] == 0
    assert http.post(f"{base}/holds", json=payload(idempotency_key="request-002"),
                     headers={"Authorization": "Bearer patient-b"}).status_code == 409
    assert http.post(f"{base}/holds", json=payload(doctor_code="BS901"), headers=headers).status_code == 409
    assert http.get(f"{base}/holds/{hold_id}", headers={"Authorization": "Bearer patient-b"}).status_code == 404
    assert http.delete(f"{base}/holds/{hold_id}", headers=headers).json()["state"] == "released"
    assert http.get(f"{base}/availability", params=query).json()["available"] == 1
    assert http.post(f"{base}/holds", json=payload(idempotency_key="request-003"),
                     headers={"Authorization": "Bearer patient-b"}).status_code == 200


def test_locked_doctor_is_hidden_and_cannot_be_booked(client, monkeypatch):
    http, _store = client
    monkeypatch.setattr(MemoryRegistry, "active_doctors", set())
    base = "/api/v1/scheduling"
    query = {"config_code": "CH_HN_KHAM", "date": payload()["date"], "shift": 1}
    available = http.get(f"{base}/availability", params=query)
    assert available.status_code == 200
    assert available.json()["doctors"] == []
    assert available.json()["available"] == 0
    assert http.post(f"{base}/holds", json=payload(),
                     headers={"Authorization": "Bearer patient-a"}).status_code == 409


def test_internal_confirmation_and_expiry(client):
    http, store = client
    base = "/api/v1/scheduling"
    headers = {"Authorization": "Bearer patient-a"}
    hold_id = http.post(f"{base}/holds", json=payload(), headers=headers).json()["id"]
    confirm = f"{base}/internal/holds/{hold_id}/confirm"
    assert http.post(confirm, json={"appointment_id": "AP1"}).status_code == 401
    assert http.post(confirm, json={"appointment_id": "AP1"},
                     headers={"X-Service-Token": "wrong"}).status_code == 401
    service = {"X-Service-Token": "service-secret"}
    assert http.post(confirm, json={"appointment_id": "AP1"}, headers=service).json()["state"] == "confirmed"
    assert http.post(confirm, json={"appointment_id": "AP1"}, headers=service).status_code == 200
    assert http.post(confirm, json={"appointment_id": "AP2"}, headers=service).status_code == 409
    assert http.delete(f"{base}/holds/{hold_id}", headers=headers).status_code == 409
    assert http.post(f"{base}/internal/holds/{hold_id}/release", headers=service).json()["state"] == "released"
    assert http.post(f"{base}/internal/holds/{hold_id}/release", headers=service).status_code == 200
    expiring = http.post(f"{base}/holds", json=payload(idempotency_key="request-004"),
                         headers=headers).json()["id"]
    store.holds[expiring]["expires_at"] = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=1)
    assert http.get(f"{base}/holds/{expiring}", headers=headers).json()["state"] == "expired"
    assert http.post(f"{base}/internal/holds/{expiring}/confirm", json={"appointment_id": "AP3"},
                     headers=service).status_code == 409
    assert http.post(f"{base}/holds", json=payload(date="2020-01-01"), headers=headers).status_code == 422
    paths = http.get("/openapi.json").json()["paths"]
    assert f"{base}/availability" in paths
    assert f"{base}/holds" in paths
