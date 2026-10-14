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
                await connection.commit()
            except Exception:
                await connection.rollback()
                raise
    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(migrate())
