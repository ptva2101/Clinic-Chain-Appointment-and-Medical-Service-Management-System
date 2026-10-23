from datetime import date, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from appointment.api import get_billing_client, get_identity_client, get_repository, get_scheduling_client
from appointment.main import app
from appointment.repository import AppointmentConflict, AppointmentNotFound
from appointment.scheduling_client import SchedulingRejected, SchedulingUnavailable


class MemoryIdentity:
    async def current_account(self, token):
        return {"id": token, "role": "admin" if token == "admin" else
                "doctor" if token == "doctor" else "patient", "is_active": True,
                "subject_id": None if token == "admin" else
                "BS900" if token == "doctor" else f"patient-{token}"}


class MemoryScheduling:
    def __init__(self):
        self.holds = {}
        self.unavailable_on_confirm = False
        self.reject_on_confirm = False
        self.unavailable_on_release = False

    async def create_hold(self, token, body):
        key = (token, body["idempotency_key"])
        if key not in self.holds:
            self.holds[key] = {"id": str(uuid4()), "state": "held", "appointment_id": None,
                               "config_code": body["config_code"], "branch_code": "CN_HN",
                               "service_code": "DV_KHAM", "doctor_code": body["doctor_code"],
                               "date": body["date"], "shift": body["shift"]}
        if self.holds[key]["state"] in ("released", "expired"):
            raise SchedulingRejected(409, "Hold is no longer active")
        return self.holds[key]

    async def confirm(self, hold_id, appointment_id):
        if self.unavailable_on_confirm:
            raise SchedulingUnavailable("Scheduling service is unavailable")
        if self.reject_on_confirm:
            raise SchedulingRejected(409, "Hold expired")
        hold = next(row for row in self.holds.values() if row["id"] == hold_id)
        if hold["appointment_id"] and hold["appointment_id"] != appointment_id:
            raise SchedulingRejected(409, "Another appointment owns the hold")
        hold["state"] = "confirmed"
        hold["appointment_id"] = appointment_id
        return hold

    async def release(self, hold_id):
        if self.unavailable_on_release:
            raise SchedulingUnavailable("Scheduling service is unavailable")
        hold = next(row for row in self.holds.values() if row["id"] == hold_id)
        hold["state"] = "released"
        return hold


class MemoryBilling:
    status = None

    async def payment_status(self, _appointment_id):
        return self.status


class MemoryAppointments:
    def __init__(self):
        self.rows = {}
        self.notifications = []
        self.checked_in_ids = set()

    async def get(self, appointment_id):
        return self.rows.get(appointment_id)

    async def by_hold(self, hold_id):
        return next((row for row in self.rows.values() if row["hold_id"] == hold_id), None)

    async def reserve(self, hold, account):
        existing = await self.by_hold(hold["id"])
        if existing:
            if existing["patient_account_id"] != account["id"]:
                raise AppointmentConflict("Hold belongs to another patient")
            return existing
        now = datetime.now()
        row = {"id": str(uuid4()), "hold_id": hold["id"],
               "patient_account_id": account["id"], "patient_id": account["subject_id"],
               "config_code": hold["config_code"], "branch_code": hold["branch_code"],
               "service_code": hold["service_code"], "doctor_code": hold["doctor_code"],
               "duty_date": date.fromisoformat(hold["date"]), "shift": hold["shift"],
               "status": "pending", "created_at": now, "updated_at": now}
        self.rows[row["id"]] = row
        return row

    async def set_status(self, appointment_id, expected, next_status):
        row = self.rows.get(appointment_id)
        if row is None:
            raise AppointmentNotFound("Appointment not found")
        if row["status"] != next_status and row["status"] not in expected:
            raise AppointmentConflict("Invalid status change")
        if next_status == "cancel_pending" and appointment_id in self.checked_in_ids:
            raise AppointmentConflict("Checked-in appointment cannot be cancelled")
        changed = row["status"] != next_status
        row["status"] = next_status
        if changed and next_status in ("confirmed", "cancelled"):
            self.notifications.append({
                "id": str(uuid4()), "appointment_id": appointment_id,
                "patient_account_id": row["patient_account_id"],
                "content": "Appointment " + next_status,
                "is_read": False, "created_at": datetime.now(),
            })
        return row

    async def list_notifications(self, account_id):
        return [row for row in self.notifications if row["patient_account_id"] == account_id]

    async def mark_notifications_read(self, account_id):
        unread = [row for row in self.notifications if row["patient_account_id"] == account_id
                  and not row["is_read"]]
        for row in unread:
            row["is_read"] = True
        return len(unread)

    async def list(self, patient_id=None, doctor_code=None, from_date=None,
                   to_date=None, status=None):
        return [row for row in self.rows.values()
                if (patient_id is None or row["patient_id"] == patient_id)
                and (doctor_code is None or row["doctor_code"] == doctor_code)
                and (from_date is None or row["duty_date"] >= from_date)
                and (to_date is None or row["duty_date"] <= to_date)
                and (status is None or row["status"] == status)]


