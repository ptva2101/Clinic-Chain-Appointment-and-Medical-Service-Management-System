"""Disposable-stack HTTP smoke test for all seven services.

Run only inside the isolated Compose project defined by compose.e2e.yaml.
All generated names, phone numbers, and CCCDs are synthetic.
"""

import asyncio
import json
import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import httpx


SERVICES = ("identity", "registry", "scheduling", "appointment", "billing", "clinical", "laboratory")
ADMIN_PASSWORD = "e2e_only_change_me_123"
TEST_PASSWORD = "e2e_password_123"


async def call(client, service, method, path, expected=200, *, token=None, body=None, params=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    response = await client.request(
        method, f"http://{service}:8000{path}", headers=headers,
        json=body, params=params,
    )
    accepted = (expected,) if isinstance(expected, int) else expected
    if response.status_code not in accepted:
        raise AssertionError(
            f"{service} {method} {path}: expected {accepted}, got {response.status_code}: "
            f"{response.text[:400]}"
        )
    return response.json() if response.content else None


def passed(label):
    print(f"PASS {label}", flush=True)


async def run():
    if os.getenv("E2E_ISOLATED_STACK") != "1":
        raise RuntimeError("Set E2E_ISOLATED_STACK=1 only in the disposable Compose project")
    suffix = uuid4().hex[:8].upper()
    today = datetime.now(timezone(timedelta(hours=7))).date()
    branch = f"CN_{suffix}"
    doctor_code = f"BS_{suffix}"
    receptionist_code = f"LT_{suffix}"
    technician_code = f"XN_{suffix}"
    exam_service = f"EX_{suffix}"
    lab_service = f"LAB_{suffix}"
    config = f"CFG_{suffix}"
    cccd = f"{uuid4().int % 10**12:012d}"
    identity_path = "/api/v1/identity"
    registry_path = "/api/v1/registry"
    catalog_path = f"{registry_path}/catalog"
    appointment_path = "/api/v1/appointments"
    billing_path = "/api/v1/billing"
    scheduling_path = "/api/v1/scheduling"
    clinical_path = "/api/v1/clinical"
    laboratory_path = "/api/v1/laboratory"

    async with httpx.AsyncClient(timeout=15.0) as client:
        for service in SERVICES:
            await call(client, service, "GET", "/ready")
            spec = await call(client, service, "GET", "/openapi.json")
            assert spec["paths"], f"{service} has empty OpenAPI"
        passed("7 services ready and publish OpenAPI")

        admin_login = await call(client, "identity", "POST", f"{identity_path}/login", body={
            "role": "admin", "username": "admin", "password": ADMIN_PASSWORD,
        })
        admin = admin_login["access_token"]
        assert (await call(client, "identity", "GET", f"{identity_path}/me", token=admin))["role"] == "admin"
        passed("Identity admin login")

        await call(client, "registry", "POST", f"{catalog_path}/branches", 201, token=admin, body={
            "MaChiNhanh": branch, "TenChiNhanh": "E2E Test Clinic", "DiaChi": "Test only",
        })
        for code, kind, price in ((exam_service, "Khám lâm sàng", 150000),
                                  (lab_service, "Xét nghiệm", 80000)):
            await call(client, "registry", "POST", f"{catalog_path}/services", 201,
                       token=admin, body={
                           "MaDichVu": code, "TenDichVu": f"E2E {kind}",
                           "ChuyenKhoa": "Nội tổng quát", "LoaiDichVu": kind, "GiaGoc": price,
                       })
        await call(client, "registry", "PUT", f"{catalog_path}/branch-services/{config}",
                   token=admin, body={
                       "MaCauHinh": config, "MaChiNhanh": branch,
                       "MaDichVu": exam_service, "SlotGioiHan": 3,
                   })
        passed("Registry branch, services, booking configuration")

        staff = (
            ("doctor", doctor_code, "E2E Doctor"),
            ("letan", receptionist_code, "E2E Receptionist"),
            ("xnv", technician_code, "E2E Technician"),
        )
        tokens = {}
        for role, code, name in staff:
            username = f"{role}_{suffix.lower()}"
            account = await call(client, "identity", "POST", f"{identity_path}/accounts", 201,
                                 token=admin, body={
                                     "role": role, "username": username, "password": TEST_PASSWORD,
                                     "subject_id": code, "full_name": name,
                                     "specialty": "Nội tổng quát" if role == "doctor" else None,
                                     "branch_code": branch,
                                 })
            assert account["subject_id"] == code and account["is_active"]
            login = await call(client, "identity", "POST", f"{identity_path}/login", body={
                "role": role, "username": username, "password": TEST_PASSWORD,
            })
            tokens[role] = login["access_token"]
            profile = await call(client, "registry", "GET", f"{registry_path}/staff/me",
                                 token=tokens[role])
            assert profile["staff_code"] == code
        passed("Identity staff provisioning and Registry linkage")

        account = await call(client, "identity", "POST", f"{identity_path}/register", 201,
                             body={"username": cccd, "password": TEST_PASSWORD})
        assert account["is_active"] and account["subject_id"]
        patient_login = await call(client, "identity", "POST", f"{identity_path}/login", body={
            "role": "patient", "username": cccd, "password": TEST_PASSWORD,
        })
        patient = patient_login["access_token"]
        profile = await call(client, "registry", "PATCH", f"{registry_path}/patients/me",
                             token=patient, body={
                                 "full_name": "E2E Synthetic Patient", "phone": "0900000000",
                                 "date_of_birth": "2000-01-01",
                             })
        assert profile["id"] == account["subject_id"]
        insurance_code = f"I{suffix}"
        await call(client, "registry", "POST", f"{registry_path}/insurance/categories", 201,
                   token=admin, body={"code": insurance_code, "name": "E2E policy",
                                      "coverage_bps": 8000})
        await call(client, "registry", "PATCH", f"{registry_path}/patients/me",
                   token=patient, body={"insurance_card_number": f"{insurance_code}12345",
                                        "insurance_category_code": insurance_code})
        verified = await call(client, "registry", "PATCH",
                              f"{registry_path}/patients/{profile['id']}/insurance-verification",
                              token=admin, body={"verified": True})
        assert verified["insurance_verified"]
        passed("Patient registration, login, and Registry profile")

        schedules = await call(client, "scheduling", "POST",
                               f"{scheduling_path}/doctor-schedules/bulk", 201, token=admin,
                               body={"schedules": [{
                                   "MaBacSi": doctor_code, "MaChiNhanh": branch,
                                   "NgayTruc": today.isoformat(), "CaTruc": 1,
                               }]})
        schedule_id = schedules[0]["id"]
        availability = await call(client, "scheduling", "GET", f"{scheduling_path}/availability",
                                  params={"config_code": config, "date": today.isoformat(),
                                          "shift": 1, "doctor_code": doctor_code})
        assert availability["available"] == 3
        passed("Scheduling shift and availability")

        booking = {"config_code": config, "doctor_code": doctor_code,
                   "date": today.isoformat(), "shift": 1, "idempotency_key": str(uuid4())}
        appointment = await call(client, "appointment", "POST", appointment_path, 201,
                                 token=patient, body=booking)
        assert appointment["status"] == "confirmed"
        appointment_id = appointment["id"]
        impact = await call(client, "scheduling", "GET",
                            f"{scheduling_path}/doctor-schedules/{schedule_id}/impact", token=admin)
        assert impact["confirmed_appointments"] == 1 and not impact["can_change"]
        passed("Appointment booking confirms Scheduling hold")

        unpaid = await call(client, "appointment", "POST", appointment_path, 201,
                            token=patient, body={**booking, "idempotency_key": str(uuid4())})
        cancelled = await call(client, "appointment", "POST",
                               f"{appointment_path}/{unpaid['id']}/cancel", token=patient)
        assert cancelled["status"] == "cancelled"
        passed("Unpaid cancellation releases slot")

        invoice = await call(client, "billing", "POST", f"{billing_path}/invoices", 201,
                             token=patient, body={"appointment_id": appointment_id})
        assert invoice["amount_due"] == 30000
        assert invoice["insurance_discount"] == 120000
        assert invoice["coverage_bps"] == 8000
        paid = await call(client, "billing", "POST",
                          f"{billing_path}/invoices/{invoice['id']}/simulate-payment", token=patient)
        assert paid["status"] == "paid"
        await call(client, "appointment", "POST", f"{appointment_path}/{appointment_id}/cancel",
                   409, token=patient)
        passed("Billing invoice, simulated payment, paid-cancel guard")

        refundable_appointment = await call(
            client, "appointment", "POST", appointment_path, 201,
            token=patient, body={**booking, "idempotency_key": str(uuid4())},
        )
        refundable_invoice = await call(
            client, "billing", "POST", f"{billing_path}/invoices", 201,
            token=patient, body={"appointment_id": refundable_appointment["id"]},
        )
        await call(client, "billing", "POST",
                   f"{billing_path}/invoices/{refundable_invoice['id']}/simulate-payment",
                   token=patient)
        admin_invoices = await call(client, "billing", "GET", f"{billing_path}/invoices",
                                    token=admin, params={"limit": 10, "offset": 0})
        assert admin_invoices["total"] >= 2
        assert any(item["id"] == refundable_invoice["id"] for item in admin_invoices["items"])
        await call(client, "billing", "GET", f"{billing_path}/invoices", 403, token=patient)
        refunded_before_visit = await call(
            client, "billing", "POST",
            f"{billing_path}/invoices/{refundable_invoice['id']}/simulate-refund", token=admin,
        )
        assert refunded_before_visit["status"] == "refunded"
        cancelled_after_refund = await call(
            client, "appointment", "POST",
            f"{appointment_path}/{refundable_appointment['id']}/cancel", token=patient,
        )
        assert cancelled_after_refund["status"] == "cancelled"
        passed("Admin invoice list, simulated refund, then patient cancellation")

        reception = await call(client, "appointment", "GET",
                               f"{appointment_path}/reception/appointments", token=tokens["letan"])
        assert any(item["id"] == appointment_id for item in reception)
        checked = await call(client, "appointment", "POST",
                             f"{appointment_path}/{appointment_id}/check-in", token=tokens["letan"])
        assert checked["queue_state"] == "waiting" and checked["queue_number"] > 0
        examining = await call(client, "appointment", "POST",
                               f"{appointment_path}/{appointment_id}/queue-state",
                               token=tokens["doctor"], body={"state": "examining"})
        assert examining["queue_state"] == "examining"
        passed("Reception check-in and doctor queue")

        encounter_body = {
            "appointment_id": appointment_id,
            "symptoms": "E2E test symptoms", "advice": "E2E test advice",
            "lab_service_codes": [lab_service],
            "prescriptions": [], "treatments": [],
        }
        encounter = await call(client, "clinical", "POST", f"{clinical_path}/encounters",
                               token=tokens["doctor"], body={**encounter_body, "is_draft": True})
        assert encounter["status"] == "draft"
        await call(client, "clinical", "POST", f"{clinical_path}/encounters", 409,
                   token=tokens["doctor"], body=encounter_body)
        passed("Clinical draft creates lab order and blocks premature conclusion")

        orders = await call(client, "laboratory", "GET", f"{laboratory_path}/orders/me",
                            token=patient)
        order = next(item for item in orders if item["encounter_id"] == encounter["id"])
        accepted = await call(client, "laboratory", "POST",
                              f"{laboratory_path}/orders/{order['id']}/accept", token=tokens["xnv"])
        assert accepted["status"] == "accepted"
        resulted = await call(client, "laboratory", "POST",
                              f"{laboratory_path}/orders/{order['id']}/result",
                              token=tokens["xnv"], body={"result_text": "E2E normal result"})
        assert resulted["status"] == "resulted"
        passed("Laboratory order, technician acceptance, result")

        completed = await call(client, "clinical", "POST", f"{clinical_path}/encounters",
                               token=tokens["doctor"], body=encounter_body)
        assert completed["status"] == "completed" and completed["id"] == encounter["id"]
        history = await call(client, "clinical", "GET", f"{clinical_path}/encounters/me",
                             token=patient)
        assert any(item["id"] == encounter["id"] for item in history)
        passed("Clinical conclusion after lab result and patient history")

        report = await call(client, "billing", "GET", f"{billing_path}/reports/monthly",
                            token=admin, params={"month": today.strftime("%Y-%m")})
        assert (report["paid_count"] >= 1 and report["revenue"] >= 30000
                and report["insurance_discount"] >= 120000)
        grouped = await call(client, "billing", "GET", f"{billing_path}/reports/branch",
                             token=admin, params={"month": today.strftime("%Y-%m")})
        assert any(item["code"] == branch and item["revenue"] >= 30000
                   and item["insurance_discount"] >= 120000 for item in grouped)
        queue = await call(client, "appointment", "GET",
                           f"{appointment_path}/doctor/queue/{appointment_id}", token=tokens["doctor"])
        assert queue["queue_state"] == "completed"
        passed("Billing report and completed doctor queue")

        refunded = await call(client, "billing", "POST",
                              f"{billing_path}/invoices/{invoice['id']}/simulate-refund",
                              token=admin)
        assert refunded["status"] == "refunded" and refunded["refunded_at"]
        repeated = await call(client, "billing", "POST",
                              f"{billing_path}/invoices/{invoice['id']}/simulate-refund",
                              token=admin)
        assert repeated["refunded_at"] == refunded["refunded_at"]
        passed("Admin simulated refund is idempotent")

        if os.getenv("E2E_EXPORT_LOAD_FIXTURE") == "1":
            print("LOAD_FIXTURE " + json.dumps({
                "patient_access_token": patient,
                "config_code": config,
                "doctor_code": doctor_code,
                "date": today.isoformat(),
                "shift": 1,
            }), flush=True)

    print("E2E PASS: all seven services completed the synthetic patient journey", flush=True)


if __name__ == "__main__":
    asyncio.run(run())
