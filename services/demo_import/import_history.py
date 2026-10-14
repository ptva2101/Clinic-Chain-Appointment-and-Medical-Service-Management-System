"""Import committed legacy demo fixtures into the owning service MySQL databases.

The legacy SQLite bootstrap is parsed and executed only in memory. No legacy
password is stored or activated. Existing MySQL rows are never overwritten.
"""

import argparse
import ast
import asyncio
import hashlib
import json
import os
import re
import sqlite3
import subprocess
from collections import Counter
from pathlib import Path

import aiomysql


ROOT = Path(__file__).resolve().parents[2]
DASHBOARDS = (
    "AdminDashboard", "PatientDashboard", "DoctorDashboard",
    "ReceptionistDashboard", "TechnicianDashboard",
)
TABLE_SERVICE = {
    "DANH_MUC_BHYT": "billing",
    "BENH_NHAN": "registry",
    "BAC_SI": "registry",
    "CHI_NHANH": "registry",
    "LE_TAN": "registry",
    "XET_NGHIEM_VIEN": "registry",
    "DICH_VU": "registry",
    "CHI_NHANH_DICH_VU": "registry",
    "LICH_TRUC": "scheduling",
    "LICH_HEN": "appointment",
    "LICH_SU_THONG_BAO": "appointment",
    "BENH": "clinical",
    "THUOC": "clinical",
    "LUOT_KHAM": "clinical",
    "CHI_TIET_DON_THUOC": "clinical",
    "CHI_TIET_XET_NGHIEM": "laboratory",
    "LICH_TRINH_DIEU_TRI": "clinical",
}
ARRAY_SERVICE = {
    "branches": "registry", "services": "registry", "staffList": "registry",
    "patients": "registry", "branchServices": "registry",
    "doctorSchedules": "scheduling", "appointments": "appointment",
    "bookings": "appointment", "diseases": "clinical", "medicines": "clinical",
    "visitRecords": "clinical", "prescriptionDetails": "clinical",
    "treatmentSchedules": "clinical", "labDetails": "laboratory",
    "labTestDetails": "laboratory", "labTechnicians": "laboratory",
    "completedFinancialRecords": "billing", "treatmentRevenueDetails": "billing",
    "bhytCategories": "billing", "initialPatientProfile": "registry",
    "slotDrafts": "registry",
}
HISTORY_SCHEMA = """
CREATE TABLE IF NOT EXISTS historical_records (
    source VARCHAR(40) NOT NULL,
    entity VARCHAR(96) NOT NULL,
    legacy_key VARCHAR(64) NOT NULL,
    payload JSON NOT NULL,
    imported_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (source, entity, legacy_key),
    KEY ix_history_entity (entity)
)"""


def scrub(value):
    if isinstance(value, dict):
        result = {}
        for key, item in value.items():
            if key.lower() in ("matkhau", "password", "password_hash"):
                result[key] = "[REDACTED DEMO CREDENTIAL]"
            elif key == "_raw_js" and isinstance(item, str):
                result[key] = "\n".join(
                    "[REDACTED DEMO CREDENTIAL EXPRESSION]" if re.search(
                        r"matkhau|password|secret", line, re.IGNORECASE
                    ) else line for line in item.splitlines()
                )
            else:
                result[key] = scrub(item)
        return result
    if isinstance(value, list):
        return [scrub(item) for item in value]
    return value


def digest(value) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def parse_legacy_bootstrap(source: str) -> dict[str, list[dict]]:
    tree = ast.parse(source)
    scripts = [node.args[0].value for node in ast.walk(tree)
               if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
               and node.func.attr == "executescript" and node.args
               and isinstance(node.args[0], ast.Constant) and isinstance(node.args[0].value, str)]
    if not scripts:
        raise RuntimeError("No static legacy SQL fixture was found")
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    try:
        for script in scripts:
            connection.executescript(script)
        names = {row[0] for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )}
        return {
            table: [dict(row) for row in connection.execute(f'SELECT * FROM "{table}"')]
            for table in TABLE_SERVICE if table in names
        }
    finally:
        connection.close()


def backend_rows() -> tuple[dict[str, list[dict]], list[tuple]]:
    source = (ROOT / "Backend" / "init_db.py").read_text(encoding="utf-8")
    rows = parse_legacy_bootstrap(source)
    records = []
    for table, service in TABLE_SERVICE.items():
        for row in rows[table]:
            cleaned = scrub(row)
            records.append((service, "backend_init_db", table.lower(), str(row[next(iter(row))]),
                            json.dumps(cleaned, ensure_ascii=False, default=str)))
    return rows, records


def git_text(*args: str) -> str | None:
    result = subprocess.run(["git", *args], cwd=ROOT, text=True,
                            encoding="utf-8", errors="replace", capture_output=True)
    return result.stdout if result.returncode == 0 else None


