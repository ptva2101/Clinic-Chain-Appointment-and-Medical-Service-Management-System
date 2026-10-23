from datetime import datetime
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from billing.api import get_clients, get_identity_client, get_repository
from billing.main import app
from billing.repository import InvoiceConflict


class MemoryIdentity:
    async def current_account(self, token):
        return {"id": token, "role": "admin" if token == "admin" else "patient",
                "subject_id": None if token == "admin" else f"patient-{token}", "is_active": True}


class MemoryClients:
    def __init__(self):
        self.status = "confirmed"
        self.price = 150000
        self.insurance_bps = 0

    async def appointment(self, token, appointment_id):
        return {"id": appointment_id, "patient_id": f"patient-{token}",
                "service_code": "DV_KHAM", "branch_code": "CN01",
                "doctor_code": "BS01", "status": self.status}

    async def service_price(self, service_code):
        assert service_code == "DV_KHAM"
        return self.price

    async def patient_insurance(self, patient_id):
        return {"patient_id": patient_id,
                "insurance_card_number": "DN12345" if self.insurance_bps else None,
                "insurance_category_code": "DN" if self.insurance_bps else None,
                "coverage_bps": self.insurance_bps,
                "insurance_verified": bool(self.insurance_bps)}


class MemoryInvoices:
    def __init__(self):
        self.rows = {}

    async def by_appointment(self, appointment_id):
        return next((row for row in self.rows.values()
                     if row["appointment_id"] == appointment_id), None)

    async def get(self, invoice_id):
        return self.rows.get(invoice_id)

    async def create(self, appointment, account, price, insurance):
        existing = await self.by_appointment(appointment["id"])
        if existing:
            return existing
        now = datetime.now()
        discount = price * (insurance.get("coverage_bps") or 0) // 10000
        row = {"id": str(uuid4()), "appointment_id": appointment["id"],
               "patient_account_id": account["id"], "patient_id": appointment["patient_id"],
               "service_code": appointment["service_code"], "list_price": price,
               "insurance_discount": discount, "amount_due": price - discount, "status": "pending",
               "payment_method": None, "payment_token": None, "paid_at": None,
               "created_at": now, "updated_at": now, "branch_code": "CN01",
               "doctor_code": "BS01", "coverage_bps": insurance.get("coverage_bps") or 0,
               "insurance_verified": insurance.get("insurance_verified", False),
               "refunded_at": None}
        self.rows[row["id"]] = row
        return row

    async def list_patient(self, account_id):
        return [row for row in self.rows.values() if row["patient_account_id"] == account_id]

    async def list_admin(self, limit, offset):
        rows = sorted(self.rows.values(), key=lambda row: (row["created_at"], row["id"]), reverse=True)
        return rows[offset:offset + limit], len(rows)

    async def simulate_payment(self, invoice_id, account_id):
        row = self.rows.get(invoice_id)
        if row is None or row["patient_account_id"] != account_id:
            return None
        if row["status"] == "pending":
            row.update(status="paid", payment_method="simulated", payment_token="SIM_TEST",
                       paid_at=datetime.now())
        elif row["status"] != "paid":
            raise InvoiceConflict("Invoice cannot be paid")
        return row

    async def simulate_refund(self, invoice_id):
        row = self.rows.get(invoice_id)
        if row is None:
            return None
        if row["status"] == "paid":
            row.update(status="refunded", refunded_at=datetime.now())
        elif row["status"] != "refunded":
            raise InvoiceConflict("Only paid invoices can be refunded")
        return row

    async def grouped_report(self, year, month, group_by):
        field = {"branch": "branch_code", "doctor": "doctor_code", "service": "service_code"}[group_by]
        return [{"code": "CN01" if group_by == "branch" else
                 "BS01" if group_by == "doctor" else "DV_KHAM",
                 "paid_count": 1, "revenue": 150000,
                 "insurance_discount": 0, "legacy_estimated_count": 0}]

    async def monthly_report(self, year, month):
        paid = [row for row in self.rows.values() if row["status"] == "paid"]
        return {"month": f"{year:04d}-{month:02d}", "paid_count": len(paid),
                "pending_count": len(self.rows) - len(paid),
                "revenue": sum(row["amount_due"] for row in paid),
                "insurance_discount": sum(row["insurance_discount"] for row in paid)}


@pytest.fixture
def billing_client(monkeypatch):
    repository = MemoryInvoices()
    clients = MemoryClients()
    app.dependency_overrides[get_repository] = lambda: repository
    app.dependency_overrides[get_clients] = lambda: clients
    app.dependency_overrides[get_identity_client] = lambda: MemoryIdentity()
    monkeypatch.setenv("BILLING_INTERNAL_TOKEN", "test-internal-token")
    try:
        with TestClient(app) as http:
            yield http, repository, clients
    finally:
        app.dependency_overrides.clear()


