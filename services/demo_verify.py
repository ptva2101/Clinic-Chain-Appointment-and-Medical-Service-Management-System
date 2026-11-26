"""Extended HTTP acceptance checks against synthetic, isolated Compose data.

Requires DEMO_VERIFY_ISOLATED=1 and the compose.e2e.yaml override. No shared
demo accounts are touched. JSON/Markdown evidence excludes passwords and tokens.
"""

import argparse
import asyncio
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from demo_setup import BASES, SERVICES, PASSWORD, DemoAPI, booking, seed_fixture, vietnam_today


def require(condition, message):
    if not condition:
        raise AssertionError(message)


class Checks:
    def __init__(self):
        self.results = []

    async def case(self, title, operation):
        try:
            evidence = await operation()
            self.results.append({"case": title, "status": "PASS", "evidence": evidence or {}})
            print("PASS " + title, flush=True)
            return True
        except Exception as exc:
            self.results.append({"case": title, "status": "FAIL", "evidence": {"error": str(exc)[:500]}})
            print(f"FAIL {title}: {exc}", flush=True)
            return False

    def skip(self, title, reason):
        self.results.append({"case": title, "status": "SKIP", "evidence": {"reason": reason}})


async def run(args):
    if os.getenv("DEMO_VERIFY_ISOLATED") != "1":
        raise RuntimeError("Run only on the isolated compose.e2e.yaml stack with DEMO_VERIFY_ISOLATED=1")
    if not os.getenv("IDENTITY_JWT_SECRET", "").startswith("e2e_only_"):
        raise RuntimeError("The isolated Identity configuration from compose.e2e.yaml is required")
    api, checks = DemoAPI(), Checks()
    fixture, state = None, {}
    try:
        await api.ready()
        bootstrap = await api.bootstrap()
        suffix = uuid4().hex[:8].upper()
        prefix = "T" + suffix
        # 99 prefix and random test suffix: synthetic identifiers, no shared patient rows.
        base_cccd = 990000000000 + int(suffix, 16) % 9000000000
        fixture = await seed_fixture(api, bootstrap, prefix=prefix, start=vietnam_today(), days=2,
                                     capacity=3, patient_usernames=(str(base_cccd), str(base_cccd + 1)))
        tokens = fixture["tokens"]
        admin, patient, doctor = tokens["admin"], tokens["patient"], tokens["doctor"]
        today = fixture["start_date"]
        tomorrow = (vietnam_today() + timedelta(days=1)).isoformat()

        async def openapi():
            paths = {}
            for service in SERVICES:
                response = await api.client.get(f"http://{service}:8000/openapi.json")
                require(response.status_code == 200, f"{service} OpenAPI failed")
                paths[service] = len(response.json()["paths"])
                require(paths[service] > 0, f"{service} has no API paths")
            return paths
        await checks.case("7 service công bố OpenAPI và readiness", openapi)

        async def passwords():
            username = fixture["accounts"]["patient2"]["username"]
            old_token = tokens["patient2"]
            temporary = PASSWORD + "Changed"
            try:
                await api.call("identity", "POST", "/change-password", token=old_token, expected=204,
                               body={"old_password": PASSWORD, "new_password": temporary})
                await api.call("identity", "GET", "/me", token=old_token, expected=401)
                await api.call("identity", "POST", "/login", expected=401,
                               body={"role": "patient", "username": username, "password": PASSWORD})
                await api.login("patient", username, temporary)
            finally:
                # Dedicated test account only; recover known demo password even if an assertion fails.
                recovery = await api.login("patient", username, temporary)
                await api.call("identity", "POST", "/change-password", token=recovery, expected=204,
                               body={"old_password": temporary, "new_password": PASSWORD})
                tokens["patient2"] = await api.login("patient", username)
            return {"old_token": 401, "old_password": 401, "new_password": 200, "restored": True}
        await checks.case("Đổi mật khẩu, thu hồi token và khôi phục tài khoản test", passwords)

        async def permissions():
            await api.call("identity", "GET", "/accounts", expected=401)
            await api.call("identity", "GET", "/accounts", token=patient, expected=403)
            await api.call("billing", "GET", "/invoices", token=patient, expected=403)
            await api.call("appointment", "GET", "/doctor/queue", token=patient, expected=403)
            await api.call("scheduling", "POST", "/doctor-schedules/bulk", token=patient, expected=403,
                           body={"schedules": [{"MaBacSi": fixture["doctor"], "MaChiNhanh": fixture["branch"],
                                                "NgayTruc": tomorrow, "CaTruc": 1}]})
            return {"unauthenticated": 401, "unauthorized_roles": [403, 403, 403, 403]}
        await checks.case("Phân quyền và xác thực API", permissions)

        async def unpaid_cancel():
            params = {"config_code": fixture["exam_config"], "doctor_code": fixture["doctor"],
                      "date": today, "shift": 1}
            before = await api.call("scheduling", "GET", "/availability", params=params)
            visit = await api.call("appointment", "POST", "", token=patient, expected=201, body=booking(fixture))
            during = await api.call("scheduling", "GET", "/availability", params=params)
            cancelled = await api.call("appointment", "POST", f"/{visit['id']}/cancel", token=patient)
            after = await api.call("scheduling", "GET", "/availability", params=params)
            require(cancelled["status"] == "cancelled", "Appointment was not cancelled")
            require(during["available"] == before["available"] - 1 and after["available"] == before["available"], "Slot inventory mismatch")
            return {"available_before": before["available"], "during": during["available"], "after": after["available"]}
        await checks.case("Hủy lịch chưa thanh toán trả lại chỗ", unpaid_cancel)

        async def insurance_snapshot():
            profile_id = fixture["accounts"]["patient"]["subject_id"]
            await api.call("registry", "PATCH", f"/patients/{profile_id}/insurance-verification", token=admin, body={"verified": False})
            uninsured = await api.call("appointment", "POST", "", token=patient, expected=201, body=booking(fixture))
            first = await api.call("billing", "POST", "/invoices", token=patient, expected=201,
                                   body={"appointment_id": uninsured["id"]})
            require(first["amount_due"] == 150000 and first["insurance_discount"] == 0, "Unverified insurance unexpectedly discounted")
            await api.call("registry", "PATCH", f"/patients/{profile_id}/insurance-verification", token=admin, body={"verified": True})
            frozen = await api.call("billing", "POST", "/invoices", token=patient, expected=201,
                                    body={"appointment_id": uninsured["id"]})
            require(frozen["id"] == first["id"] and frozen["amount_due"] == 150000, "Existing invoice changed after insurance verification")
            await api.call("appointment", "POST", f"/{uninsured['id']}/cancel", token=patient)
            request = booking(fixture)
            state["visit"] = await api.call("appointment", "POST", "", token=patient, expected=201, body=request)
            repeated = await api.call("appointment", "POST", "", token=patient, expected=201, body=request)
            require(repeated["id"] == state["visit"]["id"], "Repeated idempotency key duplicated the appointment")
            invoice = await api.call("billing", "POST", "/invoices", token=patient, expected=201,
                                     body={"appointment_id": state["visit"]["id"]})
            state["invoice"] = invoice
            require((invoice["list_price"], invoice["insurance_discount"], invoice["amount_due"]) == (150000, 120000, 30000), "Incorrect 80% insurance discount")
            try:
                await api.call("registry", "PATCH", f"/catalog/services/{fixture['exam_service']}/price", token=admin, body={"GiaGoc": 160000})
                frozen = await api.call("billing", "GET", f"/invoices/{invoice['id']}", token=patient)
                require(frozen["list_price"] == 150000 and frozen["amount_due"] == 30000, "Price snapshot changed")
            finally:
                await api.call("registry", "PATCH", f"/catalog/services/{fixture['exam_service']}/price", token=admin, body={"GiaGoc": 150000})
            return {"unverified_amount": first["amount_due"], "verified_amount": invoice["amount_due"],
                    "discount": invoice["insurance_discount"], "snapshot_immutable": True, "booking_idempotent": True}
        core = await checks.case("BHYT chưa/đã xác minh, chụp giá và chống đặt trùng", insurance_snapshot)

        async def ownership():
            await api.call("appointment", "GET", f"/{state['visit']['id']}", token=tokens["patient2"], expected=404)
            await api.call("billing", "GET", f"/invoices/{state['invoice']['id']}", token=tokens["patient2"], expected=404)
            await api.call("billing", "POST", f"/invoices/{state['invoice']['id']}/simulate-payment", token=tokens["patient2"], expected=404)
            return {"other_patient_appointment": 404, "other_patient_invoice": 404, "other_patient_payment": 404}
        if core:
            await checks.case("Bệnh nhân không đọc hoặc thanh toán hóa đơn người khác", ownership)
        else:
            checks.skip("Bệnh nhân không đọc hoặc thanh toán hóa đơn người khác", "Core booking failed")

        async def payment():
            path = f"/invoices/{state['invoice']['id']}/simulate-payment"
            paid = await api.call("billing", "POST", path, token=patient)
            repeated = await api.call("billing", "POST", path, token=patient)
            require(paid["status"] == "paid" and paid["payment_token"] == repeated["payment_token"] and paid["paid_at"] == repeated["paid_at"], "Payment is not idempotent")
            await api.call("appointment", "POST", f"/{state['visit']['id']}/cancel", token=patient, expected=409)
            return {"payment_status": paid["status"], "repeat_same_transaction": True, "paid_cancellation": 409}
        paid_ok = await checks.case("Thanh toán giả lập lặp lại và chặn hủy lịch đã trả tiền", payment) if core else False
        if not core:
            checks.skip("Thanh toán giả lập lặp lại và chặn hủy lịch đã trả tiền", "Core booking failed")

        async def refund():
            visit = await api.call("appointment", "POST", "", token=patient, expected=201, body=booking(fixture))
            invoice = await api.call("billing", "POST", "/invoices", token=patient, expected=201, body={"appointment_id": visit["id"]})
            await api.call("billing", "POST", f"/invoices/{invoice['id']}/simulate-payment", token=patient)
            path = f"/invoices/{invoice['id']}/simulate-refund"
            await api.call("billing", "POST", path, token=patient, expected=403)
            first = await api.call("billing", "POST", path, token=admin)
            second = await api.call("billing", "POST", path, token=admin)
            require(first["status"] == "refunded" and first["refunded_at"] == second["refunded_at"], "Refund is not idempotent")
            cancelled = await api.call("appointment", "POST", f"/{visit['id']}/cancel", token=patient)
            require(cancelled["status"] == "cancelled", "Refund did not permit cancellation")
            await api.call("billing", "POST", f"/invoices/{invoice['id']}/simulate-payment", token=patient, expected=409)
            return {"patient_refund": 403, "admin_refund": "refunded", "repeat_same_refund": True, "after_refund": "cancelled"}
        await checks.case("Admin hoàn tiền, không hoàn trùng và hủy sau hoàn tiền", refund)

        async def capacity():
            visits = []
            try:
                for _ in range(2):
                    visits.append(await api.call("appointment", "POST", "", token=patient, expected=201, body=booking(fixture, shift=3)))
                responses = await asyncio.gather(*[
                    api.request("appointment", "POST", "", token=patient, body=booking(fixture, shift=3)) for _ in range(2)
                ])
                statuses = sorted(response.status_code for response in responses)
                visits.extend(response.json() for response in responses if response.status_code == 201)
                require(statuses == [201, 409], f"Last-slot race returned {statuses}")
                await api.call("appointment", "POST", "", token=patient, expected=409, body=booking(fixture, shift=3))
            finally:
                for visit in visits:
                    await api.call("appointment", "POST", f"/{visit['id']}/cancel", token=patient)
            availability = await api.call("scheduling", "GET", "/availability", params={
                "config_code": fixture["exam_config"], "doctor_code": fixture["doctor"], "date": today, "shift": 3})
            require(availability["available"] == 3, "Capacity was not restored")
            return {"last_slot_competitors": 2, "responses": statuses, "full_slot": 409, "restored_available": 3}
        await checks.case("Ca hết chỗ và 2 yêu cầu đồng thời tranh chỗ cuối", capacity)

        async def shift_changes():
            schedules = await api.call("scheduling", "GET", "/doctor-schedules", params={"ma_bac_si": fixture["doctor"], "from_date": today, "to_date": tomorrow})
            empty = next(row for row in schedules if row["NgayTruc"] == tomorrow and row["CaTruc"] == 3)
            impact = await api.call("scheduling", "GET", f"/doctor-schedules/{empty['id']}/impact", token=admin)
            require(impact["can_change"], "Expected an empty shift")
            moved = await api.call("scheduling", "POST", f"/doctor-schedules/{empty['id']}/transfer", token=admin,
                                   body={"new_doctor_code": fixture["backup_doctor"]})
            require(moved["MaBacSi"] == fixture["backup_doctor"], "Transfer did not change doctor")
            cancelled = await api.call("scheduling", "POST", f"/doctor-schedules/{empty['id']}/cancel", token=admin)
            require(cancelled["TrangThai"] == "Đã hủy", "Empty shift not cancelled")
            if core:
                occupied = next(row for row in schedules if row["NgayTruc"] == today and row["CaTruc"] == 1)
                await api.call("scheduling", "POST", f"/doctor-schedules/{occupied['id']}/cancel", token=admin, expected=409)
                await api.call("scheduling", "POST", f"/doctor-schedules/{occupied['id']}/transfer", token=admin, expected=409,
                               body={"new_doctor_code": fixture["backup_doctor"]})
            return {"empty_transfer": 200, "empty_cancel": "Đã hủy", "occupied_change": 409 if core else "not checked"}
        await checks.case("Chuyển/hủy ca trống và chặn thay đổi ca đã có lịch", shift_changes)

        async def consultation():
            visit_id = state["visit"]["id"]
            checked = await api.call("appointment", "POST", f"/{visit_id}/check-in", token=tokens["reception"])
            require(checked["queue_number"] > 0 and checked["queue_state"] == "waiting", "Missing queue entry")
            await api.call("appointment", "POST", f"/{visit_id}/check-in", token=tokens["reception"], expected=409)
            await api.call("appointment", "POST", f"/{visit_id}/queue-state", token=doctor, body={"state": "examining"})
            body = {"appointment_id": visit_id, "disease_code": fixture["disease"], "symptoms": "Triệu chứng giả lập",
                    "advice": "Chỉ minh họa nghiệp vụ, không phải chỉ định y tế",
                    "lab_service_codes": [fixture["lab_service"]],
                    "prescriptions": [{"medicine_code": fixture["medicine"], "quantity": 2, "dosage": "Dữ liệu demo"}],
                    "treatments": [{"service_code": fixture["treatment_service"], "sessions": 2}]}
            encounter = await api.call("clinical", "POST", "/encounters", token=doctor, body={**body, "is_draft": True})
            await api.call("clinical", "POST", "/encounters", token=doctor, body=body, expected=409)
            orders = await api.call("laboratory", "GET", "/orders/me", token=patient)
            order = next(row for row in orders if row["encounter_id"] == encounter["id"])
            await api.call("laboratory", "POST", f"/orders/{order['id']}/accept", token=tokens["lab"])
            resulted = await api.call("laboratory", "POST", f"/orders/{order['id']}/result", token=tokens["lab"],
                                      body={"result_text": "Kết quả giả lập phục vụ kiểm thử"})
            require(resulted["status"] == "resulted", "Laboratory result missing")
            completed = await api.call("clinical", "POST", "/encounters", token=doctor, body=body)
            repeated = await api.call("clinical", "POST", "/encounters", token=doctor, body=body)
            require(completed["status"] == "completed" and repeated["id"] == completed["id"], "Encounter did not complete idempotently")
            await api.call("clinical", "POST", "/encounters", token=doctor, body={**body, "symptoms": "Sửa sau hoàn tất"}, expected=409)
            history = await api.call("clinical", "GET", "/encounters/me", token=patient)
            require(any(row["id"] == completed["id"] for row in history), "Completed encounter absent from patient history")
            await api.call("clinical", "GET", f"/encounters/{completed['id']}", token=tokens["patient2"], expected=404)
            state["encounter"] = completed
            return {"duplicate_check_in": 409, "premature_conclusion": 409, "lab_result": "resulted", "encounter": "completed", "immutable": 409}
        visit_ok = await checks.case("Tiếp đón → khám → xét nghiệm → kết luận, đơn thuốc và bệnh sử", consultation) if paid_ok else False
        if not paid_ok:
            checks.skip("Tiếp đón → khám → xét nghiệm → kết luận, đơn thuốc và bệnh sử", "Payment prerequisite failed")

        async def treatment_sessions():
            plans = await api.call("clinical", "GET", "/treatments/me", token=patient)
            plan = next(row for row in plans if row["encounter_id"] == state["encounter"]["id"])
            first_body = {**booking(fixture, shift=4, config=fixture["treatment_config"]), "session_number": 1}
            session = await api.call("clinical", "POST", f"/treatments/{plan['id']}/sessions", token=patient, body=first_body)
            same = await api.call("clinical", "POST", f"/treatments/{plan['id']}/sessions", token=patient, body=first_body)
            require(session["id"] == same["id"] and session["status"] == "booked", "Treatment booking duplicated")
            invoice = await api.call("billing", "GET", f"/invoices/{session['invoice_id']}", token=patient)
            require(invoice["amount_due"] == 20000, "Treatment invoice has incorrect insurance snapshot")
            await api.call("billing", "POST", f"/invoices/{invoice['id']}/simulate-payment", token=patient)
            appointment_id = session["appointment_id"]
            await api.call("appointment", "POST", f"/{appointment_id}/check-in", token=tokens["reception"])
            await api.call("appointment", "POST", f"/{appointment_id}/queue-state", token=doctor, body={"state": "examining"})
            done = await api.call("clinical", "POST", f"/treatments/sessions/{appointment_id}/complete", token=doctor)
            require(done["status"] == "completed", "Treatment completion failed")
            second = await api.call("clinical", "POST", f"/treatments/{plan['id']}/sessions", token=patient,
                                    body={**booking(fixture, day=tomorrow, config=fixture["treatment_config"]), "session_number": 2})
            require(second["status"] == "booked", "Future treatment session booking failed")
            await api.call("clinical", "POST", f"/treatments/{plan['id']}/sessions", token=patient, expected=409,
                           body={**booking(fixture, day=tomorrow, config=fixture["treatment_config"]), "session_number": 3})
            return {"first_session": "completed", "second_session": "booked", "amount_due": 20000, "beyond_plan": 409, "idempotent": True}
        treatment_ok = await checks.case("Đặt buổi điều trị, tạo hóa đơn, hoàn tất buổi và chống đặt vượt phác đồ", treatment_sessions) if visit_ok else False
        if not visit_ok:
            checks.skip("Đặt buổi điều trị, tạo hóa đơn, hoàn tất buổi và chống đặt vượt phác đồ", "Consultation prerequisite failed")

        async def reports():
            month = today[:7]
            evidence = {}
            expected_revenue = 50000 if treatment_ok else 30000
            expected_discount = 200000 if treatment_ok else 120000
            for group, code in (("branch", fixture["branch"]), ("doctor", fixture["doctor"]), ("service", fixture["exam_service"])):
                rows = await api.call("billing", "GET", "/reports/" + group, token=admin, params={"month": month})
                item = next(row for row in rows if row["code"] == code)
                require(item["revenue"] == (30000 if group == "service" else expected_revenue), f"Incorrect {group} revenue: {item['revenue']}")
                require(item["insurance_discount"] == (120000 if group == "service" else expected_discount), f"Incorrect {group} insurance discount")
                evidence[group] = {"code": code, "revenue": item["revenue"], "insurance_discount": item["insurance_discount"]}
            if treatment_ok:
                rows = await api.call("billing", "GET", "/reports/service", token=admin, params={"month": month})
                item = next(row for row in rows if row["code"] == fixture["treatment_service"])
                require(item["revenue"] == 20000, "Treatment service revenue missing")
            monthly = await api.call("billing", "GET", "/reports/monthly", token=admin, params={"month": month})
            require(monthly["refunded_count"] >= 1 and monthly["refunded_amount"] >= 30000, "Refund not recorded in monthly report")
            return evidence
        if paid_ok:
            await checks.case("Báo cáo chi nhánh/bác sĩ/dịch vụ, giảm trừ BHYT và loại tiền đã hoàn", reports)
        else:
            checks.skip("Báo cáo chi nhánh/bác sĩ/dịch vụ, giảm trừ BHYT và loại tiền đã hoàn", "Payment prerequisite failed")

        async def notifications():
            before = await api.call("appointment", "GET", "/notifications/me", token=patient)
            require(before, "No booking notifications")
            await api.call("appointment", "POST", "/notifications/mark-read", token=patient)
            after = await api.call("appointment", "GET", "/notifications/me", token=patient)
            require(all(row["read"] for row in after), "Notifications still unread")
            return {"notifications": len(after), "all_read": True}
        await checks.case("Thông báo đặt lịch và đánh dấu đã đọc", notifications)

    finally:
        await api.close()
        report = {"executed_at": datetime.now(timezone(timedelta(hours=7))).isoformat(),
                  "environment": "isolated Compose project; synthetic fixtures; service APIs only",
                  "prefix": fixture["prefix"] if fixture else None, "results": checks.results,
                  "summary": {status: sum(row["status"] == status for row in checks.results) for status in ("PASS", "FAIL", "SKIP")}}
        if args.output:
            Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps(report["summary"], ensure_ascii=False), flush=True)
    return 1 if not checks.results or any(row["status"] != "PASS" for row in checks.results) else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", help="JSON report path inside the container")
    args = parser.parse_args()
    raise SystemExit(asyncio.run(run(args)))


if __name__ == "__main__":
    main()
