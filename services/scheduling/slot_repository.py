"""Transactional slot reservations owned solely by Scheduling."""

import asyncio
from datetime import date
from uuid import uuid4

import aiomysql

from common.database import MySQLDatabase


class SlotUnavailable(Exception):
    pass


class HoldConflict(Exception):
    pass


class HoldNotFound(Exception):
    pass


HOLD_COLUMNS = (
    "id, patient_id, request_key, config_code, branch_code, service_code, "
    "doctor_code, duty_date, shift, state, expires_at, appointment_id"
)


class SlotRepository:
    def __init__(self, database: MySQLDatabase) -> None:
        self.database = database

    async def availability(self, config_code: str, branch_code: str,
                           duty_date: date, shift: int) -> dict:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    "SELECT doctor_code FROM doctor_schedules "
                    "WHERE branch_code = %s AND duty_date = %s AND shift = %s "
                    "AND status = 'active' ORDER BY doctor_code",
                    (branch_code, duty_date, shift),
                )
                doctors = [row["doctor_code"] for row in await cursor.fetchall()]
                await cursor.execute(
                    "SELECT COALESCE(SUM(state = 'confirmed'), 0) AS confirmed, "
                    "COALESCE(SUM(state = 'held' AND expires_at > UTC_TIMESTAMP(6)), 0) AS held "
                    "FROM slot_holds WHERE config_code = %s AND duty_date = %s AND shift = %s",
                    (config_code, duty_date, shift),
                )
                usage = await cursor.fetchone()
                await connection.rollback()
                return {
                    "doctors": doctors,
                    "confirmed": int(usage["confirmed"]),
                    "held": int(usage["held"]),
                }

    async def _lock_slot(self, cursor, config_code: str, duty_date: date,
                         shift: int) -> int:
        await cursor.execute(
            "INSERT INTO slot_inventory (config_code, duty_date, shift) "
            "VALUES (%s, %s, %s) ON DUPLICATE KEY UPDATE used_count = used_count",
            (config_code, duty_date, shift),
        )
        await cursor.execute(
            "SELECT used_count FROM slot_inventory "
            "WHERE config_code = %s AND duty_date = %s AND shift = %s FOR UPDATE",
            (config_code, duty_date, shift),
        )
        used_count = int((await cursor.fetchone())["used_count"])
        await cursor.execute(
            "UPDATE slot_holds SET state = 'expired' "
            "WHERE config_code = %s AND duty_date = %s AND shift = %s "
            "AND state = 'held' AND expires_at <= UTC_TIMESTAMP(6)",
            (config_code, duty_date, shift),
        )
        expired_count = cursor.rowcount
        if expired_count:
            if expired_count > used_count:
                raise RuntimeError("Slot inventory count is inconsistent")
            await cursor.execute(
                "UPDATE slot_inventory SET used_count = used_count - %s "
                "WHERE config_code = %s AND duty_date = %s AND shift = %s",
                (expired_count, config_code, duty_date, shift),
            )
        return used_count - expired_count

    async def get_hold(self, hold_id: str, patient_id: str | None = None) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                sql = (
                    f"SELECT {HOLD_COLUMNS} FROM slot_holds WHERE id = %s"
                )
                params = (hold_id,)
                if patient_id is not None:
                    sql += " AND patient_id = %s"
                    params += (patient_id,)
                await cursor.execute(sql, params)
                row = await cursor.fetchone()
                await connection.rollback()
                return row

    async def _by_request(self, patient_id: str, request_key: str) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    f"SELECT {HOLD_COLUMNS} FROM slot_holds "
                    "WHERE patient_id = %s AND request_key = %s",
                    (patient_id, request_key),
                )
                row = await cursor.fetchone()
                await connection.rollback()
                return row

    @staticmethod
    def _matches_request(row: dict, body, patient_id: str) -> bool:
        return (row["patient_id"] == patient_id
                and row["config_code"] == body.config_code
                and row["doctor_code"] == body.doctor_code
                and row["duty_date"] == body.date
                and row["shift"] == body.shift)

    async def create_hold(self, body, config: dict, patient_id: str,
                          ttl_seconds: int) -> dict:
        for attempt in range(3):
            try:
                return await self._create_hold_once(body, config, patient_id, ttl_seconds)
            except aiomysql.OperationalError as exc:
                if not exc.args or exc.args[0] not in (1205, 1213):
                    raise
                existing = await self._by_request(patient_id, body.idempotency_key)
                if existing:
                    if (self._matches_request(existing, body, patient_id)
                            and existing["state"] in ("held", "confirmed")):
                        return existing
                    raise HoldConflict("Idempotency key belongs to another request") from exc
                if attempt == 2:
                    raise SlotUnavailable("Slot is busy; retry the reservation") from exc
                await asyncio.sleep(0.02 * (attempt + 1))
        raise AssertionError("Unreachable hold retry state")

    async def _create_hold_once(self, body, config: dict, patient_id: str,
                                ttl_seconds: int) -> dict:
        pool = await self.database.pool()
        duplicate = None
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    used = await self._lock_slot(cursor, body.config_code, body.date, body.shift)
                    await cursor.execute(
                        f"SELECT {HOLD_COLUMNS} FROM slot_holds "
                        "WHERE patient_id = %s AND request_key = %s",
                        (patient_id, body.idempotency_key),
                    )
                    existing = await cursor.fetchone()
                    if existing:
                        if not self._matches_request(existing, body, patient_id):
                            raise HoldConflict("Idempotency key belongs to another request")
                        if existing["state"] in ("expired", "released"):
                            raise HoldConflict("Hold is no longer active; use a new idempotency key")
                        await connection.rollback()
                        return existing
                    if config["TrangThai"] != "active" or int(config["SlotGioiHan"]) <= used:
                        raise SlotUnavailable("No available slot for this service and shift")
                    await cursor.execute(
                        "SELECT 1 FROM doctor_schedules "
                        "WHERE doctor_code = %s AND branch_code = %s AND duty_date = %s "
                        "AND shift = %s AND status = 'active' LIMIT 1",
                        (body.doctor_code, config["MaChiNhanh"], body.date, body.shift),
                    )
                    if await cursor.fetchone() is None:
                        raise SlotUnavailable("Doctor is not scheduled for this branch and shift")
                    hold_id = str(uuid4())
                    await cursor.execute(
                        "INSERT INTO slot_holds "
                        "(id, patient_id, request_key, config_code, branch_code, service_code, "
                        "doctor_code, duty_date, shift, expires_at) "
                        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, "
                        "DATE_ADD(UTC_TIMESTAMP(6), INTERVAL %s SECOND))",
                        (hold_id, patient_id, body.idempotency_key, body.config_code,
                         config["MaChiNhanh"], config["MaDichVu"], body.doctor_code,
                         body.date, body.shift, ttl_seconds),
                    )
                    await cursor.execute(
                        "UPDATE slot_inventory SET used_count = used_count + 1 "
                        "WHERE config_code = %s AND duty_date = %s AND shift = %s",
                        (body.config_code, body.date, body.shift),
                    )
                    await cursor.execute(
                        f"SELECT {HOLD_COLUMNS} FROM slot_holds WHERE id = %s", (hold_id,)
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
        existing = await self._by_request(patient_id, body.idempotency_key)
        if (existing and self._matches_request(existing, body, patient_id)
                and existing["state"] in ("held", "confirmed")):
            return existing
        raise HoldConflict("Hold already exists or conflicts with another request") from duplicate

    async def transition_hold(self, hold_id: str, action: str,
                              patient_id: str | None = None,
                              appointment_id: str | None = None) -> dict:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        f"SELECT {HOLD_COLUMNS} FROM slot_holds WHERE id = %s", (hold_id,)
                    )
                    initial = await cursor.fetchone()
                    if initial is None or (patient_id is not None
                                           and initial["patient_id"] != patient_id):
                        raise HoldNotFound("Hold not found")
                    key = (initial["config_code"], initial["duty_date"], initial["shift"])
                    used = await self._lock_slot(cursor, *key)
                    await cursor.execute(
                        f"SELECT {HOLD_COLUMNS} FROM slot_holds WHERE id = %s FOR UPDATE",
                        (hold_id,),
                    )
                    row = await cursor.fetchone()
                    if action == "confirm":
                        if row["state"] == "confirmed":
                            if row["appointment_id"] != appointment_id:
                                raise HoldConflict("Hold belongs to another appointment")
                        elif row["state"] == "held":
                            await cursor.execute(
                                "UPDATE slot_holds SET state = 'confirmed', appointment_id = %s "
                                "WHERE id = %s", (appointment_id, hold_id),
                            )
                        else:
                            raise HoldConflict("Hold has expired or was released")
                    elif action == "release":
                        if row["state"] == "confirmed" and patient_id is not None:
                            raise HoldConflict("Confirmed hold must be released by Appointment")
                        if row["state"] in ("held", "confirmed"):
                            if used < 1:
                                raise RuntimeError("Slot inventory count is inconsistent")
                            await cursor.execute(
                                "UPDATE slot_holds SET state = 'released' WHERE id = %s",
                                (hold_id,),
                            )
                            await cursor.execute(
                                "UPDATE slot_inventory SET used_count = used_count - 1 "
                                "WHERE config_code = %s AND duty_date = %s AND shift = %s",
                                key,
                            )
                    else:
                        raise ValueError("Unsupported hold transition")
                    await cursor.execute(
                        f"SELECT {HOLD_COLUMNS} FROM slot_holds WHERE id = %s", (hold_id,)
                    )
                    updated = await cursor.fetchone()
                await connection.commit()
                return updated
            except aiomysql.IntegrityError as exc:
                await connection.rollback()
                raise HoldConflict("Appointment identifier is already assigned") from exc
            except Exception:
                await connection.rollback()
                raise
