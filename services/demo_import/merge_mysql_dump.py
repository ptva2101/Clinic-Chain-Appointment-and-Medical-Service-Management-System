"""Merge safe legacy entities into the seven normal service tables.

The original dump remains available in service-owned historical_records. This
offline migration never reuses plaintext passwords, never replaces a live row,
and marks unavailable legacy accounts/catalogue entries inactive.
"""

import argparse
import hashlib
import json
import secrets
import sys
from collections import Counter, defaultdict
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

import pymysql

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from demo_import.import_history import connection_settings
from demo_import.import_mysql_dump import DEFAULT_DUMP, EXPECTED_SHA256, parse_dump
from identity.security import hash_password


PREFIX = "LEGACY_"


def stable_id(kind: str, legacy_id: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"clinic/mysql-dump-20261022/{kind}/{legacy_id}"))


def staff_code(code: str) -> str:
    return PREFIX + code


def missing_patient_codes(rows: dict) -> list[str]:
    known = {row["MaBenhAn"] for row in rows["benh_nhan"]}
    return sorted({row["MaBenhAn"] for row in rows["lich_hen"]} - known)


def connect(service: str):
    settings = connection_settings(service)
    settings["database"] = settings.pop("db")
    return pymysql.connect(**settings, cursorclass=pymysql.cursors.DictCursor)


def insert_once(cursor, sql: str, params: tuple, counts: Counter, name: str) -> None:
    cursor.execute(sql, params)
    counts[name] += cursor.rowcount


