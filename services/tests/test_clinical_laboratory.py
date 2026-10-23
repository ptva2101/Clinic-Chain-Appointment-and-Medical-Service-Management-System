from datetime import date, datetime
from uuid import uuid4

import pytest
from fastapi import Depends, HTTPException
from fastapi.testclient import TestClient

from clinical.api import get_clients as clinical_clients, get_identity_client as clinical_identity
from clinical.api import get_repository as clinical_repository
from clinical.api import session_response
from clinical.clients import ClinicalRejected, ClinicalUnavailable
from clinical.repository import EncounterConflict
from clinical.main import app as clinical_app
from laboratory.api import account as lab_account, get_identity_client as lab_identity
from laboratory.api import get_repository as lab_repository
from laboratory.api import technician_branch
from laboratory.main import app as lab_app


def test_legacy_undated_treatment_session_is_serialized_without_fabricated_date():
    now = datetime.now()
    row = {
        "id": str(uuid4()), "plan_id": str(uuid4()), "session_number": 2,
        "config_code": None, "doctor_code": "LEGACY_BS001", "duty_date": None,
        "shift": None, "appointment_id": None, "invoice_id": None,
        "status": "historical_unbooked", "source": "legacy_mysql",
        "created_at": now, "updated_at": now,
    }
    response = session_response(row)
    assert response.date is None and response.shift is None
    assert response.status == "historical_unbooked"
    assert response.source == "legacy_mysql"


class Identity:
    async def current_account(self, token):
        role = {"doctor": "doctor", "patient": "patient", "technician": "xnv"}.get(token, "admin")
        return {"id": token, "role": role,
                "subject_id": {"doctor": "BS1", "patient": "BN1", "technician": "XN1"}.get(token),
                "is_active": True}


class Encounters:
    def __init__(self):
        self.row = None
        self.plans = {}
        self.sessions = {}
        self.catalog_changes = {}

    async def validate_catalog(self, disease_code, medicine_codes):
        return disease_code in (None, "J00") and all(code == "TH1" for code in medicine_codes)

    async def list_diseases(self):
        return [{"code": "J00", "name": "Cảm lạnh"}]

    async def list_medicines(self):
        return [{"code": "TH1", "name": "Thuốc thử", "unit": "viên"}]

    async def upsert_disease(self, code, name, active):
        row = {"code": code, "name": name, "active": active}
        self.catalog_changes[("disease", code)] = row
        return row

    async def upsert_medicine(self, code, name, unit, active):
        row = {"code": code, "name": name, "unit": unit, "active": active}
        self.catalog_changes[("medicine", code)] = row
        return row

    async def upsert(self, appointment, doctor_code, body):
        now = datetime.now()
        self.row = {"id": self.row["id"] if self.row else str(uuid4()),
                    "appointment_id": appointment["id"], "patient_id": appointment["patient_id"],
                    "doctor_code": doctor_code, "branch_code": appointment["branch_code"],
                    "visit_date": date.fromisoformat(appointment["date"]), "created_at": now,
                    "updated_at": now, **body}
        if body["status"] == "completed":
            for treatment in body["treatments"]:
                plan = {"id": str(uuid4()), "encounter_id": self.row["id"], "patient_id": "BN1",
                        "doctor_code": doctor_code, "service_code": treatment["service_code"],
                        "total_sessions": treatment["sessions"], "scheduled_sessions": 0,
                        "completed_sessions": 0, "created_at": now}
                self.plans[plan["id"]] = plan
        return self.row

    async def get(self, encounter_id):
        return self.row if self.row and self.row["id"] == encounter_id else None

    async def by_appointment(self, appointment_id):
        return self.row if self.row and self.row["appointment_id"] == appointment_id else None

    async def list(self, **filters):
        if not self.row:
            return []
        for key, value in filters.items():
            if key == "completed_only":
                if value and self.row["status"] != "completed":
                    return []
            elif value is not None and self.row[key] != value:
                return []
        return [self.row]

    async def list_plans(self, patient_id):
        return [row for row in self.plans.values() if row["patient_id"] == patient_id]

    async def get_plan(self, plan_id):
        return self.plans.get(plan_id)

    async def list_sessions(self, plan_id):
        return [row for row in self.sessions.values() if row["plan_id"] == plan_id]

    async def reserve_session(self, plan, request):
        existing = next((row for row in self.sessions.values()
                         if row["plan_id"] == plan["id"] and row["session_number"] == request["session_number"]), None)
        if existing:
            if existing["patient_request_key"] != request["idempotency_key"] or any(
                existing[column] != request[key] for column, key in (
                    ("config_code", "config_code"), ("doctor_code", "doctor_code"),
                    ("duty_date", "date"), ("shift", "shift"),
                )
            ):
                raise EncounterConflict("Treatment session has already been booked")
            return existing
        now = datetime.now()
        row = {"id": str(uuid4()), "plan_id": plan["id"], "session_number": request["session_number"],
               "patient_request_key": request["idempotency_key"],
               "config_code": request["config_code"], "doctor_code": request["doctor_code"],
               "duty_date": request["date"], "shift": request["shift"],
               "appointment_id": None, "invoice_id": None, "status": "pending",
               "created_at": now, "updated_at": now}
        self.sessions[row["id"]] = row
        return row

    async def release_rejected_session(self, session_id, request_key):
        row = self.sessions[session_id]
        if row["status"] == "pending" and row["appointment_id"] is None:
            del self.sessions[session_id]

    async def get_session(self, session_id):
        return self.sessions.get(session_id)

    async def attach_session(self, session_id, appointment_id, invoice_id):
        row = self.sessions[session_id]
        row.update(appointment_id=appointment_id, invoice_id=invoice_id, status="booked")
        return row

    async def session_by_appointment(self, appointment_id):
        return next((row for row in self.sessions.values() if row["appointment_id"] == appointment_id), None)

    async def complete_session(self, appointment_id, doctor_code):
        row = await self.session_by_appointment(appointment_id)
        row["status"] = "completed"
        return row


