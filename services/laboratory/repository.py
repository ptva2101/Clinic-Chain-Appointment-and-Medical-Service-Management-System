"""Idempotent lab orders and technician state transitions."""

from __future__ import annotations

from uuid import uuid4

from common.database import MySQLDatabase


COLUMNS = (
    "id, encounter_id, appointment_id, patient_id, branch_code, doctor_code, "
    "service_code, list_price, status, payment_method, payment_token, "
    "technician_code, result_text, notes, created_at, updated_at"
)


class LabConflict(Exception):
    pass


class LabRepository:
    def __init__(self, database: MySQLDatabase) -> None:
        self.database = database

    async def get(self, order_id: str) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(f"SELECT {COLUMNS} FROM lab_orders WHERE id = %s", (order_id,))
                row = await cursor.fetchone()
                await connection.rollback()
                return row

    async def list(self, *, branch_code: str | None = None, patient_id: str | None = None,
                   encounter_id: str | None = None, doctor_code: str | None = None) -> list[dict]:
        where, values = [], []
        for key, value in (("branch_code", branch_code), ("patient_id", patient_id),
                           ("encounter_id", encounter_id), ("doctor_code", doctor_code)):
            if value is not None:
                where.append(f"{key} = %s")
                values.append(value)
        sql = f"SELECT {COLUMNS} FROM lab_orders"
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY created_at DESC, id DESC LIMIT 500"
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(sql, tuple(values))
                rows = await cursor.fetchall()
                await connection.rollback()
                return rows

    async def ensure_orders(self, details: dict, services: list[dict]) -> list[dict]:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    for service in services:
                        await cursor.execute(
                            "INSERT IGNORE INTO lab_orders "
                            "(id, encounter_id, appointment_id, patient_id, branch_code, doctor_code, "
                            "service_code, list_price) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                            (str(uuid4()), details["encounter_id"], details["appointment_id"],
                             details["patient_id"], details["branch_code"], details["doctor_code"],
                             service["service_code"], service["list_price"]),
                        )
                    await cursor.execute(
                        f"SELECT {COLUMNS} FROM lab_orders WHERE encounter_id = %s",
                        (details["encounter_id"],),
                    )
                    rows = await cursor.fetchall()
                    for row in rows:
                        if (row["appointment_id"] != details["appointment_id"]
                                or row["patient_id"] != details["patient_id"]
                                or row["branch_code"] != details["branch_code"]
                                or row["doctor_code"] != details["doctor_code"]):
                            raise LabConflict("Existing lab order identity mismatch")
                await connection.commit()
                return rows
            except Exception:
                await connection.rollback()
                raise

    async def accept(self, order_id: str, branch_code: str, technician_code: str) -> dict | None:
        return await self._transition(order_id, branch_code, technician_code, "pending", "accepted")

    async def result(self, order_id: str, branch_code: str, technician_code: str,
                     result_text: str, notes: str | None) -> dict | None:
        return await self._transition(order_id, branch_code, technician_code, "accepted", "resulted",
                                      result_text, notes)

    async def _transition(self, order_id: str, branch_code: str, technician_code: str,
                          expected: str, next_status: str, result_text: str | None = None,
                          notes: str | None = None) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        f"SELECT {COLUMNS} FROM lab_orders WHERE id = %s FOR UPDATE", (order_id,),
                    )
                    row = await cursor.fetchone()
                    if row is None or row["branch_code"] != branch_code:
                        await connection.rollback()
                        return None
                    if row["status"] != expected:
                        raise LabConflict("Invalid lab order state transition")
                    if expected == "accepted" and row["technician_code"] != technician_code:
                        raise LabConflict("Lab order belongs to another technician")
                    if next_status == "accepted":
                        await cursor.execute(
                            "UPDATE lab_orders SET status = 'accepted', technician_code = %s, "
                            "payment_method = 'simulated', payment_token = %s WHERE id = %s",
                            (technician_code, f"SIM_LAB_{uuid4().hex.upper()}", order_id),
                        )
                    else:
                        await cursor.execute(
                            "UPDATE lab_orders SET status = 'resulted', result_text = %s, notes = %s "
                            "WHERE id = %s", (result_text, notes, order_id),
                        )
                    await cursor.execute(f"SELECT {COLUMNS} FROM lab_orders WHERE id = %s", (order_id,))
                    updated = await cursor.fetchone()
                await connection.commit()
                return updated
            except Exception:
                await connection.rollback()
                raise
