"""Create Laboratory-owned tables."""

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
                async with connection.cursor() as cursor:
                    await cursor.execute("SHOW COLUMNS FROM lab_orders LIKE 'technician_name_snapshot'")
                    if await cursor.fetchone() is None:
                        await cursor.execute(
                            "ALTER TABLE lab_orders ADD COLUMN technician_name_snapshot VARCHAR(160) NULL"
                        )
                await connection.commit()
            except Exception:
                await connection.rollback()
                raise
    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(migrate())
