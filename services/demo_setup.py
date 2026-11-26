"""Generate Medicare shifts via HTTP for the retained 33 doctors and two branches.

The isolated test fixture helper is guarded and cannot recreate the removed demo
catalogue in the shared stack. CLI setup never creates staff, branches or services.
"""

import argparse
import asyncio
import json
import os
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import httpx


PASSWORD = "123456"  # User-requested public credential for the local coursework demo.
SPECIALTY = "Nội tổng quát"
SERVICES = ("identity", "registry", "scheduling", "appointment", "billing", "clinical", "laboratory")
BASES = {
    "identity": "/api/v1/identity", "registry": "/api/v1/registry",
    "scheduling": "/api/v1/scheduling", "appointment": "/api/v1/appointments",
    "billing": "/api/v1/billing", "clinical": "/api/v1/clinical",
    "laboratory": "/api/v1/laboratory",
}


def vietnam_today():
    return datetime.now(timezone(timedelta(hours=7))).date()


class DemoAPI:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30)
        self.sessions = []

    async def close(self):
        for refresh in self.sessions:
            try:
                await self.call("identity", "POST", "/logout", body={"refresh_token": refresh}, expected=204)
            except (RuntimeError, httpx.HTTPError):
                pass
        await self.client.aclose()

    async def request(self, service, method, path, *, token=None, body=None, params=None):
        base = os.getenv(f"DEMO_{service.upper()}_URL", f"http://{service}:8000").rstrip("/")
        # URL overrides allow an explicit localhost setup without Docker DNS.
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        return await self.client.request(method, base + BASES[service] + path,
                                         headers=headers, json=body, params=params)

    async def call(self, service, method, path, *, expected=200, **kwargs):
        response = await self.request(service, method, path, **kwargs)
        accepted = (expected,) if isinstance(expected, int) else expected
        if response.status_code not in accepted:
            detail = response.json().get("detail", "unexpected response") if response.headers.get("content-type", "").startswith("application/json") else "non-JSON response"
            raise RuntimeError(f"{service} {method} {path}: HTTP {response.status_code}; {str(detail)[:300]}")
        return response.json() if response.content else None

    async def login(self, role, username, password=PASSWORD):
        issued = await self.call("identity", "POST", "/login", body={
            "role": role, "username": username, "password": password,
        })
        self.sessions.append(issued["refresh_token"])
        return issued["access_token"]

    async def ready(self):
        for service in SERVICES:
            base = os.getenv(f"DEMO_{service.upper()}_URL", f"http://{service}:8000").rstrip("/")
            response = await self.client.get(base + "/ready")
            if response.status_code != 200:
                raise RuntimeError(f"{service} is not ready: {response.status_code}")

    async def bootstrap(self):
        if os.getenv("DEMO_BOOTSTRAP_PASSWORD"):
            return await self.login("admin", os.getenv("DEMO_BOOTSTRAP_USERNAME", "admin"),
                                    os.environ["DEMO_BOOTSTRAP_PASSWORD"])
        # Repeated setup can use its own admin without touching the original account.
        response = await self.request("identity", "POST", "/login", body={
            "role": "admin", "username": "demo_admin", "password": PASSWORD,
        })
        if response.status_code == 200:
            issued = response.json()
            self.sessions.append(issued["refresh_token"])
            return issued["access_token"]
        if response.status_code != 401:
            raise RuntimeError(f"Demo administrator login failed: {response.status_code}")
        return await self.login("admin", os.getenv("IDENTITY_ADMIN_USERNAME", "admin"),
                                os.environ["IDENTITY_ADMIN_PASSWORD"])