class Clients:
    def __init__(self):
        self.state = "examining"
        self.synced = []
        self.booking_failure = None
        self.fail_move_once = False

    async def queued_appointment(self, token, appointment_id):
        return {"id": appointment_id, "doctor_code": "BS1", "patient_id": "BN1",
                "branch_code": "CN1", "date": "2026-10-19", "queue_state": self.state}

    async def laboratory_prices(self, service_codes):
        return [{"service_code": code, "list_price": 100000} for code in service_codes]

    async def ensure_lab_orders(self, encounter, services):
        self.synced.append((encounter["id"], services))
        return [{"status": "resulted"} for _ in services]

    async def move_queue(self, token, appointment_id, state):
        if self.fail_move_once:
            self.fail_move_once = False
            raise ClinicalUnavailable("Queue update uncertain")
        self.state = state

    async def verify_treatment_config(self, config_code, service_code):
        assert config_code == "CH1" and service_code == "DT1"

    async def book_treatment_appointment(self, token, plan, request):
        if self.booking_failure:
            raise self.booking_failure
        return {"id": "appointment-treatment-1", "service_code": plan["service_code"],
                "patient_id": plan["patient_id"], "status": "confirmed"}

    async def treatment_invoice(self, token, appointment_id):
        return {"id": "invoice-treatment-1", "appointment_id": appointment_id}


@pytest.fixture
def clinical_http():
    repo, clients = Encounters(), Clients()
    clinical_app.dependency_overrides[clinical_repository] = lambda: repo
    clinical_app.dependency_overrides[clinical_clients] = lambda: clients
    clinical_app.dependency_overrides[clinical_identity] = lambda: Identity()
    try:
        with TestClient(clinical_app) as http:
            yield http, repo, clients
    finally:
        clinical_app.dependency_overrides.clear()


def test_doctor_exam_and_patient_history_are_scoped(clinical_http):
    http, repo, clients = clinical_http
    path = "/api/v1/clinical/encounters"
    payload = {"appointment_id": str(uuid4()), "symptoms": "Sốt", "advice": "Nghỉ ngơi",
               "lab_service_codes": ["XN1"], "prescriptions": [], "treatments": []}
    assert http.post(path, json=payload).status_code == 401
    assert http.post(path, json=payload, headers={"Authorization": "Bearer patient"}).status_code == 403
    saved = http.post(path, json=payload, headers={"Authorization": "Bearer doctor"})
    assert saved.status_code == 200, saved.text
    assert saved.json()["status"] == "completed"
    retried = http.post(path, json=payload, headers={"Authorization": "Bearer doctor"})
    assert retried.status_code == 200, retried.text
    assert retried.json()["id"] == saved.json()["id"]
    assert clients.synced[0][1] == [{"service_code": "XN1", "list_price": 100000}]
    assert len(http.get(f"{path}/me", headers={"Authorization": "Bearer patient"}).json()) == 1
    assert http.get(f"{path}/{repo.row['id']}", headers={"Authorization": "Bearer technician"}).status_code == 404
    assert http.post(path, json={**payload, "lab_service_codes": ["XN1", "XN1"]},
                     headers={"Authorization": "Bearer doctor"}).status_code == 422
    clients.state = "waiting"
    assert http.post(path, json=payload, headers={"Authorization": "Bearer doctor"}).status_code == 409


