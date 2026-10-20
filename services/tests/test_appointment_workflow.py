from datetime import datetime
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from appointment.api import get_identity_client
from appointment.main import app
from appointment.queue_repository import QueueConflict, QueueNotFound
from appointment.workflow_api import get_queue_repository, get_workflow_clients, today_vietnam
from appointment.workflow_clients import WorkflowRejected


class MemoryIdentity:
    async def current_account(self, token):
        role = "letan" if token == "reception" else "doctor" if token == "doctor" else "patient"
        return {"id": token, "role": role, "is_active": True,
                "subject_id": "LT001" if role == "letan" else "BS001" if role == "doctor" else "BN001"}


class MemoryClients:
    paid = False

    async def patient_profiles(self, patient_ids):
        return {patient_id: {"id": patient_id, "full_name": "Test Patient",
                             "cccd": "000000000001", "phone": "0912345678",
                             "date_of_birth": None} for patient_id in patient_ids}

    async def receptionist_profile(self, token):
        assert token == "reception"
        return {"role": "letan", "staff_code": "LT001", "branch_code": "CN_CG"}

    async def require_paid(self, appointment_id):
        if not self.paid:
            raise WorkflowRejected("Appointment has not been paid")


class MemoryQueue:
    def __init__(self):
        self.row = {"id": str(uuid4()), "patient_id": "BN001", "config_code": "CH001",
                    "branch_code": "CN_CG", "service_code": "DV_KHAM", "doctor_code": "BS001",
                    "duty_date": today_vietnam(), "shift": 1, "status": "confirmed",
                    "queue_number": None, "receptionist_code": None, "queue_state": None,
                    "checked_in_at": None}

    async def get(self, appointment_id):
        return self.row.copy() if appointment_id == self.row["id"] else None

    async def list(self, *, branch_code=None, doctor_code=None, duty_date=None,
                   checked_in=None, keyword=""):
        row = self.row
        if branch_code and row["branch_code"] != branch_code:
            return []
        if doctor_code and row["doctor_code"] != doctor_code:
            return []
        if duty_date and row["duty_date"] != duty_date:
            return []
        if checked_in is True and row["queue_number"] is None:
            return []
        if checked_in is False and row["queue_number"] is not None:
            return []
        if keyword and keyword not in (row["id"], row["patient_id"]):
            return []
        return [row.copy()]

    async def check_in(self, appointment_id, receptionist_code, branch_code, today):
        if appointment_id != self.row["id"]:
            raise QueueNotFound("Appointment not found")
        if self.row["queue_number"] is not None:
            raise QueueConflict("Already checked in")
        if today != self.row["duty_date"] or branch_code != self.row["branch_code"]:
            raise QueueConflict("Invalid check-in")
        self.row.update(queue_number=1, receptionist_code=receptionist_code,
                        queue_state="waiting", checked_in_at=datetime.now())
        return self.row.copy()

    async def move_state(self, appointment_id, doctor_code, expected, next_state):
        if appointment_id != self.row["id"] or doctor_code != self.row["doctor_code"]:
            raise QueueNotFound("Queue entry not found")
        if self.row["queue_state"] not in expected:
            raise QueueConflict("Invalid queue state transition")
        self.row["queue_state"] = next_state
        return self.row.copy()


@pytest.fixture
def workflow_client():
    queue = MemoryQueue()
    clients = MemoryClients()
    app.dependency_overrides[get_queue_repository] = lambda: queue
    app.dependency_overrides[get_workflow_clients] = lambda: clients
    app.dependency_overrides[get_identity_client] = lambda: MemoryIdentity()
    try:
        with TestClient(app) as http:
            yield http, queue, clients
    finally:
        app.dependency_overrides.clear()


def test_reception_checkin_requires_paid_invoice_and_doctor_controls_queue(workflow_client):
    http, queue, clients = workflow_client
    base = "/api/v1/appointments"
    reception = {"Authorization": "Bearer reception"}
    doctor = {"Authorization": "Bearer doctor"}
    assert http.get(f"{base}/reception/appointments").status_code == 401
    assert http.get(f"{base}/reception/appointments", headers=doctor).status_code == 403
    assert len(http.get(f"{base}/reception/appointments", headers=reception).json()) == 1
    assert http.post(f"{base}/{queue.row['id']}/check-in", headers=reception).status_code == 409
    clients.paid = True
    checked = http.post(f"{base}/{queue.row['id']}/check-in", headers=reception)
    assert checked.status_code == 200
    assert checked.json()["queue_number"] == 1
    assert checked.json()["receptionist_code"] == "LT001"
    assert http.post(f"{base}/{queue.row['id']}/check-in", headers=reception).status_code == 409
    assert http.get(f"{base}/reception/appointments", headers=reception).json() == []
    assert len(http.get(f"{base}/doctor/queue", headers=doctor).json()) == 1
    assert http.post(f"{base}/{queue.row['id']}/queue-state", json={"state": "completed"},
                     headers=doctor).status_code == 409
    for state in ("examining", "conclusion", "completed"):
        changed = http.post(f"{base}/{queue.row['id']}/queue-state", json={"state": state},
                            headers=doctor)
        assert changed.status_code == 200
        assert changed.json()["queue_state"] == state
    assert http.get(f"{base}/doctor/queue", headers=doctor).json() == []
    detail = f"{base}/doctor/queue/{queue.row['id']}"
    assert http.get(detail, headers=doctor).json()["queue_state"] == "completed"
    assert http.get(detail, headers={"Authorization": "Bearer patient"}).status_code == 403
    assert http.get(f"{base}/doctor/queue/{uuid4()}", headers=doctor).status_code == 404
