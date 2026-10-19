"""Appointment-owned persistence and local saga state transitions."""

from __future__ import annotations

from datetime import date
from uuid import uuid4

import aiomysql

from common.database import MySQLDatabase


class AppointmentConflict(Exception):
    pass


class AppointmentNotFound(Exception):
    pass


COLUMNS = (
    "id, hold_id, patient_account_id, patient_id, config_code, branch_code, "
    "service_code, doctor_code, duty_date, shift, status, source, legacy_status, "
    "created_at, updated_at"
)


class AppointmentRepository:
    def __init__(self, database: MySQLDatabase) -> None:
        self.database = database

    async def get(self, appointment_id: str) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    f"SELECT {COLUMNS} FROM appointments WHERE id = %s", (appointment_id,)
                )
                row = await cursor.fetchone()
                await connection.rollback()
                return row

    async def by_hold(self, hold_id: str) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    f"SELECT {COLUMNS} FROM appointments WHERE hold_id = %s", (hold_id,)
                )
                row = await cursor.fetchone()
                await connection.rollback()
                return row

    async def list(self, patient_id: str | None = None, doctor_code: str | None = None,
                   from_date: date | None = None, to_date: date | None = None,
                   status: str | None = None) -> list[dict]:
        conditions = []
        params = []
        for column, value in (
            ("patient_id", patient_id), ("doctor_code", doctor_code),
            ("duty_date >=", from_date), ("duty_date <=", to_date), ("status", status),
        ):
            if value is not None:
                op = "" if column.endswith((">=", "<=")) else " ="
                conditions.append(f"{column}{op} %s")
                params.append(value)
        sql = f"SELECT {COLUMNS} FROM appointments"
        if conditions:
            sql += " WHERE " + " AND ".join(conditions)
        sql += " ORDER BY duty_date DESC, shift DESC, created_at DESC LIMIT 500"
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(sql, tuple(params))
                rows = await cursor.fetchall()
                await connection.rollback()
                return rows

    async def list_notifications(self, account_id: str) -> list[dict]:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    "SELECT id, appointment_id, content, is_read, created_at "
                    "FROM patient_notifications WHERE patient_account_id = %s "
                    "ORDER BY created_at DESC, id DESC LIMIT 200",
                    (account_id,),
                )
                rows = await cursor.fetchall()
                await connection.rollback()
                return rows

    async def mark_notifications_read(self, account_id: str) -> int:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "UPDATE patient_notifications SET is_read = TRUE "
                        "WHERE patient_account_id = %s AND is_read = FALSE",
                        (account_id,),
                    )
                    changed = cursor.rowcount
                await connection.commit()
                return changed
            except Exception:
                await connection.rollback()
                raise

    async def reserve(self, hold: dict, account: dict) -> dict:
        pool = await self.database.pool()
        appointment_id = str(uuid4())
        duplicate = None
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "INSERT INTO appointments "
                        "(id, hold_id, patient_account_id, patient_id, config_code, branch_code, "
                        "service_code, doctor_code, duty_date, shift) "
                        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                        (appointment_id, hold["id"], account["id"], account["subject_id"],
                         hold["config_code"], hold["branch_code"], hold["service_code"],
                         hold["doctor_code"], hold["date"], hold["shift"]),
                    )
                    await cursor.execute(
                        f"SELECT {COLUMNS} FROM appointments WHERE id = %s", (appointment_id,)
                    )
                    row = await cursor.fetchone()
                await connection.commit()
                return row
            except aiomysql.IntegrityError as exc:
                await connection.rollback()
                duplicate = exc
            except Exception:
                await connection.rollback()
                raise
        existing = await self.by_hold(hold["id"])
        if existing and existing["patient_account_id"] == account["id"]:
            return existing
        raise AppointmentConflict("Hold is already linked to another appointment") from duplicate

    async def set_status(self, appointment_id: str, expected: tuple[str, ...],
                         next_status: str) -> dict:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        f"SELECT {COLUMNS} FROM appointments WHERE id = %s FOR UPDATE",
                        (appointment_id,),
                    )
                    row = await cursor.fetchone()
                    if row is None:
                        raise AppointmentNotFound("Appointment not found")
                    if row["status"] == next_status:
                        await connection.rollback()
                        return row
                    if row["status"] not in expected:
                        raise AppointmentConflict(f"Cannot move appointment from {row['status']} to {next_status}")
                    await cursor.execute(
                        "UPDATE appointments SET status = %s WHERE id = %s",
                        (next_status, appointment_id),
                    )
                    if next_status in ("confirmed", "cancelled") and row["patient_account_id"]:
                        content = (
                            "Lịch hẹn của bạn đã được xác nhận."
                            if next_status == "confirmed" else "Lịch hẹn của bạn đã được hủy."
                        )
                        await cursor.execute(
                            "INSERT INTO patient_notifications "
                            "(id, appointment_id, patient_account_id, patient_id, event, content) "
                            "VALUES (%s, %s, %s, %s, %s, %s)",
                            (str(uuid4()), appointment_id, row["patient_account_id"],
                             row["patient_id"], next_status, content),
                        )
                    await cursor.execute(
                        f"SELECT {COLUMNS} FROM appointments WHERE id = %s", (appointment_id,)
                    )
                    updated = await cursor.fetchone()
                await connection.commit()
                return updated
            except Exception:
                await connection.rollback()
                raise
