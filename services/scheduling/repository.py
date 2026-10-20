"""Scheduling-owned persistence; no cross-database joins."""

from datetime import date

import aiomysql

from common.database import MySQLDatabase


class ScheduleConflict(Exception):
    pass


class SchedulingRepository:
    def __init__(self, database: MySQLDatabase) -> None:
        self.database = database

    async def get_schedule(self, schedule_id: int) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    "SELECT id, doctor_code, branch_code, duty_date, shift, status "
                    "FROM doctor_schedules WHERE id = %s", (schedule_id,),
                )
                row = await cursor.fetchone()
                await connection.rollback()
                return row

    async def change_schedule(self, schedule_id: int, new_doctor_code: str | None = None) -> dict:
        """Only unbooked shifts can change; a hold locks the schedule row first."""
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "SELECT id, doctor_code, branch_code, duty_date, shift, status "
                        "FROM doctor_schedules WHERE id = %s FOR UPDATE", (schedule_id,),
                    )
                    row = await cursor.fetchone()
                    if row is None:
                        raise ScheduleConflict("Doctor schedule not found")
                    if row["status"] != "active":
                        raise ScheduleConflict("Doctor schedule is not active")
                    await cursor.execute(
                        "SELECT 1 FROM slot_holds WHERE doctor_code = %s AND branch_code = %s "
                        "AND duty_date = %s AND shift = %s "
                        "AND (state = 'confirmed' OR state = 'held' AND expires_at > UTC_TIMESTAMP(6)) "
                        "LIMIT 1",
                        (row["doctor_code"], row["branch_code"], row["duty_date"], row["shift"]),
                    )
                    if await cursor.fetchone():
                        raise ScheduleConflict("Shift has active appointments or holds; refund/transfer workflow required")
                    if new_doctor_code is None:
                        await cursor.execute("UPDATE doctor_schedules SET status = 'cancelled' WHERE id = %s",
                                             (schedule_id,))
                    else:
                        if new_doctor_code == row["doctor_code"]:
                            raise ScheduleConflict("New doctor must be different")
                        await cursor.execute("UPDATE doctor_schedules SET doctor_code = %s WHERE id = %s",
                                             (new_doctor_code, schedule_id))
                    await cursor.execute(
                        "SELECT id, doctor_code, branch_code, duty_date, shift, status "
                        "FROM doctor_schedules WHERE id = %s", (schedule_id,),
                    )
                    updated = await cursor.fetchone()
                await connection.commit()
                return updated
            except aiomysql.IntegrityError as exc:
                await connection.rollback()
                raise ScheduleConflict("New doctor already has a shift at this time") from exc
            except Exception:
                await connection.rollback()
                raise

    async def list_schedules(self, from_date: date | None, to_date: date | None,
                             doctor_code: str | None) -> list[dict]:
        where = []
        params = []
        if from_date:
            where.append("duty_date >= %s")
            params.append(from_date)
        if to_date:
            where.append("duty_date <= %s")
            params.append(to_date)
        if doctor_code:
            where.append("doctor_code = %s")
            params.append(doctor_code)
        sql = ("SELECT id, doctor_code, branch_code, duty_date, shift, status "
               "FROM doctor_schedules")
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY duty_date, shift, branch_code, doctor_code"
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(sql, tuple(params))
                rows = await cursor.fetchall()
                await connection.rollback()
                return rows

    async def create_many(self, schedules: list) -> list[dict]:
        pool = await self.database.pool()
        created = []
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    for schedule in schedules:
                        await cursor.execute(
                            "INSERT INTO doctor_schedules (doctor_code, branch_code, duty_date, shift) "
                            "VALUES (%s, %s, %s, %s)",
                            (schedule.MaBacSi, schedule.MaChiNhanh,
                             schedule.NgayTruc, schedule.CaTruc),
                        )
                        created.append({
                            "id": cursor.lastrowid,
                            "doctor_code": schedule.MaBacSi,
                            "branch_code": schedule.MaChiNhanh,
                            "duty_date": schedule.NgayTruc,
                            "shift": schedule.CaTruc,
                            "status": "active",
                        })
                await connection.commit()
                return created
            except aiomysql.IntegrityError as exc:
                await connection.rollback()
                raise ScheduleConflict("Doctor already has a shift at this time") from exc
            except Exception:
                await connection.rollback()
                raise
