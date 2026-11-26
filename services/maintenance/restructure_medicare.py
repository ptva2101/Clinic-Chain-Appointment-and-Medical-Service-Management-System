"""Offline, backup-gated Medicare cleanup. Each connection uses its service's own DB user.

Run while API writers are stopped; rehearse against a restored backup first.
Passwords are deliberately reset for every remaining account, as requested for this local demo.
Schedules are generated separately through Scheduling's HTTP API by demo_setup.py.
"""
import argparse
import asyncio
from collections import Counter
import hashlib
import json
import os
from pathlib import Path

import aiomysql
from identity.security import hash_password, verify_password

DOCTORS = {f"LEGACY_BS{i:03}" for i in range(1, 34)}
BRANCHES = {"CN01", "CN02"}
SERVICES = {f"DV{i:03}" for i in range(1, 66)}
RECEPTION = {"LEGACY_LT001", "LEGACY_LT002"}
TECHNICIANS = {"LEGACY_XNV001", "LEGACY_XNV003"}
STAFF = DOCTORS | RECEPTION | TECHNICIANS
TABLES = {
    "identity": ("accounts", "refresh_tokens"),
    "registry": ("staff_profiles", "branches", "medical_services", "branch_services", "patients"),
    "scheduling": ("doctor_schedules", "slot_holds", "slot_inventory"),
    "appointment": ("appointments", "appointment_checkins", "patient_notifications", "appointment_queue_counters"),
    "billing": ("invoices", "legacy_lab_charges"),
    "clinical": ("encounters", "treatment_plans", "treatment_sessions"),
    "laboratory": ("lab_orders",),
}


async def connect(service):
    return await aiomysql.connect(
        host=os.getenv("DB_HOST", "mysql"), port=int(os.getenv("DB_PORT", "3306")),
        user=f"{service}_app", password=os.getenv(f"RESTRUCTURE_{service.upper()}_PASSWORD", f"dev_only_{service}"),
        db=f"{service}_db", charset="utf8mb4", autocommit=False, cursorclass=aiomysql.DictCursor,
    )


async def snapshot():
    result = {}
    for service, tables in TABLES.items():
        db = await connect(service)
        try:
            async with db.cursor() as cur:
                await cur.execute("START TRANSACTION READ ONLY")
                result[service] = {}
                for table in tables:
                    await cur.execute(f"SELECT * FROM `{table}`")
                    result[service][table] = await cur.fetchall()
            await db.rollback()
        finally:
            db.close()
    return result


def build_plan(data):
    reg = data["registry"]
    people = {r["staff_code"]: r for r in reg["staff_profiles"]}
    accounts = {r["id"]: r for r in data["identity"]["accounts"]}
    assert STAFF <= people.keys(), "A required original staff profile is missing"
    assert BRANCHES <= {r["code"] for r in reg["branches"]}, "Original branch missing"
    assert SERVICES <= {r["code"] for r in reg["medical_services"]}, "Original service missing"
    for code in STAFF:
        person = people[code]
        account = accounts.get(person["identity_account_id"])
        role = "doctor" if code in DOCTORS else "letan" if code in RECEPTION else "xnv"
        assert person["role"] == role and account and account["role"] == role
        assert account["subject_id"] == code and account["username"] == code, f"Account linkage conflict: {code}"
    assert {r["specialty"] for r in reg["medical_services"] if r["code"] in SERVICES and r["kind"] != "Xét nghiệm"} == {
        people[c]["specialty"] for c in DOCTORS}, "Doctor/service specialty mismatch"
    configs = {r["code"] for r in reg["branch_services"] if r["branch_code"] in BRANCHES and r["service_code"] in SERVICES}
    assert len(configs) == 130, "Expected exactly 65 original service configs in each branch"
    removed = {}

    def put(service, table, key, predicate):
        ids = [r[key] for r in data[service][table] if predicate(r)]
        removed.setdefault(service, {})[table] = {"key": key, "ids": ids}
        return set(ids)

    def invalid_context(row):
        return (row.get("branch_code") not in BRANCHES or row.get("doctor_code") not in DOCTORS
                or (row.get("service_code") is not None and row["service_code"] not in SERVICES)
                or (row.get("config_code") is not None and row["config_code"] not in configs))

    appointments = put("appointment", "appointments", "id", invalid_context)
    encounters = put("clinical", "encounters", "id", lambda r: invalid_context(r) or r["appointment_id"] in appointments)
    plans = put("clinical", "treatment_plans", "id", lambda r:
                r["encounter_id"] in encounters or r["doctor_code"] not in DOCTORS or r["service_code"] not in SERVICES)
    put("clinical", "treatment_sessions", "id", lambda r:
        r["plan_id"] in plans or r["doctor_code"] not in DOCTORS or r["appointment_id"] in appointments
        or r["config_code"] is not None and r["config_code"] not in configs)
    labs = put("laboratory", "lab_orders", "id", lambda r:
               invalid_context(r) or r["encounter_id"] in encounters or r["appointment_id"] in appointments)
    put("billing", "invoices", "id", lambda r: invalid_context(r) or r["appointment_id"] in appointments)
    put("billing", "legacy_lab_charges", "id", lambda r:
        invalid_context(r) or r["appointment_id"] in appointments or r["lab_order_id"] in labs)
    put("appointment", "appointment_checkins", "appointment_id", lambda r:
        invalid_context(r) or r["appointment_id"] in appointments)
    put("appointment", "patient_notifications", "id", lambda r: r["appointment_id"] in appointments)
    put("scheduling", "doctor_schedules", "id", lambda r:
        r["doctor_code"] not in DOCTORS or r["branch_code"] not in BRANCHES)
    put("scheduling", "slot_holds", "id", lambda r: invalid_context(r) or r["appointment_id"] in appointments)
    put("scheduling", "slot_inventory", "config_code", lambda r: r["config_code"] not in configs)
    staff_ids = put("registry", "staff_profiles", "staff_code", lambda r: r["staff_code"] not in STAFF)
    put("registry", "branch_services", "code", lambda r: r["code"] not in configs)
    put("registry", "medical_services", "code", lambda r: r["code"] not in SERVICES)
    put("registry", "branches", "code", lambda r: r["code"] not in BRANCHES)
    put("identity", "accounts", "id", lambda r:
        r["role"] in ("doctor", "letan", "xnv") and r["subject_id"] not in STAFF)
    counters = [r for r in data["appointment"]["appointment_queue_counters"] if invalid_context(r)]
    return removed, counters, people, configs