def merge_identity(rows: dict) -> Counter:
    connection = connect("identity")
    counts = Counter()
    groups = (("bac_si", "doctor", "MaBacSi"), ("le_tan", "letan", "MaLeTan"),
              ("xet_nghiem_vien", "xnv", "MaXNV"), ("benh_nhan", "patient", "MaBenhAn"))
    try:
        with connection.cursor() as cursor:
            for table, role, key in groups:
                for row in rows[table]:
                    legacy = row[key]
                    account_id = stable_id("account", f"{role}:{legacy}")
                    username = row["CCCD"] if role == "patient" else staff_code(legacy)
                    subject = stable_id("patient", legacy) if role == "patient" else staff_code(legacy)
                    cursor.execute(
                        "SELECT id, role, username, subject_id FROM accounts "
                        "WHERE id = %s OR (role = %s AND username = %s)",
                        (account_id, role, username),
                    )
                    existing = cursor.fetchall()
                    if existing:
                        if (len(existing) != 1 or existing[0]["id"] != account_id
                                or existing[0]["role"] != role
                                or existing[0]["username"] != username
                                or existing[0]["subject_id"] != subject):
                            raise ValueError(f"Identity collision for {role}:{legacy}")
                        continue
                    cursor.execute(
                        "INSERT INTO accounts (id, role, username, subject_id, password_hash, "
                        "is_active, registration_pending) VALUES (%s, %s, %s, %s, %s, FALSE, FALSE)",
                        (account_id, role, username, subject,
                         hash_password(secrets.token_urlsafe(32))),
                    )
                    counts["accounts"] += cursor.rowcount
            for legacy in missing_patient_codes(rows):
                account_id = stable_id("account", f"patient:{legacy}")
                insert_once(cursor,
                    "INSERT INTO accounts (id, role, username, subject_id, password_hash, "
                    "is_active, registration_pending) VALUES (%s, 'patient', %s, %s, %s, FALSE, FALSE) "
                    "ON DUPLICATE KEY UPDATE id = id",
                    (account_id, staff_code(legacy), stable_id("patient", legacy),
                     hash_password(secrets.token_urlsafe(32))), counts, "orphan_patient_accounts")
        connection.commit()
        return counts
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def merge_registry(rows: dict) -> Counter:
    connection = connect("registry")
    counts = Counter()
    try:
        with connection.cursor() as cursor:
            for row in rows["danh_muc_bhyt"]:
                insert_once(cursor,
                    "INSERT INTO insurance_categories (code, name, coverage_bps) "
                    "VALUES (%s, %s, %s) ON DUPLICATE KEY UPDATE code = code",
                    (row["KyTuDauBHYT"], row["DoiTuongChinhSach"], round(row["TyLeHuong"] * 10000)),
                    counts, "insurance_categories")
            for row in rows["chi_nhanh"]:
                insert_once(cursor,
                    "INSERT INTO branches (code, name, address, phone, active) "
                    "VALUES (%s, %s, %s, %s, FALSE) ON DUPLICATE KEY UPDATE code = code",
                    (row["MaChiNhanh"], row["TenChiNhanh"], row["DiaChi"], row["SDT"]),
                    counts, "branches")
            for row in rows["dich_vu"]:
                insert_once(cursor,
                    "INSERT INTO medical_services (code, name, specialty, kind, price, active) "
                    "VALUES (%s, %s, %s, %s, %s, FALSE) ON DUPLICATE KEY UPDATE code = code",
                    (row["MaDichVu"], row["TenDichVu"], row["ChuyenKhoa"],
                     row["LoaiDichVu"], row["GiaGoc"]), counts, "medical_services")
            for row in rows["chi_nhanh_dich_vu"]:
                insert_once(cursor,
                    "INSERT INTO branch_services (code, branch_code, service_code, slot_limit, active) "
                    "VALUES (%s, %s, %s, %s, FALSE) ON DUPLICATE KEY UPDATE code = code",
                    (row["MaCauHinh"], row["MaChiNhanh"], row["MaDichVu"],
                     row["SlotGioiHan"]), counts, "branch_services")
            for table, role, key in (("bac_si", "doctor", "MaBacSi"),
                                     ("le_tan", "letan", "MaLeTan"),
                                     ("xet_nghiem_vien", "xnv", "MaXNV")):
                for row in rows[table]:
                    code = staff_code(row[key])
                    cursor.execute("SELECT source, identity_account_id FROM staff_profiles "
                                   "WHERE staff_code = %s", (code,))
                    existing = cursor.fetchone()
                    account_id = stable_id("account", f"{role}:{row[key]}")
                    if existing:
                        if existing["source"] != "legacy_mysql" or existing["identity_account_id"] != account_id:
                            raise ValueError(f"Registry staff collision for {code}")
                        continue
                    cursor.execute(
                        "INSERT INTO staff_profiles (staff_code, identity_account_id, role, full_name, "
                        "phone, specialty, branch_code, source) VALUES (%s, %s, %s, %s, %s, %s, %s, 'legacy_mysql')",
                        (code, account_id, role, row["HoTen"], row["SDT"],
                         row.get("ChuyenKhoa") or ("Tiếp nhận" if role == "letan" else "Xét nghiệm"),
                         row.get("MaChiNhanh")),
                    )
                    counts["staff_profiles"] += cursor.rowcount
            for row in rows["benh_nhan"]:
                patient_id = stable_id("patient", row["MaBenhAn"])
                account_id = stable_id("account", f'patient:{row["MaBenhAn"]}')
                cursor.execute("SELECT id, identity_account_id FROM patients "
                               "WHERE id = %s OR cccd = %s", (patient_id, row["CCCD"]))
                existing = cursor.fetchall()
                if existing:
                    if (len(existing) != 1 or existing[0]["id"] != patient_id
                            or existing[0]["identity_account_id"] != account_id):
                        raise ValueError(f'Registry patient collision for {row["MaBenhAn"]}')
                    cursor.execute(
                        "UPDATE patients SET source = 'legacy_mysql' "
                        "WHERE id = %s AND source = 'identity'", (patient_id,))
                    counts["patient_sources_updated"] += cursor.rowcount
                    continue
                cursor.execute(
                    "INSERT INTO patients (id, identity_account_id, cccd, full_name, date_of_birth, "
                    "phone, insurance_card_number, insurance_category_code, source) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'legacy_mysql')",
                    (patient_id, account_id, row["CCCD"], row["HoTen"], row["NgaySinh"],
                     row["SDT"], row["MaSoBHYT"], row["KyTuDauBHYT"]),
                )
                counts["patients"] += cursor.rowcount
            for legacy in missing_patient_codes(rows):
                patient_id = stable_id("patient", legacy)
                account_id = stable_id("account", f"patient:{legacy}")
                insert_once(cursor,
                    "INSERT INTO patients (id, identity_account_id, cccd, source) "
                    "VALUES (%s, %s, NULL, 'legacy_orphan') "
                    "ON DUPLICATE KEY UPDATE id = id",
                    (patient_id, account_id), counts, "orphan_patient_profiles")
        connection.commit()
        return counts
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def merge_scheduling(rows: dict) -> Counter:
    connection = connect("scheduling")
    counts = Counter()
    try:
        with connection.cursor() as cursor:
            for row in sorted(rows["lich_truc"], key=lambda item: item["id"]):
                code = staff_code(row["MaBacSi"])
                key = (code, row["MaChiNhanh"], row["NgayTruc"], row["CaTruc"])
                legacy_id = str(row["id"])
                cursor.execute(
                    "SELECT doctor_code, branch_code, duty_date, shift FROM doctor_schedules "
                    "WHERE legacy_source_id = %s", (legacy_id,),
                )
                existing = cursor.fetchone()
                if existing:
                    actual = (existing["doctor_code"], existing["branch_code"],
                              str(existing["duty_date"]), existing["shift"])
                    if actual != key:
                        raise ValueError(f"Legacy shift identifier {legacy_id} maps to another shift")
                    continue
                cursor.execute(
                    "SELECT id FROM doctor_schedules WHERE doctor_code = %s AND branch_code = %s "
                    "AND duty_date = %s AND shift = %s AND status = 'historical' "
                    "AND source = 'legacy_mysql' AND legacy_source_id IS NULL "
                    "ORDER BY id LIMIT 1 FOR UPDATE", key,
                )
                prior = cursor.fetchone()
                if prior:
                    cursor.execute("UPDATE doctor_schedules SET legacy_source_id = %s WHERE id = %s",
                                   (legacy_id, prior["id"]))
                    counts["existing_shifts_linked"] += cursor.rowcount
                    continue
                insert_once(cursor,
                    "INSERT INTO doctor_schedules "
                    "(doctor_code, branch_code, duty_date, shift, status, source, legacy_source_id) "
                    "VALUES (%s, %s, %s, %s, 'historical', 'legacy_mysql', %s)",
                    (*key, legacy_id),
                    counts, "doctor_schedules")
        connection.commit()
        return counts
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def merge_appointment(rows: dict) -> Counter:
    connection = connect("appointment")
    counts = Counter()
    configs = {row["MaCauHinh"]: row for row in rows["chi_nhanh_dich_vu"]}
    appointments = {row["MaLichHen"]: row for row in rows["lich_hen"]}
    try:
        with connection.cursor() as cursor:
            for row in rows["lich_hen"]:
                config = configs[row["MaCauHinh"]]
                patient_id = stable_id("patient", row["MaBenhAn"])
                account_id = stable_id("account", f'patient:{row["MaBenhAn"]}')
                doctor = staff_code(row["MaBacSi"])
                insert_once(cursor,
                    "INSERT INTO appointments (id, patient_account_id, patient_id, config_code, "
                    "branch_code, service_code, doctor_code, duty_date, shift, status, source, legacy_status) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'historical', 'legacy_mysql', %s) "
                    "ON DUPLICATE KEY UPDATE id = id",
                    (row["MaLichHen"], account_id, patient_id, row["MaCauHinh"],
                     config["MaChiNhanh"], config["MaDichVu"], doctor,
                     row["NgayKham"], row["CaKham"], row["TrangThai"]),
                    counts, "appointments_new")
                cursor.execute(
                    "UPDATE appointments SET patient_account_id = %s, patient_id = %s, "
                    "doctor_code = %s WHERE id = %s AND source = 'legacy_mysql' "
                    "AND status = 'historical' AND (patient_account_id IS NULL OR "
                    "patient_id <> %s OR doctor_code <> %s)",
                    (account_id, patient_id, doctor, row["MaLichHen"], patient_id, doctor),
                )
                counts["appointments_linked"] += cursor.rowcount
            for row in rows["lich_su_thong_bao"]:
                appointment = appointments[row["MaLichHen"]]
                insert_once(cursor,
                    "INSERT INTO patient_notifications "
                    "(id, appointment_id, patient_account_id, patient_id, event, content, is_read, created_at) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) "
                    "ON DUPLICATE KEY UPDATE id = id",
                    (stable_id("notification", row["MaThongBao"]), row["MaLichHen"],
                     stable_id("account", f'patient:{row["MaBenhAn"]}'),
                     stable_id("patient", row["MaBenhAn"]),
                     f'legacy_mysql:{row["MaThongBao"]}', row["NoiDung"],
                     bool(row["DaDoc"]), row["ThoiGianGui"]),
                    counts, "patient_notifications")
            queue_numbers = defaultdict(int)
            with_number = sorted(
                (row for row in rows["lich_hen"] if row["STT"] is not None
                 and row["TrangThai"] != "Đã hủy"),
                key=lambda row: (row["NgayKham"], row["MaBacSi"], row["STT"], row["MaLichHen"]),
            )
            for row in with_number:
                config = configs[row["MaCauHinh"]]
                branch = config["MaChiNhanh"]
                doctor = staff_code(row["MaBacSi"])
                date = row["NgayKham"]
                queue_key = (branch, doctor, date)
                queue_numbers[queue_key] += 1
                state = {"Đang khám": "examining", "Chờ kết luận": "conclusion",
                         "Hoàn thành": "completed"}.get(row["TrangThai"], "waiting")
                insert_once(cursor,
                    "INSERT INTO appointment_checkins "
                    "(appointment_id, branch_code, doctor_code, duty_date, queue_number, "
                    "receptionist_code, state) VALUES (%s, %s, %s, %s, %s, %s, %s) "
                    "ON DUPLICATE KEY UPDATE appointment_id = appointment_id",
                    (row["MaLichHen"], branch, doctor, date, queue_numbers[queue_key],
                     staff_code(row["MaLeTan"]) if row["MaLeTan"] else "LEGACY_UNASSIGNED", state),
                    counts, "appointment_checkins")
            for (branch, doctor, date), last_number in queue_numbers.items():
                cursor.execute(
                    "INSERT INTO appointment_queue_counters (branch_code, doctor_code, duty_date, last_number) "
                    "VALUES (%s, %s, %s, %s) ON DUPLICATE KEY UPDATE "
                    "last_number = GREATEST(last_number, VALUES(last_number))",
                    (branch, doctor, date, last_number),
                )
        connection.commit()
        return counts
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def merge_clinical(rows: dict) -> Counter:
    connection = connect("clinical")
    counts = Counter()
    appointments = {row["MaLichHen"]: row for row in rows["lich_hen"]}
    visits = {row["MaLuotKham"]: row for row in rows["luot_kham"]}
    lab_by_visit = defaultdict(list)
    rx_by_visit = defaultdict(list)
    treatment_by_visit = defaultdict(list)
    for row in rows["chi_tiet_xet_nghiem"]:
        lab_by_visit[row["MaLuotKham"]].append(row)
    for row in rows["chi_tiet_don_thuoc"]:
        rx_by_visit[row["MaLuotKham"]].append(row)
    for row in rows["lich_trinh_dieu_tri"]:
        treatment_by_visit[row["MaLuotKham"]].append(row)
    try:
        with connection.cursor() as cursor:
            for visit in rows["luot_kham"]:
                appointment = appointments[visit["MaLichHen"]]
                visit_id = visit["MaLuotKham"]
                encounter_id = stable_id("encounter", visit_id)
                patient_id = stable_id("patient", appointment["MaBenhAn"])
                doctor = staff_code(visit["MaBacSi"] or appointment["MaBacSi"])
                config = next(row for row in rows["chi_nhanh_dich_vu"]
                              if row["MaCauHinh"] == appointment["MaCauHinh"])
                prescriptions = [
                    {"medicine_code": item["MaThuoc"], "quantity": item["SoLuong"],
                     "dosage": item["LieuDung"]}
                    for item in rx_by_visit[visit_id]
                ]
                grouped_treatments = defaultdict(int)
                for item in treatment_by_visit[visit_id]:
                    grouped_treatments[item["MaDichVu"]] = max(
                        grouped_treatments[item["MaDichVu"]], item["BuoiSo"])
                treatments = [{"service_code": code, "sessions": total}
                              for code, total in sorted(grouped_treatments.items())]
                status = "completed" if appointment["TrangThai"] == "Hoàn thành" else "draft"
                insert_once(cursor,
                    "INSERT INTO encounters "
                    "(id, appointment_id, patient_id, doctor_code, branch_code, visit_date, "
                    "status, disease_code, symptoms, advice, lab_service_codes, prescriptions, treatments) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
                    "ON DUPLICATE KEY UPDATE id = id",
                    (encounter_id, visit["MaLichHen"], patient_id, doctor,
                     config["MaChiNhanh"], appointment["NgayKham"], status,
                     visit["MaBenh"], visit["TrieuChung"], visit["LoiDan"],
                     json.dumps(sorted({item["MaDichVu"] for item in lab_by_visit[visit_id]})),
                     json.dumps(prescriptions, ensure_ascii=False),
                     json.dumps(treatments, ensure_ascii=False)),
                    counts, "encounters")
                for code, total in grouped_treatments.items():
                    insert_once(cursor,
                        "INSERT INTO treatment_plans "
                        "(id, encounter_id, patient_id, doctor_code, service_code, total_sessions) "
                        "VALUES (%s, %s, %s, %s, %s, %s) ON DUPLICATE KEY UPDATE id = id",
                        (stable_id("plan", f"{visit_id}:{code}"), encounter_id,
                         patient_id, doctor, code, total), counts, "treatment_plans")
            for row in rows["lich_trinh_dieu_tri"]:
                plan_id = stable_id("plan", f'{row["MaLuotKham"]}:{row["MaDichVu"]}')
                session_id = stable_id("treatment_session", row["MaLichTrinh"])
                cursor.execute(
                    "SELECT id FROM treatment_sessions WHERE plan_id = %s AND session_number = %s",
                    (plan_id, row["BuoiSo"]),
                )
                existing = cursor.fetchone()
                if existing:
                    if existing["id"] != session_id:
                        raise ValueError(f'Legacy treatment session collision: {row["MaLichTrinh"]}')
                    cursor.execute(
                        "UPDATE treatment_sessions SET source = 'legacy_mysql' "
                        "WHERE id = %s AND source = 'live'", (session_id,),
                    )
                    counts["treatment_sources_updated"] += cursor.rowcount
                    continue
                if not row["MaLichHen"]:
                    visit = visits[row["MaLuotKham"]]
                    encounter_appointment = appointments[visit["MaLichHen"]]
                    insert_once(cursor,
                        "INSERT INTO treatment_sessions "
                        "(id, plan_id, session_number, patient_request_key, config_code, "
                        "doctor_code, duty_date, shift, appointment_id, status, source) "
                        "VALUES (%s, %s, %s, %s, NULL, %s, NULL, NULL, NULL, "
                        "'historical_unbooked', 'legacy_mysql')",
                        (session_id, plan_id, row["BuoiSo"],
                         f'legacy_mysql:{row["MaLichTrinh"]}',
                         staff_code(visit["MaBacSi"] or encounter_appointment["MaBacSi"])),
                        counts, "treatment_sessions")
                    continue
                appointment = appointments[row["MaLichHen"]]
                insert_once(cursor,
                    "INSERT INTO treatment_sessions "
                    "(id, plan_id, session_number, patient_request_key, config_code, "
                    "doctor_code, duty_date, shift, appointment_id, status, source) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'legacy_mysql')",
                    (session_id, plan_id,
                     row["BuoiSo"], f'legacy_mysql:{row["MaLichTrinh"]}',
                     appointment["MaCauHinh"], staff_code(appointment["MaBacSi"]),
                     appointment["NgayKham"], appointment["CaKham"], row["MaLichHen"],
                     "completed" if row["TrangThai"] == "Hoàn thành" else "booked"),
                    counts, "treatment_sessions")
        connection.commit()
        return counts
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def merge_laboratory(rows: dict) -> Counter:
    connection = connect("laboratory")
    counts = Counter()
    visits = {row["MaLuotKham"]: row for row in rows["luot_kham"]}
    appointments = {row["MaLichHen"]: row for row in rows["lich_hen"]}
    configs = {row["MaCauHinh"]: row for row in rows["chi_nhanh_dich_vu"]}
    services = {row["MaDichVu"]: row for row in rows["dich_vu"]}
    try:
        with connection.cursor() as cursor:
            for row in rows["chi_tiet_xet_nghiem"]:
                visit = visits[row["MaLuotKham"]]
                appointment = appointments[visit["MaLichHen"]]
                config = configs[appointment["MaCauHinh"]]
                insert_once(cursor,
                    "INSERT INTO lab_orders "
                    "(id, encounter_id, appointment_id, patient_id, branch_code, doctor_code, "
                    "service_code, list_price, status, technician_code, result_text, notes) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'resulted', %s, %s, %s) "
                    "ON DUPLICATE KEY UPDATE id = id",
                    (stable_id("lab_order", row["MaChiTietXN"]),
                     stable_id("encounter", row["MaLuotKham"]), visit["MaLichHen"],
                     stable_id("patient", appointment["MaBenhAn"]),
                     config["MaChiNhanh"], staff_code(visit["MaBacSi"] or appointment["MaBacSi"]),
                     row["MaDichVu"], services[row["MaDichVu"]]["GiaGoc"],
                     staff_code(row["MaXNV"]) if row["MaXNV"] else None,
                     row["KetQuaXetNghiem"],
                     f'Legacy {row["MaChiTietXN"]}; số tiền cũ {row["GiaCuoi"]} VND'),
                    counts, "lab_orders")
        connection.commit()
        return counts
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def merge_billing(rows: dict) -> Counter:
    connection = connect("billing")
    counts = Counter()
    patients = {row["MaBenhAn"]: row for row in rows["benh_nhan"]}
    categories = {row["KyTuDauBHYT"]: row for row in rows["danh_muc_bhyt"]}
    configs = {row["MaCauHinh"]: row for row in rows["chi_nhanh_dich_vu"]}
    services = {row["MaDichVu"]: row for row in rows["dich_vu"]}
    appointments = {row["MaLichHen"]: row for row in rows["lich_hen"]}
    visits = {row["MaLuotKham"]: row for row in rows["luot_kham"]}
    try:
        with connection.cursor() as cursor:
            for row in rows["lich_hen"]:
                config = configs[row["MaCauHinh"]]
                service = services[config["MaDichVu"]]
                patient = patients.get(row["MaBenhAn"])
                category = patient["KyTuDauBHYT"] if patient else None
                list_price = service["GiaGoc"]
                amount = row["GiaCuoi"]
                if not 0 <= amount <= list_price:
                    raise ValueError(f'Invalid legacy appointment price {row["MaLichHen"]}')
                insert_once(cursor,
                    "INSERT INTO invoices "
                    "(id, appointment_id, patient_account_id, patient_id, service_code, "
                    "branch_code, doctor_code, list_price, insurance_card_number, "
                    "insurance_category_code, coverage_bps, insurance_discount, amount_due, "
                    "status, payment_method, source, legacy_date) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, "
                    "'paid', 'legacy_unknown', 'legacy_mysql', %s) "
                    "ON DUPLICATE KEY UPDATE id = id",
                    (stable_id("invoice", row["MaLichHen"]), row["MaLichHen"],
                     stable_id("account", f'patient:{row["MaBenhAn"]}'),
                     stable_id("patient", row["MaBenhAn"]), config["MaDichVu"],
                     config["MaChiNhanh"], staff_code(row["MaBacSi"]), list_price,
                     patient["MaSoBHYT"] if patient else None, category,
                     round(categories[category]["TyLeHuong"] * 10000) if category else 0,
                     list_price - amount, amount, row["NgayKham"]),
                    counts, "invoices")
            for row in rows["chi_tiet_xet_nghiem"]:
                visit = visits[row["MaLuotKham"]]
                appointment = appointments[visit["MaLichHen"]]
                config = configs[appointment["MaCauHinh"]]
                list_price = services[row["MaDichVu"]]["GiaGoc"]
                amount = row["GiaCuoi"]
                if not 0 <= amount <= list_price:
                    raise ValueError(f'Invalid legacy lab price {row["MaChiTietXN"]}')
                insert_once(cursor,
                    "INSERT INTO legacy_lab_charges "
                    "(id, lab_order_id, appointment_id, patient_id, branch_code, doctor_code, "
                    "service_code, list_price, insurance_discount, amount_due, legacy_date) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
                    "ON DUPLICATE KEY UPDATE id = id",
                    (stable_id("lab_charge", row["MaChiTietXN"]),
                     stable_id("lab_order", row["MaChiTietXN"]), visit["MaLichHen"],
                     stable_id("patient", appointment["MaBenhAn"]),
                     config["MaChiNhanh"], staff_code(visit["MaBacSi"] or appointment["MaBacSi"]),
                     row["MaDichVu"], list_price, list_price - amount, amount,
                     appointment["NgayKham"]), counts, "legacy_lab_charges")
        connection.commit()
        return counts
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", type=Path, default=DEFAULT_DUMP)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--allow-nonlocal", action="store_true")
    args = parser.parse_args()
    if hashlib.sha256(args.file.read_bytes()).hexdigest() != EXPECTED_SHA256:
        raise ValueError("SQL dump checksum differs from the audited 2026-10-22 file")
    rows = parse_dump(args.file)
    print("Legacy merge plan: 52 disabled accounts (1 missing-source patient), "
          "13 patient profiles (1 without CCCD), 26 BHYT categories, 39 staff, "
          "2 branches, 65 services, 130 configurations, 1728 historical shifts, "
          "49 appointments, 15 notifications, up to 40 check-ins, "
          "20 encounters, 8 treatment plans, 16 sessions (12 undated), 13 lab orders, "
          "49 invoices and 13 lab charges.")
    print("Four cross-branch shift conflicts and 12 undated sessions are marked historical, not bookable.")
    if not args.apply:
        print("Dry run only. Pass --apply to merge without replacing existing rows.")
        return
    if connection_settings("registry")["host"] not in ("127.0.0.1", "localhost") and not args.allow_nonlocal:
        raise RuntimeError("Nonlocal MySQL requires --allow-nonlocal")
    for service, action in (
        ("identity", merge_identity), ("registry", merge_registry),
        ("scheduling", merge_scheduling), ("appointment", merge_appointment),
        ("clinical", merge_clinical), ("laboratory", merge_laboratory),
        ("billing", merge_billing),
    ):
        counts = action(rows)
        print(f"{service}_db: " + ", ".join(f"{name} +{count}" for name, count in sorted(counts.items())))


if __name__ == "__main__":
    main()
