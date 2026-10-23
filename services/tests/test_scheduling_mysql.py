"""Opt-in concurrency test against a disposable MySQL database only.

Run with SCHEDULING_TEST_MYSQL_PORT and SCHEDULING_TEST_MYSQL_PASSWORD set.
Never point this test at the normal scheduling_db.
"""

import asyncio
import os
from datetime import date, timedelta
from uuid import uuid4

import pytest

from common.database import MySQLDatabase
from scheduling.migrate import migrate
from scheduling.repository import ScheduleConflict, SchedulingRepository
from scheduling.slot_repository import HoldConflict, SlotRepository, SlotUnavailable
from scheduling.slots import HoldCreate


@pytest.mark.skipif(not os.getenv("SCHEDULING_TEST_MYSQL_PORT"),
                    reason="Disposable MySQL instance not configured")
def test_concurrent_holds_only_take_one_slot(monkeypatch):
    test_port = os.environ["SCHEDULING_TEST_MYSQL_PORT"]
    test_password = os.environ["SCHEDULING_TEST_MYSQL_PASSWORD"]
    monkeypatch.setenv("DB_HOST", "127.0.0.1")
    monkeypatch.setenv("DB_PORT", test_port)
    monkeypatch.setenv("DB_NAME", "scheduling_test_db")
    monkeypatch.setenv("DB_USER", "root")
    monkeypatch.setenv("DB_PASSWORD", test_password)

    async def run():
        await migrate()
        database = MySQLDatabase()
        store = SlotRepository(database)
        schedules = SchedulingRepository(database)
        suffix = uuid4().hex[:12].upper()
        config_code = f"TEST_{suffix}"
        doctor_code = f"BS_{suffix}"
        day = date.today() + timedelta(days=1)
        config = {"MaCauHinh": config_code, "MaChiNhanh": "TEST_BRANCH",
                  "MaDichVu": "TEST_SERVICE", "SlotGioiHan": 1, "TrangThai": "active"}
        try:
            pool = await database.pool()
            async with pool.acquire() as connection:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "INSERT INTO doctor_schedules "
                        "(doctor_code, branch_code, duty_date, shift) VALUES (%s, %s, %s, 1)",
                        (doctor_code, "TEST_BRANCH", day),
                    )
                    schedule_id = cursor.lastrowid
                await connection.commit()

            async def reserve(index):
                body = HoldCreate(config_code=config_code, doctor_code=doctor_code,
                                  date=day, shift=1, idempotency_key=f"request-{index:08d}")
                try:
                    return await store.create_hold(body, config, str(uuid4()), 600)
                except SlotUnavailable:
                    return None

            results = await asyncio.wait_for(
                asyncio.gather(*(reserve(index) for index in range(20))), timeout=15
            )
            winners = [row for row in results if row is not None]
            assert len(winners) == 1
            usage = await store.availability(config_code, "TEST_BRANCH", day, 1)
            assert usage["held"] == 1
            assert usage["confirmed"] == 0

            # Same patient/key across different inventory rows forces the unique-key
            # recovery path without exhausting the connection pool.
            other_days = [day + timedelta(days=index) for index in range(1, 11)]
            async with pool.acquire() as connection:
                async with connection.cursor() as cursor:
                    await cursor.executemany(
                        "INSERT INTO doctor_schedules "
                        "(doctor_code, branch_code, duty_date, shift) VALUES (%s, %s, %s, 1)",
                        [(doctor_code, "TEST_BRANCH", other_day) for other_day in other_days],
                    )
                await connection.commit()
            same_patient = str(uuid4())

            async def duplicate_request(other_day):
                body = HoldCreate(config_code=config_code, doctor_code=doctor_code,
                                  date=other_day, shift=1,
                                  idempotency_key="one-patient-one-key")
                try:
                    return await store.create_hold(body, config, same_patient, 600)
                except HoldConflict:
                    return None

            duplicate_results = await asyncio.wait_for(
                asyncio.gather(*(duplicate_request(other_day) for other_day in other_days)),
                timeout=15,
            )
            assert sum(row is not None for row in duplicate_results) == 1

            hold = winners[0]
            confirmed = await store.transition_hold(
                hold["id"], "confirm", appointment_id=f"AP_{suffix}"
            )
            assert confirmed["state"] == "confirmed"
            impact = await schedules.schedule_impact(schedule_id)
            assert impact["confirmed_appointments"] == 1
            assert impact["can_change"] is False
            assert (await schedules.list_schedules(day, day, doctor_code))[0]["confirmed_appointments"] == 1
            with pytest.raises(ScheduleConflict):
                await schedules.change_schedule(schedule_id)
            assert (await store.transition_hold(hold["id"], "release"))["state"] == "released"
            second = await reserve(21)
            assert second is not None
            async with pool.acquire() as connection:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "UPDATE slot_holds SET expires_at = "
                        "DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 1 SECOND) WHERE id = %s",
                        (second["id"],),
                    )
                await connection.commit()
            final_hold = await reserve(22)
            assert final_hold is not None
            usage = await store.availability(config_code, "TEST_BRANCH", day, 1)
            assert usage["held"] == 1
            assert usage["confirmed"] == 0
            assert (await schedules.schedule_impact(schedule_id))["active_holds"] == 1
            with pytest.raises(ScheduleConflict):
                await schedules.change_schedule(schedule_id)
            await store.transition_hold(final_hold["id"], "release")
            assert (await schedules.schedule_impact(schedule_id))["can_change"] is True
            assert (await schedules.change_schedule(schedule_id))["status"] == "cancelled"
        finally:
            await database.close()

    asyncio.run(run())