@pytest.fixture
def client():
    repository = MemoryAppointments()
    scheduling = MemoryScheduling()
    scheduling.billing = MemoryBilling()
    app.dependency_overrides[get_repository] = lambda: repository
    app.dependency_overrides[get_scheduling_client] = lambda: scheduling
    app.dependency_overrides[get_billing_client] = lambda: scheduling.billing
    app.dependency_overrides[get_identity_client] = lambda: MemoryIdentity()
    try:
        with TestClient(app) as http:
            yield http, repository, scheduling
    finally:
        app.dependency_overrides.clear()


def booking_body():
    return {"config_code": "CH_HN_KHAM", "doctor_code": "BS900",
            "date": (date.today() + timedelta(days=1)).isoformat(), "shift": 1,
            "idempotency_key": "request-001"}


def test_booking_lists_and_cancel(client):
    http, _repository, _scheduling = client
    base = "/api/v1/appointments"
    body = booking_body()
    patient = {"Authorization": "Bearer patient-a"}
    assert http.post(base, json=body).status_code == 401
    assert http.post(base, json=body, headers={"Authorization": "Bearer admin"}).status_code == 403
    created = http.post(base, json=body, headers=patient)
    assert created.status_code == 201
    assert created.json()["status"] == "confirmed"
    appointment_id = created.json()["id"]
    assert http.post(base, json=body, headers=patient).json()["id"] == appointment_id
    assert len(http.get(f"{base}/me", headers=patient).json()) == 1
    assert http.get(f"{base}/{appointment_id}", headers={"Authorization": "Bearer patient-b"}).status_code == 404
    assert len(http.get(base, headers={"Authorization": "Bearer admin"}).json()) == 1
    assert len(http.get(f"{base}/doctor/me", headers={"Authorization": "Bearer doctor"}).json()) == 1
    assert http.post(f"{base}/{appointment_id}/cancel", headers=patient).json()["status"] == "cancelled"
    assert http.post(f"{base}/{appointment_id}/cancel", headers=patient).status_code == 200
    assert http.post(base, json=body, headers=patient).status_code == 409
    assert base in http.get("/openapi.json").json()["paths"]


def test_paid_appointment_cannot_be_cancelled_without_refund(client):
    http, _repository, scheduling = client
    patient = {"Authorization": "Bearer patient-a"}
    appointment_id = http.post("/api/v1/appointments", json=booking_body(),
                               headers=patient).json()["id"]
    scheduling.billing.status = "paid"
    result = http.post(f"/api/v1/appointments/{appointment_id}/cancel", headers=patient)
    assert result.status_code == 409
    assert http.get(f"/api/v1/appointments/{appointment_id}",
                    headers=patient).json()["status"] == "confirmed"


def test_refunded_appointment_can_be_cancelled_and_releases_slot(client):
    http, _repository, scheduling = client
    patient = {"Authorization": "Bearer patient-a"}
    appointment_id = http.post("/api/v1/appointments", json=booking_body(),
                               headers=patient).json()["id"]
    scheduling.billing.status = "refunded"
    cancelled = http.post(f"/api/v1/appointments/{appointment_id}/cancel", headers=patient)
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    assert next(iter(scheduling.holds.values()))["state"] == "released"


