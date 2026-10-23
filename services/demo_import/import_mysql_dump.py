"""Split the October 2026 legacy MySQL dump into service-owned history tables.

Only immutable, non-credential history is copied. Existing live rows are never
updated. Historical appointments and clinical catalogs are also exposed through
their canonical read models where that is safe.
"""

import argparse
import asyncio
import hashlib
import json
import re
import sqlite3
import sys
from collections import Counter
from pathlib import Path

import aiomysql

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from demo_import.import_history import TABLE_SERVICE, connection_settings, insert_history, scrub


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DUMP = ROOT / "clinic-2026-10-22_15-09-09-m1km21dy.sql"
SOURCE = "mysql_dump_20261022"
EXPECTED_SHA256 = "6eb4aa8c0fc89ecbdaee1f8cd9e2ab7f80d90699bf723d163df6d732cf5cf3fb"
REDACTED_TOKEN = "[REDACTED LEGACY PAYMENT TOKEN]"
TABLES = {name.lower() for name in TABLE_SERVICE}
ACCOUNT_TABLES = {
    "bac_si": ("doctor", "MaBacSi"),
    "le_tan": ("letan", "MaLeTan"),
    "xet_nghiem_vien": ("xnv", "MaXNV"),
    "benh_nhan": ("patient", "MaBenhAn"),
}


def parse_dump(path: Path) -> dict[str, list[dict]]:
    """Read static mysqldump INSERTs in SQLite memory; never execute DDL from it."""
    source = path.read_text(encoding="utf-8")
    definitions = re.findall(r"CREATE TABLE `([^`]+)` \((.*?)\) ENGINE=", source, re.S)
    if {name for name, _ in definitions} != TABLES:
        raise ValueError("Dump table set differs from the 17 supported legacy tables")
    database = sqlite3.connect(":memory:")
    database.row_factory = sqlite3.Row
    try:
        for name, body in definitions:
            columns = re.findall(r"(?m)^  `([^`]+)`\s+([a-z]+)", body, re.I)
            if not columns:
                raise ValueError(f"No columns found for {name}")
            declarations = []
            for column, legacy_type in columns:
                kind = ("INTEGER" if "int" in legacy_type.lower() else
                        "REAL" if legacy_type.lower() in ("float", "double") else "TEXT")
                declarations.append(f'"{column}" {kind}')
            database.execute(f'CREATE TABLE "{name}" ({", ".join(declarations)})')
        seen = set()
        for name, values in re.findall(r"(?m)^INSERT INTO `([^`]+)` VALUES (.*);$", source):
            if name not in TABLES or name in seen:
                raise ValueError(f"Unexpected or repeated INSERT for {name}")
            seen.add(name)
            database.execute(f'INSERT INTO "{name}" VALUES {values}')
        if seen != TABLES:
            raise ValueError("One or more legacy tables have no INSERT statement")
        return {
            name: [dict(row) for row in database.execute(f'SELECT * FROM "{name}"')]
            for name in TABLES
        }
    finally:
        database.close()


def safe_payload(row: dict) -> dict:
    cleaned = scrub(row)
    if cleaned.get("PaymentToken") is not None:
        cleaned["PaymentToken"] = REDACTED_TOKEN
    return cleaned


def prepare_records(rows: dict[str, list[dict]]) -> dict[str, list[tuple]]:
    """Return service -> historical_records tuples; projections keep ownership clear."""
    records = {service: [] for service in (*set(TABLE_SERVICE.values()), "identity")}
    for table, table_rows in rows.items():
        service = TABLE_SERVICE[table.upper()]
        for row in table_rows:
            key = str(next(iter(row.values())))
            records[service].append((service, SOURCE, table, key,
                                     json.dumps(safe_payload(row), ensure_ascii=False)))
            if table in ACCOUNT_TABLES:
                role, id_field = ACCOUNT_TABLES[table]
                account = {"role": role, "legacy_subject_id": row[id_field],
                           "legacy_username": row.get("SDT") if role == "patient" else row[id_field],
                           "legacy_status": row.get("TrangThai"),
                           "note": "Archive only; no login account was created"}
                records["identity"].append(("identity", SOURCE, "legacy_account",
                                            f"{role}:{row[id_field]}",
                                            json.dumps(account, ensure_ascii=False)))
            if table == "lich_hen":
                payment = {field: row.get(field) for field in
                           ("MaLichHen", "MaBenhAn", "MaCauHinh", "GiaCuoi", "PaymentToken")}
                records["billing"].append(("billing", SOURCE, "legacy_appointment_payment",
                                           key, json.dumps(safe_payload(payment), ensure_ascii=False)))
            if table == "chi_tiet_xet_nghiem":
                payment = {field: row.get(field) for field in
                           ("MaChiTietXN", "MaLuotKham", "GiaCuoi", "PaymentToken")}
                records["billing"].append(("billing", SOURCE, "legacy_lab_payment",
                                           key, json.dumps(safe_payload(payment), ensure_ascii=False)))
    return records