def public_report(data, removed, counters):
    return {
        "before": {s: {t: len(rows) for t, rows in ts.items()} for s, ts in data.items()},
        "delete": {s: {t: len(item["ids"]) for t, item in ts.items()} for s, ts in removed.items()},
        "queue_counters_to_delete": len(counters),
        "target": {"doctors": 33, "branches": 2, "receptionists": 2, "technicians": 2,
                   "services": 65, "branch_services": 130, "schedule_start": "2026-11-11", "schedule_end": "2026-12-10"},
    }


async def delete_rows(cur, table, item):
    ids = item["ids"]
    total = 0
    for start in range(0, len(ids), 100):
        page = ids[start:start + 100]
        await cur.execute(f"DELETE FROM `{table}` WHERE `{item['key']}` IN ({','.join(['%s'] * len(page))})", tuple(page))
        total += cur.rowcount
    return total


async def apply_plan(data, removed, counters, people):
    # DDL is isolated from subsequent per-service transactions, so a retry can resume.
    db = await connect("laboratory")
    try:
        async with db.cursor() as cur:
            await cur.execute("SHOW COLUMNS FROM lab_orders LIKE 'technician_name_snapshot'")
            if await cur.fetchone() is None:
                await cur.execute("ALTER TABLE lab_orders ADD COLUMN technician_name_snapshot VARCHAR(160) NULL")
        await db.commit()
    finally:
        db.close()
    order = {
        "clinical": ("treatment_sessions", "treatment_plans", "encounters"),
        "laboratory": ("lab_orders",),
        "billing": ("legacy_lab_charges", "invoices"),
        "appointment": ("patient_notifications", "appointment_checkins", "appointments"),
        "scheduling": ("slot_holds", "slot_inventory", "doctor_schedules"),
        "identity": ("accounts",),
        "registry": ("branch_services", "medical_services", "staff_profiles", "branches"),
    }
    results = {}
    for service, tables in order.items():
        db = await connect(service)
        changed = {}
        try:
            async with db.cursor() as cur:
                if service == "laboratory":
                    for person in people.values():
                        if person["role"] == "xnv":
                            await cur.execute("UPDATE lab_orders SET technician_name_snapshot = %s "
                                              "WHERE technician_code = %s AND technician_name_snapshot IS NULL",
                                              (person["full_name"], person["staff_code"]))
                if service == "identity":
                    await cur.execute("DELETE FROM refresh_tokens")
                    changed["refresh_tokens_revoked"] = cur.rowcount
                if service == "appointment":
                    for row in counters:
                        await cur.execute("DELETE FROM appointment_queue_counters WHERE branch_code=%s AND doctor_code=%s AND duty_date=%s",
                                          (row["branch_code"], row["doctor_code"], row["duty_date"]))
                for table in tables:
                    changed[table] = await delete_rows(cur, table, removed[service][table])
                if service == "identity":
                    for account in data[service]["accounts"]:
                        if account["id"] in removed[service]["accounts"]["ids"]:
                            continue
                        await cur.execute("UPDATE accounts SET password_hash=%s, token_version=token_version+1, "
                                          "failed_attempts=0, locked_until=NULL WHERE id=%s",
                                          (hash_password("123456"), account["id"]))
                        if account["subject_id"] in STAFF and account["role"] in ("doctor", "letan", "xnv"):
                            await cur.execute("UPDATE accounts SET is_active=TRUE, registration_pending=FALSE WHERE id=%s", (account["id"],))
                    changed["passwords_reset"] = len(data[service]["accounts"]) - len(removed[service]["accounts"]["ids"])
                if service == "registry":
                    for table in ("branches", "medical_services", "branch_services"):
                        await cur.execute(f"UPDATE `{table}` SET active=TRUE")
                await cur.execute("SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='historical_records'")
                if await cur.fetchone():
                    await cur.execute("DELETE FROM historical_records WHERE source='frontend_fixture'")
                    changed["frontend_fixture_history_archived"] = cur.rowcount
            await db.commit()
        except Exception:
            await db.rollback()
            raise
        finally:
            db.close()
        results[service] = changed
        print(json.dumps({"checkpoint_committed": service, "changes": changed}), flush=True)
    return results