def test_cancel_retries_after_scheduling_outage(client):
    http, repository, scheduling = client
    patient = {"Authorization": "Bearer patient-a"}
    appointment_id = http.post("/api/v1/appointments", json=booking_body(),
                               headers=patient).json()["id"]
    scheduling.unavailable_on_release = True
    assert http.post(f"/api/v1/appointments/{appointment_id}/cancel", headers=patient).status_code == 503
    assert repository.rows[appointment_id]["status"] == "cancel_pending"
    assert next(iter(scheduling.holds.values()))["state"] == "confirmed"
    scheduling.unavailable_on_release = False
    retry = http.post(f"/api/v1/appointments/{appointment_id}/cancel", headers=patient)
    assert retry.status_code == 200
    assert retry.json()["status"] == "cancelled"
    assert next(iter(scheduling.holds.values()))["state"] == "released"
    assert len(repository.notifications) == 2


def test_checked_in_appointment_cannot_be_cancelled_even_if_refunded(client):
    http, repository, scheduling = client
    patient = {"Authorization": "Bearer patient-a"}
    appointment_id = http.post("/api/v1/appointments", json=booking_body(),
                               headers=patient).json()["id"]
    repository.checked_in_ids.add(appointment_id)
    scheduling.billing.status = "refunded"
    result = http.post(f"/api/v1/appointments/{appointment_id}/cancel", headers=patient)
    assert result.status_code == 409
    assert repository.rows[appointment_id]["status"] == "confirmed"
    assert next(iter(scheduling.holds.values()))["state"] == "confirmed"


def test_notifications_are_private_and_read_state_persists(client):
    http, repository, _scheduling = client
    base = "/api/v1/appointments"
    patient_a = {"Authorization": "Bearer patient-a"}
    patient_b = {"Authorization": "Bearer patient-b"}
    assert http.get(f"{base}/notifications/me").status_code == 401
    assert http.get(f"{base}/notifications/me", headers={"Authorization": "Bearer admin"}).status_code == 403
    created = http.post(base, json=booking_body(), headers=patient_a).json()
    notices = http.get(f"{base}/notifications/me", headers=patient_a).json()
    assert len(notices) == 1 and notices[0]["read"] is False
    assert notices[0]["appointment_id"] == created["id"]
    assert http.get(f"{base}/notifications/me", headers=patient_b).json() == []
    assert http.post(f"{base}/notifications/mark-read", headers=patient_b).json() == {"updated_count": 0}
    assert http.post(f"{base}/notifications/mark-read", headers=patient_a).json() == {"updated_count": 1}
    assert http.get(f"{base}/notifications/me", headers=patient_a).json()[0]["read"] is True
    assert http.post(f"{base}/notifications/mark-read", headers=patient_a).json() == {"updated_count": 0}
    http.post(f"{base}/{created['id']}/cancel", headers=patient_a)
    assert len(repository.notifications) == 2
    assert sum(notice["read"] is False for notice in http.get(
        f"{base}/notifications/me", headers=patient_a
    ).json()) == 1


def test_retry_uncertain_confirmation_and_rejected_hold(client):
    http, repository, scheduling = client
    base = "/api/v1/appointments"
    patient = {"Authorization": "Bearer patient-a"}
    scheduling.unavailable_on_confirm = True
    assert http.post(base, json=booking_body(), headers=patient).status_code == 503
    assert len(repository.rows) == 1
    assert next(iter(repository.rows.values()))["status"] == "pending"
    scheduling.unavailable_on_confirm = False
    assert http.post(base, json=booking_body(), headers=patient).json()["status"] == "confirmed"
    assert len(repository.rows) == 1
    scheduling.reject_on_confirm = True
    second = {**booking_body(), "idempotency_key": "request-002"}
    assert http.post(base, json=second, headers=patient).status_code == 409
    assert len([row for row in repository.rows.values() if row["status"] == "failed"]) == 1
