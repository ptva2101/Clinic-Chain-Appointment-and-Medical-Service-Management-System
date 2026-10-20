"""Clinical-owned encounters, prescription snapshots and treatment plans."""

from __future__ import annotations

import json
from uuid import uuid4

from common.database import MySQLDatabase


COLUMNS = ("id, appointment_id, patient_id, doctor_code, branch_code, visit_date, status, "
           "disease_code, symptoms, advice, lab_service_codes, prescriptions, treatments, "
           "created_at, updated_at")


class EncounterConflict(Exception):
    pass


def decode(row: dict | None) -> dict | None:
    if row is None:
        return None
    return {**row, **{key: json.loads(row[key]) if isinstance(row[key], str) else row[key]
                    for key in ("lab_service_codes", "prescriptions", "treatments")}}


class ClinicalRepository:
    def __init__(self, database: MySQLDatabase) -> None:
        self.database = database

    async def list_diseases(self) -> list[dict]:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute("SELECT code, name FROM disease_catalog WHERE active = TRUE ORDER BY code")
                rows = await cursor.fetchall()
                await connection.rollback()
                return rows

    async def list_medicines(self) -> list[dict]:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute("SELECT code, name, unit FROM medicine_catalog WHERE active = TRUE ORDER BY name")
                rows = await cursor.fetchall()
                await connection.rollback()
                return rows

    async def upsert_disease(self, code: str, name: str, active: bool) -> dict:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "INSERT INTO disease_catalog (code, name, active) VALUES (%s, %s, %s) "
                        "ON DUPLICATE KEY UPDATE name = VALUES(name), active = VALUES(active)",
                        (code, name, active),
                    )
                await connection.commit()
                return {"code": code, "name": name, "active": active}
            except Exception:
                await connection.rollback()
                raise

    async def upsert_medicine(self, code: str, name: str, unit: str, active: bool) -> dict:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "INSERT INTO medicine_catalog (code, name, unit, active) VALUES (%s, %s, %s, %s) "
                        "ON DUPLICATE KEY UPDATE name = VALUES(name), unit = VALUES(unit), active = VALUES(active)",
                        (code, name, unit, active),
                    )
                await connection.commit()
                return {"code": code, "name": name, "unit": unit, "active": active}
            except Exception:
                await connection.rollback()
                raise

    async def validate_catalog(self, disease_code: str | None, medicine_codes: list[str]) -> bool:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                if disease_code:
                    await cursor.execute(
                        "SELECT 1 FROM disease_catalog WHERE code = %s AND active = TRUE", (disease_code,),
                    )
                    if await cursor.fetchone() is None:
                        await connection.rollback()
                        return False
                if medicine_codes:
                    placeholders = ",".join(["%s"] * len(set(medicine_codes)))
                    await cursor.execute(
                        "SELECT COUNT(*) AS total FROM medicine_catalog WHERE active = TRUE "
                        f"AND code IN ({placeholders})", tuple(set(medicine_codes)),
                    )
                    if (await cursor.fetchone())["total"] != len(set(medicine_codes)):
                        await connection.rollback()
                        return False
                await connection.rollback()
                return True

    async def get(self, encounter_id: str) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(f"SELECT {COLUMNS} FROM encounters WHERE id = %s", (encounter_id,))
                row = await cursor.fetchone()
                await connection.rollback()
                return decode(row)

    async def by_appointment(self, appointment_id: str) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(f"SELECT {COLUMNS} FROM encounters WHERE appointment_id = %s",
                                     (appointment_id,))
                row = await cursor.fetchone()
                await connection.rollback()
                return decode(row)

    async def list(self, *, patient_id: str | None = None, doctor_code: str | None = None,
                   completed_only: bool = False) -> list[dict]:
        where, values = [], []
        for key, value in (("patient_id", patient_id), ("doctor_code", doctor_code)):
            if value is not None:
                where.append(f"{key} = %s")
                values.append(value)
        if completed_only:
            where.append("status = 'completed'")
        sql = f"SELECT {COLUMNS} FROM encounters"
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY visit_date DESC, created_at DESC LIMIT 500"
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(sql, tuple(values))
                rows = await cursor.fetchall()
                await connection.rollback()
                return [decode(row) for row in rows]

    async def upsert(self, appointment: dict, doctor_code: str, body: dict) -> dict:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        f"SELECT {COLUMNS} FROM encounters WHERE appointment_id = %s FOR UPDATE",
                        (appointment["id"],),
                    )
                    existing = await cursor.fetchone()
                    if existing and (existing["doctor_code"] != doctor_code
                                     or existing["patient_id"] != appointment["patient_id"]):
                        raise EncounterConflict("Encounter identity mismatch")
                    if existing and existing["status"] == "completed":
                        previous = decode(existing)
                        comparable = ("status", "disease_code", "symptoms", "advice",
                                      "lab_service_codes", "prescriptions", "treatments")
                        if any(previous[key] != body[key] for key in comparable):
                            raise EncounterConflict("Completed encounter is immutable")
                        await connection.rollback()
                        return previous
                    values = (body["disease_code"], body["symptoms"], body["advice"],
                              json.dumps(body["lab_service_codes"]),
                              json.dumps(body["prescriptions"], ensure_ascii=False),
                              json.dumps(body["treatments"], ensure_ascii=False))
                    if existing:
                        await cursor.execute(
                            "UPDATE encounters SET status = %s, disease_code = %s, symptoms = %s, "
                            "advice = %s, lab_service_codes = %s, prescriptions = %s, treatments = %s "
                            "WHERE id = %s",
                            (body["status"], *values, existing["id"]),
                        )
                        encounter_id = existing["id"]
                    else:
                        encounter_id = str(uuid4())
                        await cursor.execute(
                            "INSERT INTO encounters (id, appointment_id, patient_id, doctor_code, branch_code, "
                            "visit_date, status, disease_code, symptoms, advice, lab_service_codes, "
                            "prescriptions, treatments) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                            (encounter_id, appointment["id"], appointment["patient_id"], doctor_code,
                             appointment["branch_code"], appointment["date"], body["status"], *values),
                        )
                    await cursor.execute(f"SELECT {COLUMNS} FROM encounters WHERE id = %s", (encounter_id,))
                    row = await cursor.fetchone()
                    if body["status"] == "completed":
                        for treatment in body["treatments"]:
                            await cursor.execute(
                                "INSERT IGNORE INTO treatment_plans "
                                "(id, encounter_id, patient_id, doctor_code, service_code, total_sessions) "
                                "VALUES (%s, %s, %s, %s, %s, %s)",
                                (str(uuid4()), encounter_id, appointment["patient_id"], doctor_code,
                                 treatment["service_code"], treatment["sessions"]),
                            )
                            await cursor.execute(
                                "SELECT total_sessions FROM treatment_plans WHERE encounter_id = %s AND service_code = %s",
                                (encounter_id, treatment["service_code"]),
                            )
                            plan = await cursor.fetchone()
                            if plan["total_sessions"] != treatment["sessions"]:
                                raise EncounterConflict("Existing treatment plan has different session count")
                await connection.commit()
                return decode(row)
            except Exception:
                await connection.rollback()
                raise

    async def list_plans(self, patient_id: str) -> list[dict]:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    "SELECT p.id, p.encounter_id, p.patient_id, p.doctor_code, p.service_code, "
                    "p.total_sessions, p.created_at, COUNT(s.id) AS scheduled_sessions, "
                    "SUM(CASE WHEN s.status = 'completed' THEN 1 ELSE 0 END) AS completed_sessions "
                    "FROM treatment_plans p LEFT JOIN treatment_sessions s ON s.plan_id = p.id "
                    "WHERE p.patient_id = %s GROUP BY p.id ORDER BY p.created_at DESC LIMIT 500",
                    (patient_id,),
                )
                rows = await cursor.fetchall()
                await connection.rollback()
                return rows

    async def get_plan(self, plan_id: str) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    "SELECT id, encounter_id, patient_id, doctor_code, service_code, total_sessions, created_at "
                    "FROM treatment_plans WHERE id = %s", (plan_id,),
                )
                row = await cursor.fetchone()
                await connection.rollback()
                return row

    async def list_sessions(self, plan_id: str) -> list[dict]:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    "SELECT id, plan_id, session_number, config_code, doctor_code, duty_date, shift, "
                    "appointment_id, invoice_id, status, created_at, updated_at "
                    "FROM treatment_sessions WHERE plan_id = %s ORDER BY session_number", (plan_id,),
                )
                rows = await cursor.fetchall()
                await connection.rollback()
                return rows

    async def get_session(self, session_id: str) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    "SELECT id, plan_id, session_number, config_code, doctor_code, duty_date, shift, "
                    "appointment_id, invoice_id, status, created_at, updated_at "
                    "FROM treatment_sessions WHERE id = %s", (session_id,),
                )
                row = await cursor.fetchone()
                await connection.rollback()
                return row

    async def reserve_session(self, plan: dict, request: dict) -> dict:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute("SELECT id, total_sessions FROM treatment_plans WHERE id = %s FOR UPDATE",
                                         (plan["id"],))
                    locked = await cursor.fetchone()
                    if locked is None:
                        raise EncounterConflict("Treatment plan is unavailable")
                    await cursor.execute(
                        "SELECT id, plan_id, session_number, patient_request_key, config_code, doctor_code, "
                        "duty_date, shift, appointment_id, invoice_id, status FROM treatment_sessions "
                        "WHERE plan_id = %s AND session_number = %s",
                        (plan["id"], request["session_number"]),
                    )
                    row = await cursor.fetchone()
                    if row:
                        if row["patient_request_key"] != request["idempotency_key"]:
                            raise EncounterConflict("Treatment session has already been booked")
                        for column, key in (("config_code", "config_code"), ("doctor_code", "doctor_code"),
                                            ("duty_date", "date"), ("shift", "shift")):
                            if str(row[column]) != str(request[key]):
                                raise EncounterConflict("Idempotency key was used for another session request")
                    else:
                        if request["session_number"] > locked["total_sessions"]:
                            raise EncounterConflict("Session number exceeds the treatment plan")
                        session_id = str(uuid4())
                        await cursor.execute(
                            "INSERT INTO treatment_sessions "
                            "(id, plan_id, session_number, patient_request_key, config_code, doctor_code, duty_date, shift) "
                            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                            (session_id, plan["id"], request["session_number"], request["idempotency_key"],
                             request["config_code"], request["doctor_code"], request["date"], request["shift"]),
                        )
                        await cursor.execute(
                            "SELECT id, plan_id, session_number, patient_request_key, config_code, doctor_code, "
                            "duty_date, shift, appointment_id, invoice_id, status FROM treatment_sessions WHERE id = %s",
                            (session_id,),
                        )
                        row = await cursor.fetchone()
                await connection.commit()
                return row
            except Exception:
                await connection.rollback()
                raise

    async def release_rejected_session(self, session_id: str, request_key: str) -> None:
        """Release only an unbooked reservation after Appointment definitively rejects it."""
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "DELETE FROM treatment_sessions WHERE id = %s AND patient_request_key = %s "
                        "AND status = 'pending' AND appointment_id IS NULL AND invoice_id IS NULL",
                        (session_id, request_key),
                    )
                await connection.commit()
            except Exception:
                await connection.rollback()
                raise

    async def attach_session(self, session_id: str, appointment_id: str, invoice_id: str) -> dict:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "SELECT id, appointment_id, invoice_id FROM treatment_sessions WHERE id = %s FOR UPDATE",
                        (session_id,),
                    )
                    current = await cursor.fetchone()
                    if current is None or current["appointment_id"] not in (None, appointment_id):
                        raise EncounterConflict("Treatment session appointment mismatch")
                    await cursor.execute(
                        "UPDATE treatment_sessions SET appointment_id = %s, invoice_id = %s, status = 'booked' "
                        "WHERE id = %s", (appointment_id, invoice_id, session_id),
                    )
                    await cursor.execute(
                        "SELECT id, plan_id, session_number, config_code, doctor_code, duty_date, shift, "
                        "appointment_id, invoice_id, status, created_at, updated_at "
                        "FROM treatment_sessions WHERE id = %s", (session_id,),
                    )
                    row = await cursor.fetchone()
                await connection.commit()
                return row
            except Exception:
                await connection.rollback()
                raise

    async def session_by_appointment(self, appointment_id: str) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    "SELECT s.id, s.plan_id, s.session_number, s.config_code, s.doctor_code, "
                    "s.duty_date, s.shift, s.appointment_id, s.invoice_id, s.status, "
                    "s.created_at, s.updated_at, p.patient_id, p.service_code "
                    "FROM treatment_sessions s JOIN treatment_plans p ON p.id = s.plan_id "
                    "WHERE s.appointment_id = %s", (appointment_id,),
                )
                row = await cursor.fetchone()
                await connection.rollback()
                return row

    async def complete_session(self, appointment_id: str, doctor_code: str) -> dict:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "SELECT id, doctor_code, status FROM treatment_sessions "
                        "WHERE appointment_id = %s FOR UPDATE", (appointment_id,),
                    )
                    current = await cursor.fetchone()
                    if current is None or current["doctor_code"] != doctor_code:
                        raise EncounterConflict("Treatment session not found for this doctor")
                    if current["status"] not in ("booked", "completed"):
                        raise EncounterConflict("Treatment session is not booked")
                    if current["status"] == "booked":
                        await cursor.execute(
                            "UPDATE treatment_sessions SET status = 'completed' WHERE id = %s",
                            (current["id"],),
                        )
                    await cursor.execute(
                        "SELECT id, plan_id, session_number, config_code, doctor_code, duty_date, shift, "
                        "appointment_id, invoice_id, status, created_at, updated_at "
                        "FROM treatment_sessions WHERE id = %s", (current["id"],),
                    )
                    row = await cursor.fetchone()
                await connection.commit()
                return row
            except Exception:
                await connection.rollback()
                raise