def test_completed_encounter_reconciles_after_queue_update_failure(clinical_http):
    http, repo, clients = clinical_http
    payload = {"appointment_id": str(uuid4()), "symptoms": "Fever",
               "lab_service_codes": [], "prescriptions": [], "treatments": []}
    clients.fail_move_once = True
    first = http.post("/api/v1/clinical/encounters", json=payload,
                      headers={"Authorization": "Bearer doctor"})
    assert first.status_code == 503
    assert repo.row["status"] == "completed"
    assert clients.state == "examining"
    second = http.post("/api/v1/clinical/encounters", json=payload,
                       headers={"Authorization": "Bearer doctor"})
    assert second.status_code == 200, second.text
    assert second.json()["id"] == repo.row["id"]
    assert clients.state == "completed"


def test_treatment_session_booking_and_completion(clinical_http):
    http, repo, clients = clinical_http
    encounter = http.post("/api/v1/clinical/encounters", json={
        "appointment_id": str(uuid4()), "symptoms": "Đau", "lab_service_codes": [],
        "prescriptions": [], "treatments": [{"service_code": "DT1", "sessions": 2}],
    }, headers={"Authorization": "Bearer doctor"})
    assert encounter.status_code == 200, encounter.text
    plan = http.get("/api/v1/clinical/treatments/me",
                    headers={"Authorization": "Bearer patient"}).json()[0]
    request = {"config_code": "CH1", "doctor_code": "BS1", "date": "2026-10-20",
               "shift": 1, "idempotency_key": "treatment-one", "session_number": 1}
    path = f"/api/v1/clinical/treatments/{plan['id']}/sessions"
    assert http.post(path, json=request, headers={"Authorization": "Bearer doctor"}).status_code == 403
    first = http.post(path, json=request, headers={"Authorization": "Bearer patient"})
    assert first.status_code == 200, first.text
    assert first.json()["status"] == "booked"
    assert http.post(path, json=request, headers={"Authorization": "Bearer patient"}).json()["id"] == first.json()["id"]
    assert len(repo.sessions) == 1
    clients.state = "examining"
    complete = http.post("/api/v1/clinical/treatments/sessions/appointment-treatment-1/complete",
                         headers={"Authorization": "Bearer doctor"})
    assert complete.status_code == 200, complete.text
    assert complete.json()["status"] == "completed"


def test_rejected_treatment_slot_can_be_rebooked_but_uncertain_result_keeps_key(clinical_http):
    http, repo, clients = clinical_http
    encounter = http.post("/api/v1/clinical/encounters", json={
        "appointment_id": str(uuid4()), "symptoms": "Pain", "lab_service_codes": [],
        "prescriptions": [], "treatments": [{"service_code": "DT1", "sessions": 1}],
    }, headers={"Authorization": "Bearer doctor"})
    assert encounter.status_code == 200
    plan = next(iter(repo.plans.values()))
    path = f"/api/v1/clinical/treatments/{plan['id']}/sessions"
    first = {"config_code": "CH1", "doctor_code": "BS1", "date": "2026-10-20",
             "shift": 1, "idempotency_key": "first-slot-key", "session_number": 1}
    clients.booking_failure = ClinicalRejected("Slot unavailable")
    assert http.post(path, json=first, headers={"Authorization": "Bearer patient"}).status_code == 409
    assert repo.sessions == {}
    clients.booking_failure = ClinicalUnavailable("Booking uncertain")
    assert http.post(path, json=first, headers={"Authorization": "Bearer patient"}).status_code == 503
    assert len(repo.sessions) == 1
    changed = {**first, "shift": 2, "idempotency_key": "second-slot-key"}
    assert http.post(path, json=changed, headers={"Authorization": "Bearer patient"}).status_code == 409
    clients.booking_failure = None
    assert http.post(path, json=first, headers={"Authorization": "Bearer patient"}).status_code == 200


