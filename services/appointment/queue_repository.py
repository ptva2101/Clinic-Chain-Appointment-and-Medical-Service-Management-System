"""Transactional check-in and queue sequence owned by Appointment."""

from datetime import date

from common.database import MySQLDatabase


class QueueConflict(Exception):
    pass


class QueueNotFound(Exception):
    pass


ROW_COLUMNS = (
    "a.id, a.patient_id, a.config_code, a.branch_code, a.service_code, "
    "a.doctor_code, a.duty_date, a.shift, a.status, "
    "q.queue_number, q.receptionist_code, q.state AS queue_state, q.checked_in_at"
)


class QueueRepository:
    def __init__(self, database: MySQLDatabase) -> None:
        self.database = database

    async def get(self, appointment_id: str) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    f"SELECT {ROW_COLUMNS} FROM appointments a "
                    "LEFT JOIN appointment_checkins q ON q.appointment_id = a.id WHERE a.id = %s",
                    (appointment_id,),
                )
                row = await cursor.fetchone()
                await connection.rollback()
                return row

    async def list(self, *, branch_code: str | None = None, doctor_code: str | None = None,
                   duty_date: date | None = None, checked_in: bool | None = None,
                   keyword: str = "") -> list[dict]:
        where = []
        values = []
        for field, value in (("a.branch_code", branch_code), ("a.doctor_code", doctor_code),
                             ("a.duty_date", duty_date)):
            if value is not None:
                where.append(f"{field} = %s")
                values.append(value)
        if checked_in is True:
            where.append("q.appointment_id IS NOT NULL")
        elif checked_in is False:
            where.append("q.appointment_id IS NULL AND a.status = 'confirmed'")
        if keyword:
            where.append("(a.id = %s OR a.patient_id = %s)")
            values.extend((keyword, keyword))
        sql = (f"SELECT {ROW_COLUMNS} FROM appointments a "
               "LEFT JOIN appointment_checkins q ON q.appointment_id = a.id")
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY a.duty_date, a.shift, q.queue_number, a.created_at LIMIT 500"
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(sql, tuple(values))
                rows = await cursor.fetchall()
                await connection.rollback()
                return rows

    async def check_in(self, appointment_id: str, receptionist_code: str,
                       branch_code: str, today: date) -> dict:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "SELECT id, branch_code, doctor_code, duty_date, status "
                        "FROM appointments WHERE id = %s FOR UPDATE", (appointment_id,),
                    )
                    appointment = await cursor.fetchone()
                    if appointment is None:
                        raise QueueNotFound("Appointment not found")
                    if appointment["branch_code"] != branch_code:
                        raise QueueNotFound("Appointment not found in this branch")
                    if appointment["status"] != "confirmed" or appointment["duty_date"] != today:
                        raise QueueConflict("Only today's confirmed appointments can be checked in")
                    await cursor.execute(
                        "SELECT appointment_id FROM appointment_checkins WHERE appointment_id = %s",
                        (appointment_id,),
                    )
                    if await cursor.fetchone():
                        raise QueueConflict("Appointment has already been checked in")
                    key = (branch_code, appointment["doctor_code"], appointment["duty_date"])
                    await cursor.execute(
                        "INSERT IGNORE INTO appointment_queue_counters "
                        "(branch_code, doctor_code, duty_date, last_number) VALUES (%s, %s, %s, 0)", key,
                    )
                    await cursor.execute(
                        "SELECT last_number FROM appointment_queue_counters "
                        "WHERE branch_code = %s AND doctor_code = %s AND duty_date = %s FOR UPDATE", key,
                    )
                    number = (await cursor.fetchone())["last_number"] + 1
                    await cursor.execute(
                        "UPDATE appointment_queue_counters SET last_number = %s "
                        "WHERE branch_code = %s AND doctor_code = %s AND duty_date = %s",
                        (number, *key),
                    )
                    await cursor.execute(
                        "INSERT INTO appointment_checkins "
                        "(appointment_id, branch_code, doctor_code, duty_date, queue_number, receptionist_code) "
                        "VALUES (%s, %s, %s, %s, %s, %s)",
                        (appointment_id, *key, number, receptionist_code),
                    )
                    await cursor.execute(
                        f"SELECT {ROW_COLUMNS} FROM appointments a "
                        "JOIN appointment_checkins q ON q.appointment_id = a.id WHERE a.id = %s",
                        (appointment_id,),
                    )
                    row = await cursor.fetchone()
                await connection.commit()
                return row
            except Exception:
                await connection.rollback()
                raise

    async def move_state(self, appointment_id: str, doctor_code: str,
                         expected: tuple[str, ...], next_state: str) -> dict:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "SELECT q.state, a.status FROM appointment_checkins q "
                        "JOIN appointments a ON a.id = q.appointment_id "
                        "WHERE q.appointment_id = %s AND q.doctor_code = %s FOR UPDATE",
                        (appointment_id, doctor_code),
                    )
                    row = await cursor.fetchone()
                    if row is None:
                        raise QueueNotFound("Queue entry not found")
                    if row["status"] != "confirmed" or row["state"] not in expected:
                        raise QueueConflict("Invalid queue state transition")
                    await cursor.execute(
                        "UPDATE appointment_checkins SET state = %s WHERE appointment_id = %s",
                        (next_state, appointment_id),
                    )
                    await cursor.execute(
                        f"SELECT {ROW_COLUMNS} FROM appointments a JOIN appointment_checkins q "
                        "ON q.appointment_id = a.id WHERE a.id = %s", (appointment_id,),
                    )
                    updated = await cursor.fetchone()
                await connection.commit()
                return updated
            except Exception:
                await connection.rollback()
                raise