def extra_backend_records() -> list[tuple]:
    records_by_key = {}
    revisions = (git_text("log", "--all", "--format=%H", "--", "Backend/init_db.py") or "").splitlines()
    for revision in revisions:
        source = git_text("show", f"{revision}:Backend/init_db.py")
        if source is None:
            continue
        try:
            rows = parse_legacy_bootstrap(source)
        except (SyntaxError, sqlite3.DatabaseError, RuntimeError):
            # Do not store raw source because it may contain demo passwords.
            key = digest(source)
            records_by_key[("clinical", "backend_git", "unparsed_seed", key)] = (
                "clinical", "backend_git", "unparsed_seed", key,
                json.dumps({"revision": revision, "source_sha256": key,
                            "note": "Older bootstrap could not be parsed"}),
            )
            continue
        for table, table_rows in rows.items():
            service = TABLE_SERVICE[table]
            for row in table_rows:
                cleaned = scrub(row)
                key = digest(cleaned)
                records_by_key[(service, "backend_git", table.lower(), key)] = (
                    service, "backend_git", table.lower(), key,
                    json.dumps({"value": cleaned, "revision": revision}, ensure_ascii=False,
                               default=str),
                )

    db_path = ROOT / "Backend" / "hospital.db"
    if db_path.exists():
        connection = sqlite3.connect(f"file:{db_path.as_posix()}?mode=ro", uri=True)
        connection.row_factory = sqlite3.Row
        try:
            names = {row[0] for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )}
            for table, service in TABLE_SERVICE.items():
                if table not in names:
                    continue
                for record in connection.execute(f'SELECT * FROM "{table}"'):
                    cleaned = scrub(dict(record))
                    key = digest(cleaned)
                    records_by_key[(service, "legacy_sqlite_db", table.lower(), key)] = (
                        service, "legacy_sqlite_db", table.lower(), key,
                        json.dumps(cleaned, ensure_ascii=False, default=str),
                    )
        finally:
            connection.close()

    for filename in ("insert_lich_truc.sql", "insert_lich_truc_0406.sql"):
        sql_path = ROOT / "Backend" / filename
        if not sql_path.exists():
            continue
        source = sql_path.read_text(encoding="utf-8")
        start = source.upper().find("INSERT INTO")
        end = source.find(";", start)
        if start < 0 or end < 0:
            raise RuntimeError(f"No INSERT statement in {filename}")
        connection = sqlite3.connect(":memory:")
        connection.row_factory = sqlite3.Row
        try:
            connection.execute(
                "CREATE TABLE lich_truc (MaLichTruc TEXT, MaBacSi TEXT, MaChiNhanh TEXT, "
                "NgayTruc TEXT, CaTruc INTEGER)"
            )
            connection.executescript(source[start:end + 1])
            for record in connection.execute("SELECT * FROM lich_truc"):
                row = dict(record)
                key = digest(row)
                entity = sql_path.stem
                records_by_key[("scheduling", "legacy_schedule_sql", entity, key)] = (
                    "scheduling", "legacy_schedule_sql", entity, key,
                    json.dumps(row, ensure_ascii=False),
                )
        finally:
            connection.close()
    return list(records_by_key.values())


def frontend_records() -> list[tuple]:
    extractor = ROOT / "services" / "demo_import" / "extract_arrays.cjs"
    if not extractor.exists():
        raise RuntimeError("Frontend fixture extractor is missing")
    records_by_key = {}
    for component in DASHBOARDS:
        path = f"Frontend/src/dashboards/{component}.jsx"
        revisions = (git_text("log", "--all", "--format=%H", "--", path) or "").splitlines()
        sources = [(revision, git_text("show", f"{revision}:{path}")) for revision in revisions]
        current = ROOT / path
        if current.exists():
            sources.append(("working_tree", current.read_text(encoding="utf-8")))
        for revision, source in sources:
            if source is None:
                continue
            parsed = subprocess.run(["node", str(extractor)], input=source, text=True,
                                    encoding="utf-8", errors="replace", capture_output=True)
            if parsed.returncode != 0:
                raise RuntimeError(f"Could not parse fixture arrays from {path}@{revision}")
            for item in json.loads(parsed.stdout):
                variable = item["variable"]
                service = ARRAY_SERVICE[variable]
                entity = f"{component}.{variable}"
                value = scrub(item["value"])
                key = digest(value)
                records_by_key[(service, entity, key)] = (
                    service, "frontend_fixture", entity, key,
                    json.dumps({"value": value, "source_file": path,
                                "revision": revision, "index": item["index"]},
                               ensure_ascii=False, default=str),
                )
    return list(records_by_key.values())