async def ensure_account(api, admin, role, username, **details):
    existing = None
    offset = 0
    while True:
        page = await api.call("identity", "GET", "/accounts", token=admin,
                              params={"role": role, "limit": 100, "offset": offset})
        existing = next((row for row in page if row["username"] == username), None)
        if existing or len(page) < 100:
            break
        offset += 100
    if existing is None:
        if role == "patient":
            existing = await api.call("identity", "POST", "/register", expected=201,
                                      body={"username": username, "password": PASSWORD})
        else:
            existing = await api.call("identity", "POST", "/accounts", token=admin, expected=201,
                                      body={"role": role, "username": username, "password": PASSWORD, **details})
    if (not existing["is_active"] or existing["registration_pending"]
            or details.get("subject_id") and existing["subject_id"] != details["subject_id"]):
        raise RuntimeError(f"Conflicting demo account {username}; existing credentials were not changed")
    token = await api.login(role, username)
    if role in ("doctor", "letan", "xnv"):
        profile = await api.call("registry", "GET", "/staff/me", token=token)
        for field, expected in {"staff_code": details["subject_id"], "role": role,
                                "branch_code": details["branch_code"], "specialty": details.get("specialty")}.items():
            if profile.get(field) != expected:
                raise RuntimeError(f"Conflicting demo staff profile {username}: {field}")
    return existing, token


async def ensure_catalog(api, admin, path, key, value):
    items = await api.call("registry", "GET", "/catalog/" + path)
    existing = next((item for item in items if item[key] == value[key]), None)
    if existing is None:
        return await api.call("registry", "POST", "/catalog/" + path,
                              token=admin, body=value, expected=201)
    if any(existing.get(field) != expected for field, expected in value.items()):
        raise RuntimeError(f"Conflicting demo catalogue record {value[key]}; not overwritten")
    return existing