def test_admin_can_upsert_clinical_catalog(clinical_http):
    http, repo, _clients = clinical_http
    disease_path = "/api/v1/clinical/catalog/diseases/J01"
    medicine_path = "/api/v1/clinical/catalog/medicines/TH2"
    assert http.put(disease_path, json={"name": "New disease"}).status_code == 401
    assert http.put(disease_path, json={"name": "New disease"},
                    headers={"Authorization": "Bearer doctor"}).status_code == 403
    assert http.put(disease_path, json={"name": "New disease"},
                    headers={"Authorization": "Bearer admin"}).status_code == 200
    result = http.put(medicine_path, json={"name": "New medicine", "unit": "tablet"},
                      headers={"Authorization": "Bearer admin"})
    assert result.status_code == 200
    assert result.json()["unit"] == "tablet"
    assert http.put(disease_path, json={"name": "New disease", "active": False},
                    headers={"Authorization": "Bearer admin"}).status_code == 200
    assert repo.catalog_changes[("disease", "J01")]["active"] is False
    assert http.put(medicine_path, json={"name": "   ", "unit": "tablet"},
                    headers={"Authorization": "Bearer admin"}).status_code == 422


class Orders:
    def __init__(self):
        self.rows = {}

    async def ensure_orders(self, details, services):
        now = datetime.now()
        for service in services:
            row = {"id": str(uuid4()), **details, **service, "status": "pending",
                   "payment_method": None, "payment_token": None, "technician_code": None,
                   "result_text": None, "notes": None, "created_at": now, "updated_at": now}
            self.rows[row["id"]] = row
        return list(self.rows.values())

    async def list(self, **filters):
        return [row for row in self.rows.values() if all(value is None or row[key] == value
                                                          for key, value in filters.items())]

    async def get(self, order_id):
        return self.rows.get(order_id)

    async def accept(self, order_id, branch, technician):
        row = self.rows.get(order_id)
        if row and row["branch_code"] == branch:
            row.update(status="accepted", technician_code=technician,
                       payment_method="simulated", payment_token="SIM_LAB_TEST")
            return row
        return None

    async def result(self, order_id, branch, technician, result, notes):
        row = self.rows.get(order_id)
        if row and row["branch_code"] == branch and row["technician_code"] == technician:
            row.update(status="resulted", result_text=result, notes=notes)
            return row
        return None


@pytest.fixture
def laboratory_http(monkeypatch):
    repo = Orders()
    async def branch(current=Depends(lab_account)):
        if current["role"] != "xnv":
            raise HTTPException(status_code=403)
        return "CN1"
    lab_app.dependency_overrides[lab_repository] = lambda: repo
    lab_app.dependency_overrides[lab_identity] = lambda: Identity()
    lab_app.dependency_overrides[technician_branch] = branch
    monkeypatch.setenv("LABORATORY_INTERNAL_TOKEN", "secret")
    try:
        with TestClient(lab_app) as http:
            yield http, repo
    finally:
        lab_app.dependency_overrides.clear()


def test_internal_lab_order_and_technician_workflow(laboratory_http):
    http, _repo = laboratory_http
    base = "/api/v1/laboratory"
    payload = {"encounter_id": str(uuid4()), "appointment_id": str(uuid4()),
               "patient_id": "BN1", "branch_code": "CN1", "doctor_code": "BS1",
               "services": [{"service_code": "XN1", "list_price": 100000}]}
    assert http.post(f"{base}/internal/orders", json=payload).status_code == 401
    created = http.post(f"{base}/internal/orders", json=payload,
                        headers={"X-Service-Token": "secret"})
    assert created.status_code == 201, created.text
    order_id = created.json()[0]["id"]
    assert http.get(f"{base}/orders/me", headers={"Authorization": "Bearer patient"}).json()[0]["id"] == order_id
    assert http.get(f"{base}/orders", headers={"Authorization": "Bearer patient"}).status_code == 403
    accepted = http.post(f"{base}/orders/{order_id}/accept",
                         headers={"Authorization": "Bearer technician"})
    assert accepted.json()["payment_method"] == "simulated"
    result = http.post(f"{base}/orders/{order_id}/result", json={"result_text": "Bình thường"},
                       headers={"Authorization": "Bearer technician"})
    assert result.status_code == 200
    assert result.json()["status"] == "resulted"