def connection_settings(service: str) -> dict:
    return {
        "host": os.getenv("DEMO_MYSQL_HOST", "127.0.0.1"),
        "port": int(os.getenv("DEMO_MYSQL_PORT", "3307")),
        "user": f"{service}_app",
        "password": os.getenv(f"DEMO_{service.upper()}_DB_PASSWORD", f"dev_only_{service}"),
        "db": f"{service}_db",
        "charset": "utf8mb4",
        "autocommit": False,
    }


async def insert_history(service: str, records: list[tuple]) -> int:
    connection = await aiomysql.connect(**connection_settings(service))
    try:
        async with connection.cursor() as cursor:
            await cursor.execute(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = DATABASE() AND table_name = 'historical_records'"
            )
            if await cursor.fetchone() is None:
                await cursor.execute(HISTORY_SCHEMA)
            await cursor.executemany(
                "INSERT INTO historical_records (source, entity, legacy_key, payload) "
                "VALUES (%s, %s, %s, %s) ON DUPLICATE KEY UPDATE source = source",
                [(source, entity, key, payload) for _, source, entity, key, payload in records],
            )
            inserted = cursor.rowcount
        await connection.commit()
        return inserted
    finally:
        connection.close()


async def reconcile_frontend_history(service: str) -> int:
    """Drop only pre-normalization duplicates when a normalized copy exists."""
    connection = await aiomysql.connect(**connection_settings(service))
    removed = 0
    try:
        async with connection.cursor() as cursor:
            await cursor.execute(
                "SELECT entity, legacy_key, payload FROM historical_records "
                "WHERE source = 'frontend_fixture'"
            )
            rows = await cursor.fetchall()
            for entity, legacy_key, payload in rows:
                original = json.loads(payload)
                cleaned = scrub(original)
                if cleaned == original:
                    continue
                canonical_key = digest(cleaned["value"])
                if canonical_key != legacy_key:
                    await cursor.execute(
                        "SELECT 1 FROM historical_records WHERE source = 'frontend_fixture' "
                        "AND entity = %s AND legacy_key = %s",
                        (entity, canonical_key),
                    )
                    if await cursor.fetchone() is not None:
                        await cursor.execute(
                            "DELETE FROM historical_records WHERE source = 'frontend_fixture' "
                            "AND entity = %s AND legacy_key = %s",
                            (entity, legacy_key),
                        )
                        removed += cursor.rowcount
                        continue
                await cursor.execute(
                    "UPDATE historical_records SET legacy_key = %s, payload = %s "
                    "WHERE source = 'frontend_fixture' AND entity = %s AND legacy_key = %s",
                    (canonical_key, json.dumps(cleaned, ensure_ascii=False, default=str),
                     entity, legacy_key),
                )
        await connection.commit()
        return removed
    except Exception:
        await connection.rollback()
        raise
    finally:
        connection.close()


def canonical_staff_rows(rows: dict[str, list[dict]]) -> list[dict]:
    """Prefer the current backend seed over conflicting dashboard/Git variants."""
    profiles = []
    for table, code_field, role, fallback_specialty in (
        ("BAC_SI", "MaBacSi", "doctor", None),
        ("LE_TAN", "MaLeTan", "letan", "Tiếp nhận"),
        ("XET_NGHIEM_VIEN", "MaXNV", "xnv", "Xét nghiệm"),
    ):
        for row in rows[table]:
            profiles.append({
                "staff_code": row[code_field],
                "role": role,
                "full_name": row["HoTen"],
                "phone": row.get("SDT"),
                "specialty": row.get("ChuyenKhoa") or fallback_specialty,
                "branch_code": row.get("MaChiNhanh"),
            })
    return profiles