async def seed_fixture(api, bootstrap, *, prefix="DEMO", start=None, days=7, capacity=20,
                       patient_usernames=("990000000001", "990000000002")):
    if (os.getenv("DEMO_VERIFY_ISOLATED") != "1"
            or not os.getenv("IDENTITY_JWT_SECRET", "").startswith("e2e_only_")):
        raise RuntimeError("Synthetic staff/catalogue fixtures are allowed only in the isolated E2E stack")
    if not re.fullmatch(r"[A-Z][A-Z0-9]{3,8}", prefix):
        raise ValueError("Prefix must contain 4..9 uppercase letters/digits")
    if not 1 <= days <= 14:
        raise ValueError("Days must be 1..14")
    start = start or vietnam_today()
    branch = "CN_" + prefix
    doctor = prefix + "_BS_NOI"
    backup = prefix + "_BS_PHU"
    exam, lab, treatment = (prefix + suffix for suffix in ("_KHAM", "_XN", "_DT"))
    cfg, lab_cfg, treatment_cfg = ("CFG_" + code for code in (exam, lab, treatment))
    insurance = prefix[:8] + "80"
    disease, medicine = prefix + "_BENH", prefix + "_THUOC"

    await ensure_catalog(api, bootstrap, "branches", "MaChiNhanh", {
        "MaChiNhanh": branch, "TenChiNhanh": f"[{prefix}] Phòng khám minh họa",
        "DiaChi": "Địa chỉ giả lập phục vụ môn học", "TrangThai": "active",
    })
    for code, name, kind, price in (
        (exam, "Khám Nội tổng quát", "Khám lâm sàng", 150000),
        (lab, "Xét nghiệm minh họa", "Xét nghiệm", 80000),
        (treatment, "Buổi điều trị minh họa", "Điều trị", 100000),
    ):
        await ensure_catalog(api, bootstrap, "services", "MaDichVu", {
            "MaDichVu": code, "TenDichVu": f"[{prefix}] {name}", "ChuyenKhoa": SPECIALTY,
            "LoaiDichVu": kind, "GiaGoc": price, "TrangThai": "active",
        })
    configs = await api.call("registry", "GET", "/catalog/branch-services")
    for config, service in ((cfg, exam), (lab_cfg, lab), (treatment_cfg, treatment)):
        value = {"MaCauHinh": config, "MaChiNhanh": branch, "MaDichVu": service,
                 "SlotGioiHan": capacity, "TrangThai": "active"}
        existing = next((row for row in configs if row["MaCauHinh"] == config), None)
        if existing and any(existing.get(key) != expected for key, expected in value.items()):
            raise RuntimeError(f"Conflicting branch-service configuration {config}")
        if existing is None:
            await api.call("registry", "PUT", "/catalog/branch-services/" + config, token=bootstrap, body=value)

    categories = await api.call("registry", "GET", "/insurance/categories")
    category = next((row for row in categories if row["code"] == insurance), None)
    if category and category["coverage_bps"] != 8000:
        raise RuntimeError("Conflicting demo insurance category")
    if category is None:
        await api.call("registry", "POST", "/insurance/categories", token=bootstrap, expected=201,
                       body={"code": insurance, "name": f"[{prefix}] BHYT mô phỏng 80%", "coverage_bps": 8000})

    accounts, tokens = {}, {}
    specs = (
        ("admin", "admin", None, "Quản trị demo"),
        ("doctor", "doctor", doctor, "Bác sĩ Minh - Nội tổng quát"),
        ("backup", "doctor", backup, "Bác sĩ Lan - dự phòng"),
        ("reception", "letan", prefix + "_LT", "Lễ tân Hà"),
        ("lab", "xnv", prefix + "_XNV", "Xét nghiệm viên Nam"),
    )
    for key, role, subject, name in specs:
        username = f"{prefix.lower()}_{key}"
        details = {} if role == "admin" else {
            "subject_id": subject, "full_name": f"[{prefix}] {name}", "branch_code": branch,
            "specialty": SPECIALTY if role == "doctor" else None,
        }
        accounts[key], tokens[key] = await ensure_account(api, bootstrap, role, username, **details)

    for index, username in enumerate(patient_usernames):
        key = "patient" if index == 0 else "patient2"
        accounts[key], tokens[key] = await ensure_account(api, bootstrap, "patient", username)
        profile = await api.call("registry", "GET", "/patients/me", token=tokens[key])
        values = {"full_name": f"[{prefix}] Bệnh nhân {'An' if index == 0 else 'Bình'}",
                  "phone": "0000000000", "date_of_birth": "2000-01-01"}
        if index == 0:
            values.update(insurance_card_number=insurance + "0000000001", insurance_category_code=insurance)
        if any(profile.get(field) != value for field, value in values.items()):
            profile = await api.call("registry", "PATCH", "/patients/me", token=tokens[key], body=values)
        if index == 0 and not profile["insurance_verified"]:
            await api.call("registry", "PATCH", f"/patients/{profile['id']}/insurance-verification",
                           token=bootstrap, body={"verified": True})

    for path, body in (
        ("/catalog/diseases/" + disease, {"name": f"[{prefix}] Chẩn đoán giả lập, không dùng lâm sàng"}),
        ("/catalog/medicines/" + medicine, {"name": f"[{prefix}] Thuốc giả lập", "unit": "đơn vị demo"}),
    ):
        await api.call("clinical", "PUT", path, token=bootstrap, body=body)

    schedules = await api.call("scheduling", "GET", "/doctor-schedules", params={
        "from_date": start.isoformat(), "to_date": (start + timedelta(days=days - 1)).isoformat(),
    })
    desired, existing = [], {(row["MaBacSi"], row["NgayTruc"], row["CaTruc"]): row for row in schedules}
    for day in (start + timedelta(days=n) for n in range(days)):
        for code, shifts in ((doctor, (1, 2, 3, 4)), (backup, (1, 2))):
            for shift in shifts:
                key = (code, day.isoformat(), shift)
                if key in existing:
                    if existing[key]["MaChiNhanh"] != branch or existing[key]["TrangThai"] != "Đang hoạt động":
                        raise RuntimeError(f"Conflicting or cancelled demo shift: {key}")
                else:
                    desired.append({"MaBacSi": code, "MaChiNhanh": branch,
                                    "NgayTruc": day.isoformat(), "CaTruc": shift})
    if desired:
        await api.call("scheduling", "POST", "/doctor-schedules/bulk", token=bootstrap,
                       expected=201, body={"schedules": desired})
    return {
        "prefix": prefix, "start_date": start.isoformat(),
        "end_date": (start + timedelta(days=days - 1)).isoformat(),
        "branch": branch, "doctor": doctor, "backup_doctor": backup,
        "exam_service": exam, "lab_service": lab, "treatment_service": treatment,
        "exam_config": cfg, "treatment_config": treatment_cfg,
        "insurance_category": insurance, "disease": disease, "medicine": medicine,
        "capacity": capacity, "new_shifts": len(desired), "accounts": accounts, "tokens": tokens,
    }