def test_invoice_simulated_payment_and_report(billing_client):
    http, repository, clients = billing_client
    headers = {"Authorization": "Bearer alice"}
    body = {"appointment_id": str(uuid4())}
    base = "/api/v1/billing"
    assert http.post(f"{base}/invoices", json=body).status_code == 401
    assert http.post(f"{base}/invoices", json=body,
                     headers={"Authorization": "Bearer admin"}).status_code == 403
    created = http.post(f"{base}/invoices", json=body, headers=headers)
    assert created.status_code == 201
    invoice = created.json()
    assert invoice["amount_due"] == 150000
    assert invoice["status"] == "pending"
    clients.price = 250000
    repeated = http.post(f"{base}/invoices", json=body, headers=headers)
    assert repeated.json()["id"] == invoice["id"]
    assert repeated.json()["amount_due"] == 150000
    assert http.get(f"{base}/invoices/me", headers=headers).json()[0]["id"] == invoice["id"]
    assert http.get(f"{base}/invoices", headers=headers).status_code == 403
    assert http.get(f"{base}/invoices").status_code == 401
    admin_headers = {"Authorization": "Bearer admin"}
    listing = http.get(f"{base}/invoices?limit=10&offset=0", headers=admin_headers)
    assert listing.status_code == 200
    assert listing.json()["total"] == 1
    assert listing.json()["items"][0]["id"] == invoice["id"]
    assert http.get(f"{base}/invoices?limit=0", headers=admin_headers).status_code == 422
    assert http.get(f"{base}/invoices/{invoice['id']}",
                    headers={"Authorization": "Bearer bob"}).status_code == 404
    assert http.post(f"{base}/invoices/{invoice['id']}/simulate-payment",
                     headers={"Authorization": "Bearer bob"}).status_code == 404
    paid = http.post(f"{base}/invoices/{invoice['id']}/simulate-payment", headers=headers)
    assert paid.status_code == 200
    assert paid.json()["payment_method"] == "simulated"
    assert http.post(f"{base}/invoices/{invoice['id']}/simulate-payment",
                     headers=headers).json()["payment_token"] == paid.json()["payment_token"]
    assert http.get(f"{base}/internal/appointments/{body['appointment_id']}/payment").status_code == 401
    internal = http.get(f"{base}/internal/appointments/{body['appointment_id']}/payment",
                        headers={"X-Service-Token": "test-internal-token"})
    assert internal.json()["status"] == "paid"
    report = http.get(f"{base}/reports/monthly?month=2026-10",
                      headers={"Authorization": "Bearer admin"})
    assert report.json()["revenue"] == 150000
    assert report.json()["insurance_discount"] == 0
    assert http.get(f"{base}/reports/branch?month=2026-10",
                    headers={"Authorization": "Bearer admin"}).json()[0]["code"] == "CN01"
    assert http.post(f"{base}/invoices/{invoice['id']}/simulate-refund",
                     headers=headers).status_code == 403
    refunded = http.post(f"{base}/invoices/{invoice['id']}/simulate-refund",
                         headers={"Authorization": "Bearer admin"})
    assert refunded.status_code == 200
    assert refunded.json()["status"] == "refunded"
    assert http.get(f"{base}/invoices", headers=admin_headers).json()["items"][0]["status"] == "refunded"
    assert http.post(f"{base}/invoices/{invoice['id']}/simulate-refund",
                     headers={"Authorization": "Bearer admin"}).json()["status"] == "refunded"
    assert http.get(f"{base}/reports/monthly?month=2026-13",
                    headers={"Authorization": "Bearer admin"}).status_code == 422
    assert len(repository.rows) == 1


def test_only_confirmed_appointments_can_be_invoiced(billing_client):
    http, _repository, clients = billing_client
    clients.status = "cancelled"
    result = http.post("/api/v1/billing/invoices", json={"appointment_id": str(uuid4())},
                       headers={"Authorization": "Bearer alice"})
    assert result.status_code == 409


def test_verified_insurance_price_is_snapshot(billing_client):
    http, _repository, clients = billing_client
    clients.insurance_bps = 8000
    headers = {"Authorization": "Bearer alice"}
    body = {"appointment_id": str(uuid4())}
    created = http.post("/api/v1/billing/invoices", json=body, headers=headers)
    assert created.status_code == 201
    assert created.json()["amount_due"] == 30000
    assert created.json()["insurance_discount"] == 120000
    clients.insurance_bps = 0
    clients.price = 200000
    repeated = http.post("/api/v1/billing/invoices", json=body, headers=headers)
    assert repeated.json()["amount_due"] == 30000
    paid = http.post(f"/api/v1/billing/invoices/{created.json()['id']}/simulate-payment",
                     headers=headers)
    assert paid.status_code == 200
    report = http.get("/api/v1/billing/reports/monthly?month=2026-10",
                      headers={"Authorization": "Bearer admin"})
    assert report.json()["insurance_discount"] == 120000
