"""Read-only audit of the audited legacy dump after merging into seven databases."""

import argparse
import hashlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from demo_import.import_mysql_dump import DEFAULT_DUMP, EXPECTED_SHA256, parse_dump
from demo_import.merge_mysql_dump import connect, missing_patient_codes, stable_id


def count(service: str, sql: str, params: tuple = ()) -> int:
    connection = connect(service)
    try:
        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            return int(cursor.fetchone()["n"])
    finally:
        connection.close()


def ids_present(service: str, table: str, ids: list[str]) -> int:
    placeholders = ", ".join(["%s"] * len(ids))
    return count(service, f"SELECT COUNT(*) AS n FROM {table} WHERE id IN ({placeholders})",
                 tuple(ids))


def codes_present(service: str, table: str, codes: list[str]) -> int:
    placeholders = ", ".join(["%s"] * len(codes))
    return count(service, f"SELECT COUNT(*) AS n FROM {table} WHERE code IN ({placeholders})",
                 tuple(codes))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", type=Path, default=DEFAULT_DUMP)
    args = parser.parse_args()
    if hashlib.sha256(args.file.read_bytes()).hexdigest() != EXPECTED_SHA256:
        raise ValueError("Legacy SQL dump checksum differs from the audited file")
    rows = parse_dump(args.file)
    accounts = [stable_id("account", f"{role}:{row[key]}")
                for table, role, key in (
                    ("bac_si", "doctor", "MaBacSi"),
                    ("le_tan", "letan", "MaLeTan"),
                    ("xet_nghiem_vien", "xnv", "MaXNV"),
                    ("benh_nhan", "patient", "MaBenhAn"),
                ) for row in rows[table]]
    accounts += [stable_id("account", f"patient:{code}")
                 for code in missing_patient_codes(rows)]
    checks = {
        "identity accounts (disabled)": (
            count("identity", "SELECT COUNT(*) AS n FROM accounts WHERE id IN ("
                  + ", ".join(["%s"] * len(accounts)) + ") AND is_active = FALSE",
                  tuple(accounts)), 52),
        "registry patients": (
            count("registry", "SELECT COUNT(*) AS n FROM patients "
                  "WHERE source IN ('legacy_mysql', 'legacy_orphan')"), 13),
        "registry staff": (
            count("registry", "SELECT COUNT(*) AS n FROM staff_profiles "
                  "WHERE source = 'legacy_mysql'"), 39),
        "registry insurance categories": (
            codes_present("registry", "insurance_categories",
                          [row["KyTuDauBHYT"] for row in rows["danh_muc_bhyt"]]), 26),
        "registry branches": (
            codes_present("registry", "branches",
                          [row["MaChiNhanh"] for row in rows["chi_nhanh"]]), 2),
        "registry medical services": (
            codes_present("registry", "medical_services",
                          [row["MaDichVu"] for row in rows["dich_vu"]]), 65),
        "registry branch configurations": (
            codes_present("registry", "branch_services",
                          [row["MaCauHinh"] for row in rows["chi_nhanh_dich_vu"]]), 130),
        "scheduling historical shifts": (
            count("scheduling", "SELECT COUNT(*) AS n FROM doctor_schedules "
                  "WHERE source = 'legacy_mysql' AND status = 'historical' "
                  "AND legacy_source_id IS NOT NULL"), 1728),
        "scheduling preserved cross-branch conflicts": (
            count("scheduling", "SELECT COUNT(*) AS n FROM ("
                  "SELECT doctor_code, duty_date, shift FROM doctor_schedules "
                  "WHERE source = 'legacy_mysql' GROUP BY doctor_code, duty_date, shift "
                  "HAVING COUNT(*) > 1) AS conflicts"), 4),
        "scheduling nonhistorical duplicate shifts": (
            count("scheduling", "SELECT COUNT(*) AS n FROM ("
                  "SELECT doctor_code, duty_date, shift FROM doctor_schedules "
                  "WHERE status <> 'historical' GROUP BY doctor_code, duty_date, shift "
                  "HAVING COUNT(*) > 1) AS conflicts"), 0),
        "appointment historical bookings": (
            count("appointment", "SELECT COUNT(*) AS n FROM appointments "
                  "WHERE source = 'legacy_mysql' AND status = 'historical'"), 49),
        "appointment notifications": (
            ids_present("appointment", "patient_notifications",
                        [stable_id("notification", row["MaThongBao"])
                         for row in rows["lich_su_thong_bao"]]), 15),
        "appointment check-ins": (
            count("appointment", "SELECT COUNT(*) AS n FROM appointment_checkins c "
                  "JOIN appointments a ON a.id = c.appointment_id "
                  "WHERE a.source = 'legacy_mysql'"), 40),
        "clinical encounters": (
            ids_present("clinical", "encounters", [stable_id("encounter", row["MaLuotKham"])
                                                  for row in rows["luot_kham"]]), 20),
        "clinical treatment plans": (
            ids_present("clinical", "treatment_plans", list({
                stable_id("plan", f'{row["MaLuotKham"]}:{row["MaDichVu"]}')
                for row in rows["lich_trinh_dieu_tri"]})), 8),
        "clinical treatment sessions": (
            count("clinical", "SELECT COUNT(*) AS n FROM treatment_sessions "
                  "WHERE source = 'legacy_mysql'"), 16),
        "clinical undated sessions": (
            count("clinical", "SELECT COUNT(*) AS n FROM treatment_sessions "
                  "WHERE source = 'legacy_mysql' AND status = 'historical_unbooked' "
                  "AND config_code IS NULL AND duty_date IS NULL AND shift IS NULL "
                  "AND appointment_id IS NULL"), 12),
        "laboratory orders": (
            ids_present("laboratory", "lab_orders", [stable_id("lab_order", row["MaChiTietXN"])
                                                   for row in rows["chi_tiet_xet_nghiem"]]), 13),
        "billing invoices": (
            count("billing", "SELECT COUNT(*) AS n FROM invoices WHERE source = 'legacy_mysql'"), 49),
        "billing lab charges": (
            count("billing", "SELECT COUNT(*) AS n FROM legacy_lab_charges"), 13),
    }
    failed = []
    for label, (actual, expected) in checks.items():
        print(f"{label}: {actual}/{expected}")
        if actual != expected:
            failed.append(label)
    if failed:
        raise SystemExit("Legacy merge verification failed: " + ", ".join(failed))
    print("PASS legacy records are present in their service-owned operational tables")


if __name__ == "__main__":
    main()
