"""Create Scheduling-owned tables without modifying another service database."""

import asyncio
from pathlib import Path

from common.database import MySQLDatabase


async def migrate() -> None:
    database = MySQLDatabase()
    try:
        pool = await database.pool()
        statements = Path(__file__).with_name("schema.sql").read_text(encoding="utf-8").split(";")
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    for statement in statements:
                        if statement.strip():
                            await cursor.execute(statement)
                    for name, declaration in (
                        ("source", "source VARCHAR(32) NOT NULL DEFAULT 'live'"),
                        ("legacy_source_id", "legacy_source_id VARCHAR(64) NULL"),
                        ("bookable_doctor_code",
                         "bookable_doctor_code VARCHAR(128) GENERATED ALWAYS AS "
                         "(CASE WHEN status = 'historical' THEN NULL ELSE doctor_code END) STORED"),
                    ):
                        await cursor.execute(f"SHOW COLUMNS FROM doctor_schedules LIKE '{name}'")
                        if await cursor.fetchone() is None:
                            await cursor.execute(f"ALTER TABLE doctor_schedules ADD COLUMN {declaration}")
                    for index_name, definition in (
                        ("uq_bookable_doctor_date_shift",
                         "UNIQUE KEY uq_bookable_doctor_date_shift "
                         "(bookable_doctor_code, duty_date, shift)"),
                        ("uq_schedule_legacy_source",
                         "UNIQUE KEY uq_schedule_legacy_source (legacy_source_id)"),
                    ):
                        await cursor.execute(
                            "SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() "
                            "AND TABLE_NAME = 'doctor_schedules' AND INDEX_NAME = %s LIMIT 1",
                            (index_name,),
                        )
                        if await cursor.fetchone() is None:
                            await cursor.execute(f"ALTER TABLE doctor_schedules ADD {definition}")
                    await cursor.execute(
                        "SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() "
                        "AND TABLE_NAME = 'doctor_schedules' AND INDEX_NAME = 'uq_doctor_date_shift' LIMIT 1"
                    )
                    if await cursor.fetchone() is not None:
                        await cursor.execute("ALTER TABLE doctor_schedules DROP INDEX uq_doctor_date_shift")
                    await cursor.execute(
                        "UPDATE doctor_schedules SET source = 'legacy_mysql' "
                        "WHERE status = 'historical' AND source = 'live' "
                        "AND LEFT(doctor_code, 7) = 'LEGACY_' "
                        "AND duty_date BETWEEN '2026-06-04' AND '2026-06-30'"
                    )
                    await cursor.execute(
                        "SELECT CHARACTER_MAXIMUM_LENGTH AS max_length "
                        "FROM INFORMATION_SCHEMA.COLUMNS "
                        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'slot_holds' "
                        "AND COLUMN_NAME = 'patient_id'"
                    )
                    patient_column = await cursor.fetchone()
                    if patient_column and patient_column["max_length"] < 128:
                        await cursor.execute(
                            "ALTER TABLE slot_holds MODIFY COLUMN patient_id VARCHAR(128) NOT NULL"
                        )
                    await cursor.execute(
                        "SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS "
                        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'slot_holds' "
                        "AND INDEX_NAME = 'ix_hold_schedule_state' LIMIT 1"
                    )
                    if await cursor.fetchone() is None:
                        await cursor.execute(
                            "ALTER TABLE slot_holds ADD INDEX ix_hold_schedule_state "
                            "(doctor_code, branch_code, duty_date, shift, state, expires_at)"
                        )
                await connection.commit()
            except Exception:
                await connection.rollback()
                raise
    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(migrate())