async def insert_canonical(rows: dict[str, list[dict]]) -> dict[str, int]:
    inserted = Counter()
    registry = await aiomysql.connect(**connection_settings("registry"))
    try:
        async with registry.cursor() as cursor:
            for profile in canonical_staff_rows(rows):
                await cursor.execute(
                    "INSERT INTO staff_profiles "
                    "(staff_code, identity_account_id, role, full_name, phone, specialty, "
                    "branch_code, source) VALUES (%s, NULL, %s, %s, %s, %s, %s, 'legacy_demo') "
                    "ON DUPLICATE KEY UPDATE staff_code = staff_code",
                    (profile["staff_code"], profile["role"], profile["full_name"],
                     profile["phone"], profile["specialty"], profile["branch_code"]),
                )
                inserted["registry.staff_profiles"] += cursor.rowcount
            for row in rows["CHI_NHANH"]:
                await cursor.execute(
                    "INSERT INTO branches (code, name, address, phone) VALUES (%s, %s, %s, %s) "
                    "ON DUPLICATE KEY UPDATE code = code",
                    (row["MaChiNhanh"], row["TenChiNhanh"], row["DiaChi"], row["SDT"]),
                )
                inserted["registry.branches"] += cursor.rowcount
            for row in rows["DICH_VU"]:
                await cursor.execute(
                    "INSERT INTO medical_services "
                    "(code, name, specialty, kind, price) VALUES (%s, %s, %s, %s, %s) "
                    "ON DUPLICATE KEY UPDATE code = code",
                    (row["MaDichVu"], row["TenDichVu"], row["ChuyenKhoa"],
                     row["LoaiDichVu"], row["GiaGoc"]),
                )
                inserted["registry.services"] += cursor.rowcount
            for row in rows["CHI_NHANH_DICH_VU"]:
                await cursor.execute(
                    "INSERT INTO branch_services "
                    "(code, branch_code, service_code, slot_limit) VALUES (%s, %s, %s, %s) "
                    "ON DUPLICATE KEY UPDATE code = code",
                    (row["MaCauHinh"], row["MaChiNhanh"], row["MaDichVu"], row["SlotGioiHan"]),
                )
                inserted["registry.branch_services"] += cursor.rowcount
        await registry.commit()
    except Exception:
        await registry.rollback()
        raise
    finally:
        registry.close()

    scheduling = await aiomysql.connect(**connection_settings("scheduling"))
    try:
        async with scheduling.cursor() as cursor:
            for row in rows["LICH_TRUC"]:
                await cursor.execute(
                    "INSERT INTO doctor_schedules "
                    "(doctor_code, branch_code, duty_date, shift) VALUES (%s, %s, %s, %s) "
                    "ON DUPLICATE KEY UPDATE id = id",
                    (row["MaBacSi"], row["MaChiNhanh"], row["NgayTruc"], row["CaTruc"]),
                )
                inserted["scheduling.doctor_schedules"] += cursor.rowcount
        await scheduling.commit()
    except Exception:
        await scheduling.rollback()
        raise
    finally:
        scheduling.close()

    configs = {row["MaCauHinh"]: row for row in rows["CHI_NHANH_DICH_VU"]}
    appointment = await aiomysql.connect(**connection_settings("appointment"))
    try:
        async with appointment.cursor() as cursor:
            for row in rows["LICH_HEN"]:
                config = configs[row["MaCauHinh"]]
                await cursor.execute(
                    "INSERT INTO appointments "
                    "(id, patient_id, config_code, branch_code, service_code, doctor_code, "
                    "duty_date, shift, status, source, legacy_status) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'historical', 'legacy_demo', %s) "
                    "ON DUPLICATE KEY UPDATE id = id",
                    (row["MaLichHen"], row["MaBenhAn"], row["MaCauHinh"],
                     config["MaChiNhanh"], config["MaDichVu"], row["MaBacSi"],
                     row["NgayKham"], row["CaKham"], row["TrangThai"]),
                )
                inserted["appointment.appointments"] += cursor.rowcount
        await appointment.commit()
    except Exception:
        await appointment.rollback()
        raise
    finally:
        appointment.close()
    return dict(inserted)


async def apply(records: list[tuple], rows: dict[str, list[dict]]) -> None:
    for service in sorted(set(TABLE_SERVICE.values()) | set(ARRAY_SERVICE.values())):
        service_records = [record for record in records if record[0] == service]
        count = await insert_history(service, service_records)
        removed = await reconcile_frontend_history(service)
        print(f"{service}_db.historical_records: +{count} / {len(service_records)}, "
              f"obsolete pre-normalization duplicates removed: {removed}")
    canonical = await insert_canonical(rows)
    for table, count in sorted(canonical.items()):
        print(f"{table}: +{count}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Write to service MySQL databases")
    args = parser.parse_args()
    rows, backend = backend_rows()
    frontend = frontend_records()
    extra = extra_backend_records()
    records = backend + frontend + extra
    counts = Counter(record[0] for record in records)
    print(f"Backend fixture records: {len(backend)}")
    print(f"Frontend fixture records, current and Git history: {len(frontend)}")
    print(f"Other backend source records, Git/SQLite/schedule SQL: {len(extra)}")
    for source, count in sorted(Counter(record[1] for record in extra).items()):
        print(f"  {source}: {count}")
    unparsed = sum(record[2] == "unparsed_seed" for record in extra)
    if unparsed:
        print(f"Warning: {unparsed} older bootstrap revision(s) could not be parsed")
    for service, count in sorted(counts.items()):
        print(f"{service}_db: {count} historical records prepared")
    if args.apply:
        asyncio.run(apply(records, rows))
    else:
        print("Dry run only. Pass --apply to insert without overwriting existing rows.")


if __name__ == "__main__":
    main()