def verify_data(data):
    people = data["registry"]["staff_profiles"]
    assert {p["staff_code"] for p in people} == STAFF
    assert Counter(p["role"] for p in people) == {"doctor": 33, "letan": 2, "xnv": 2}
    for table, codes in (("branches", BRANCHES), ("medical_services", SERVICES)):
        rows = data["registry"][table]
        assert {r["code"] for r in rows} == codes and all(r["active"] for r in rows)
    assert len(data["registry"]["branch_services"]) == 130
    assert all(r["active"] for r in data["registry"]["branch_services"])
    accounts = data["identity"]["accounts"]
    assert Counter(a["role"] for a in accounts if a["role"] in ("doctor", "letan", "xnv")) == {"doctor": 33, "letan": 2, "xnv": 2}
    assert all(a["is_active"] and not a["registration_pending"] for a in accounts if a["role"] in ("doctor", "letan", "xnv"))
    assert all(verify_password("123456", a["password_hash"]) for a in accounts), "A password was not reset"
    removed, counters, _, _ = build_plan(data)
    assert not any(item["ids"] for tables in removed.values() for item in tables.values()) and not counters
    retired = [r for r in data["laboratory"]["lab_orders"] if r["technician_code"] in ("LEGACY_XNV002", "LEGACY_XNV004")]
    assert len(retired) == 3 and all(r.get("technician_name_snapshot") for r in retired)
    return {"passwords_verified": len(accounts), "all_staff_active": 37,
            "retired_technician_results_preserved": len(retired),
            "roles": dict(Counter(a["role"] for a in accounts)),
            "row_counts": {s: {t: len(rows) for t, rows in ts.items()} for s, ts in data.items()}}


def verify_backup(path):
    manifest = json.loads(path.read_text())
    archive = path.parent / manifest["file"]
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == manifest["sha256"], "Backup checksum mismatch"
    assert set(manifest["databases"]) == {f"{s}_db" for s in TABLES}, "Backup must cover all 7 databases"


async def main(args):
    data = await snapshot()
    if args.audit:
        report = {"status": "verified", **verify_data(data)}
    else:
        removed, counters, people, _ = build_plan(data)
        report = public_report(data, removed, counters)
        if args.apply:
            if os.getenv("RESTRUCTURE_APPLY") != "1" or not args.backup_manifest:
                raise RuntimeError("Apply requires RESTRUCTURE_APPLY=1 and --backup-manifest")
            verify_backup(args.backup_manifest)
            report["changes"] = await apply_plan(data, removed, counters, people)
            report["verification"] = verify_data(await snapshot())
            report["status"] = "applied"
        else:
            report["status"] = "preview"
    if args.output:
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str) + "\n")
    print(json.dumps(report, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--apply", action="store_true")
    action.add_argument("--audit", action="store_true")
    parser.add_argument("--backup-manifest", type=Path)
    parser.add_argument("--output", type=Path)
    asyncio.run(main(parser.parse_args()))