def booking(fixture, day=None, shift=1, key=None, config=None):
    return {"config_code": config or fixture["exam_config"], "doctor_code": fixture["doctor"],
            "date": day or fixture["start_date"], "shift": shift,
            "idempotency_key": key or f"{fixture['prefix']}-booking-{datetime.now().timestamp()}"}


async def prepare_reference(api, fixture):
    """One completed example for patient2; patient An stays ready for live demo."""
    today = vietnam_today().isoformat()
    if not fixture["start_date"] <= today <= fixture["end_date"]:
        return {"note": "Reference visit skipped: today is outside the requested schedule range"}
    tokens = fixture["tokens"]
    patient, doctor = tokens["patient2"], tokens["doctor"]
    visit = await api.call("appointment", "POST", "", expected=201, token=patient,
                           body=booking(fixture, today, 2, f"{fixture['prefix']}-reference-{today}"))
    invoice = await api.call("billing", "POST", "/invoices", expected=201, token=patient,
                             body={"appointment_id": visit["id"]})
    await api.call("billing", "POST", f"/invoices/{invoice['id']}/simulate-payment", token=patient)
    previous = await api.call("clinical", "GET", "/encounters/doctor", token=doctor)
    completed = next((row for row in previous if row["appointment_id"] == visit["id"] and row["status"] == "completed"), None)
    if completed:
        return {"appointment_id": visit["id"], "invoice_id": invoice["id"], "encounter_id": completed["id"], "reused": True}
    queue = await api.request("appointment", "GET", f"/doctor/queue/{visit['id']}", token=doctor)
    if queue.status_code == 404:
        await api.call("appointment", "POST", f"/{visit['id']}/check-in", token=tokens["reception"])
        state = "waiting"
    elif queue.status_code == 200:
        state = queue.json()["queue_state"]
    else:
        raise RuntimeError("Could not inspect reference queue")
    if state in ("waiting", "conclusion"):
        await api.call("appointment", "POST", f"/{visit['id']}/queue-state", token=doctor, body={"state": "examining"})
    body = {"appointment_id": visit["id"], "disease_code": fixture["disease"],
            "symptoms": "Triệu chứng giả lập phục vụ trình diễn, không phải hồ sơ thật.",
            "advice": "Nội dung giả lập, không dùng làm chỉ định điều trị.",
            "lab_service_codes": [fixture["lab_service"]],
            "prescriptions": [{"medicine_code": fixture["medicine"], "quantity": 2, "dosage": "Chỉ là dữ liệu demo"}],
            "treatments": [{"service_code": fixture["treatment_service"], "sessions": 2}]}
    encounter = await api.call("clinical", "POST", "/encounters", token=doctor, body={**body, "is_draft": True})
    orders = await api.call("laboratory", "GET", "/orders/me", token=patient)
    order = next(row for row in orders if row["encounter_id"] == encounter["id"])
    if order["status"] == "pending":
        await api.call("laboratory", "POST", f"/orders/{order['id']}/accept", token=tokens["lab"])
    if order["status"] != "resulted":
        await api.call("laboratory", "POST", f"/orders/{order['id']}/result", token=tokens["lab"],
                       body={"result_text": "Kết quả minh họa đã hoàn tất; không dùng cho mục đích y tế."})
    await api.call("clinical", "POST", "/encounters", token=doctor, body=body)
    return {"appointment_id": visit["id"], "invoice_id": invoice["id"], "encounter_id": encounter["id"], "reused": False}


