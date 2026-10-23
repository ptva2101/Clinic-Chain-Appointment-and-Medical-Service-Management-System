"""Opt-in Appointment persistence test against disposable MySQL only."""

import asyncio
import os
from datetime import date, timedelta
from uuid import uuid4

import pytest

from appointment.migrate import migrate
from appointment.repository import AppointmentConflict, AppointmentRepository
from common.database import MySQLDatabase


@pytest.mark.skipif(not os.getenv("APPOINTMENT_TEST_MYSQL_PORT"),
                    reason="Disposable MySQL instance not configured")
def test_reservation_is_unique_and_status_transitions_are_persistent(monkeypatch):
    monkeypatch.setenv("DB_HOST", "127.0.0.1")
    monkeypatch.setenv("DB_PORT", os.environ["APPOINTMENT_TEST_MYSQL_PORT"])
    monkeypatch.setenv("DB_NAME", "appointment_test_db")
    monkeypatch.setenv("DB_USER", "root")
    monkeypatch.setenv("DB_PASSWORD", os.environ["APPOINTMENT_TEST_MYSQL_PASSWORD"])

    async def run():
        await migrate()
        database = MySQLDatabase()
        repository = AppointmentRepository(database)
        hold = {"id": str(uuid4()), "config_code": "CH_TEST",
                "branch_code": "CN_TEST", "service_code": "DV_TEST",
                "doctor_code": "BS_TEST", "date": date.today() + timedelta(days=1),
                "shift": 1}
        account = {"id": str(uuid4()), "subject_id": str(uuid4())}
        try:
            rows = await asyncio.wait_for(
                asyncio.gather(*(repository.reserve(hold, account) for _ in range(10))),
                timeout=10,
            )
            assert len({row["id"] for row in rows}) == 1
            appointment_id = rows[0]["id"]
            assert (await repository.get(appointment_id))["status"] == "pending"
            assert appointment_id in {
                row["id"] for row in await repository.list_stale("", 0, 20)
            }
            assert (await repository.set_status(appointment_id, ("pending",), "confirmed"))[
                "status"] == "confirmed"
            assert (await repository.set_status(appointment_id, ("confirmed",), "cancel_pending"))[
                "status"] == "cancel_pending"
            assert (await repository.set_status(appointment_id, ("cancel_pending",), "cancelled"))[
                "status"] == "cancelled"
            assert len(await repository.list(patient_id=account["subject_id"],
                                             from_date=hold["date"], to_date=hold["date"],
                                             status="cancelled")) == 1
            with pytest.raises(AppointmentConflict):
                await repository.set_status(appointment_id, ("pending",), "confirmed")
            checked_in = await repository.reserve({**hold, "id": str(uuid4())}, account)
            await repository.set_status(checked_in["id"], ("pending",), "confirmed")
            pool = await database.pool()
            async with pool.acquire() as connection:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "INSERT INTO appointment_checkins "
                        "(appointment_id, branch_code, doctor_code, duty_date, queue_number, receptionist_code) "
                        "VALUES (%s, %s, %s, %s, 1, 'LT_TEST')",
                        (checked_in["id"], hold["branch_code"], hold["doctor_code"], hold["date"]),
                    )
                await connection.commit()
            with pytest.raises(AppointmentConflict, match="Checked-in"):
                await repository.set_status(checked_in["id"], ("confirmed",), "cancel_pending")
            assert (await repository.get(checked_in["id"]))["status"] == "confirmed"
        finally:
            await database.close()

    asyncio.run(run())
