"""Create Appointment-owned tables without touching other service databases."""

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
                    await cursor.execute(
                        "SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS "
                        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appointments' "
                        "AND INDEX_NAME = 'ix_appointment_reconcile' LIMIT 1"
                    )
                    if await cursor.fetchone() is None:
                        await cursor.execute(
                            "ALTER TABLE appointments ADD INDEX ix_appointment_reconcile "
                            "(status, updated_at, id)"
                        )
                await connection.commit()
            except Exception:
                await connection.rollback()
                raise
    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(migrate())