def public_manifest(fixture):
    return {key: value for key, value in fixture.items() if key != "tokens"}


MEDICARE_GROUPS = (
    ("BS015", "BS016", "BS024", "BS032"),
    ("BS009", "BS010", "BS021", "BS029"),
    ("BS007", "BS008", "BS020", "BS028", "BS033"),
    ("BS001", "BS002", "BS017", "BS025"),
    ("BS005", "BS006", "BS019", "BS027"),
    ("BS011", "BS012", "BS022", "BS030"),
    ("BS003", "BS004", "BS018", "BS026"),
    ("BS013", "BS014", "BS023", "BS031"),
)


def medicare_schedules(start, days):
    """Same rotation as gen_lich_truc_0406.py, with service-owned staff codes."""
    rows = []
    for day in range(days):
        for shift in range(1, 5):
            step = 4 * day + shift - 4
            for branch, offset in (("CN01", 0), ("CN02", 1)):
                for index, group in enumerate(MEDICARE_GROUPS):
                    rows.append({
                        "MaBacSi": "LEGACY_" + group[(step + index + offset) % len(group)],
                        "MaChiNhanh": branch, "NgayTruc": (start + timedelta(days=day)).isoformat(), "CaTruc": shift,
                    })
    return rows


async def setup_medicare(api, admin, start, days):
    branches = await api.call("registry", "GET", "/catalog/branches")
    doctors = await api.call("registry", "GET", "/catalog/doctors")
    services = await api.call("registry", "GET", "/catalog/services")
    expected_doctors = {"LEGACY_" + code for group in MEDICARE_GROUPS for code in group}
    if ({b["MaChiNhanh"] for b in branches} != {"CN01", "CN02"}
            or any(b["TrangThai"] != "active" for b in branches)
            or {d["MaBacSi"] for d in doctors} != expected_doctors
            or {s["MaDichVu"] for s in services} != {f"DV{i:03}" for i in range(1, 66)}
            or any(s["TrangThai"] != "active" for s in services)):
        raise RuntimeError("Expected the restructured Medicare catalogue: 33 active doctors, 2 branches, 65 services")
    end = start + timedelta(days=days - 1)
    existing = await api.call("scheduling", "GET", "/doctor-schedules",
                              params={"from_date": start.isoformat(), "to_date": end.isoformat()})
    index = {(r["MaBacSi"], r["NgayTruc"], r["CaTruc"]): r for r in existing if r["TrangThai"] != "Lịch sử"}
    expected = medicare_schedules(start, days)
    missing = []
    for row in expected:
        old = index.get((row["MaBacSi"], row["NgayTruc"], row["CaTruc"]))
        if old is None:
            missing.append(row)
        elif old["MaChiNhanh"] != row["MaChiNhanh"] or old["TrangThai"] != "Đang hoạt động":
            raise RuntimeError(f"Existing shift conflicts with rotation: {row['MaBacSi']} {row['NgayTruc']} ca {row['CaTruc']}")
    for offset in range(0, len(missing), 128):
        await api.call("scheduling", "POST", "/doctor-schedules/bulk", token=admin,
                       body={"schedules": missing[offset:offset + 128]}, expected=201)
    return {"start_date": start.isoformat(), "end_date": end.isoformat(), "new_shifts": len(missing),
            "expected_shifts": len(expected), "branches": ["CN01", "CN02"], "doctors": len(expected_doctors)}


async def run(args):
    if not args.apply:
        raise RuntimeError("Use --apply to generate Medicare schedules")
    api = DemoAPI()
    try:
        await api.ready()
        admin = await api.bootstrap()
        manifest = await setup_medicare(api, admin, args.start_date, args.days)
        if args.output:
            Path(args.output).write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps({"status": "ready", **manifest}, ensure_ascii=False))
    finally:
        await api.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--start-date", type=date.fromisoformat, default=date(2026, 11, 11))
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--output", help="Optional manifest file; never contains session tokens")
    args = parser.parse_args()
    if not 1 <= args.days <= 366:
        parser.error("Choose 1..366 days")
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