async def insert_appointments(rows: dict[str, list[dict]]) -> int:
    """Expose old appointments to Admin only, without claiming current identities."""
    configs = {row["MaCauHinh"]: row for row in rows["chi_nhanh_dich_vu"]}
    connection = await aiomysql.connect(**connection_settings("appointment"))
    inserted = 0
    try:
        async with connection.cursor() as cursor:
            for row in rows["lich_hen"]:
                config = configs[row["MaCauHinh"]]
                await cursor.execute(
                    "INSERT INTO appointments "
                    "(id, patient_id, config_code, branch_code, service_code, doctor_code, "
                    "duty_date, shift, status, source, legacy_status) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'historical', 'legacy_mysql', %s) "
                    "ON DUPLICATE KEY UPDATE id = id",
                    (row["MaLichHen"], f'legacy_mysql:{row["MaBenhAn"]}', row["MaCauHinh"],
                     config["MaChiNhanh"], config["MaDichVu"],
                     f'legacy_mysql:{row["MaBacSi"] or "unassigned"}',
                     row["NgayKham"], row["CaKham"], row["TrangThai"]),
                )
                inserted += cursor.rowcount
        await connection.commit()
        return inserted
    except Exception:
        await connection.rollback()
        raise
    finally:
        connection.close()


async def insert_clinical_catalogs(rows: dict[str, list[dict]]) -> Counter:
    connection = await aiomysql.connect(**connection_settings("clinical"))
    inserted = Counter()
    try:
        async with connection.cursor() as cursor:
            for row in rows["benh"]:
                await cursor.execute(
                    "INSERT INTO disease_catalog (code, name) VALUES (%s, %s) "
                    "ON DUPLICATE KEY UPDATE code = code",
                    (row["MaBenh"], row["TenBenh"]),
                )
                inserted["disease_catalog"] += cursor.rowcount
            for row in rows["thuoc"]:
                await cursor.execute(
                    "INSERT INTO medicine_catalog (code, name, unit) VALUES (%s, %s, %s) "
                    "ON DUPLICATE KEY UPDATE code = code",
                    (row["MaThuoc"], row["TenThuoc"], row["DonViTinh"]),
                )
                inserted["medicine_catalog"] += cursor.rowcount
        await connection.commit()
        return inserted
    except Exception:
        await connection.rollback()
        raise
    finally:
        connection.close()


async def apply(rows: dict[str, list[dict]], records: dict[str, list[tuple]]) -> None:
    for service in sorted(records):
        count = await insert_history(service, records[service])
        print(f"{service}_db.historical_records: +{count} / {len(records[service])}")
    print(f"appointment_db.appointments historical: +{await insert_appointments(rows)}")
    for table, count in sorted((await insert_clinical_catalogs(rows)).items()):
        print(f"clinical_db.{table}: +{count}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", type=Path, default=DEFAULT_DUMP)
    parser.add_argument("--apply", action="store_true", help="Write idempotently to service databases")
    parser.add_argument("--allow-nonlocal", action="store_true", help="Allow a Docker-network MySQL host")
    args = parser.parse_args()
    actual_hash = hashlib.sha256(args.file.read_bytes()).hexdigest()
    if actual_hash != EXPECTED_SHA256:
        raise ValueError("SQL dump checksum differs from the audited 2026-10-22 file")
    rows = parse_dump(args.file)
    records = prepare_records(rows)
    print(f"Legacy rows: {sum(map(len, rows.values()))} in {len(rows)} tables")
    for service in sorted(records):
        print(f"{service}_db: {len(records[service])} safe historical records prepared")
    if args.apply:
        host = connection_settings("registry")["host"]
        if host not in ("127.0.0.1", "localhost") and not args.allow_nonlocal:
            raise RuntimeError("Nonlocal MySQL requires --allow-nonlocal")
        asyncio.run(apply(rows, records))
    else:
        print("Dry run only. Pass --apply to import without overwriting live rows.")


if __name__ == "__main__":
    main()
