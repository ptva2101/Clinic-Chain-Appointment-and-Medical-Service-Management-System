"""Create Registry-owned tables without touching other service databases."""

import asyncio
from pathlib import Path

from common.database import MySQLDatabase


async def migrate() -> None:
    database = MySQLDatabase()
    try:
        pool = await database.pool()
        schema = Path(__file__).with_name("schema.sql").read_text(encoding="utf-8")
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    for statement in schema.split(";"):
                        if statement.strip():
                            await cursor.execute(statement)
                    for table in ("branches", "medical_services"):
                        await cursor.execute(f"SHOW COLUMNS FROM {table} LIKE 'active'")
                        if await cursor.fetchone() is None:
                            await cursor.execute(
                                f"ALTER TABLE {table} ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE"
                            )
                    await cursor.execute("SHOW COLUMNS FROM staff_profiles LIKE 'identity_account_id'")
                    identity_column = await cursor.fetchone()
                    if identity_column["Null"] == "NO":
                        await cursor.execute(
                            "ALTER TABLE staff_profiles MODIFY identity_account_id CHAR(36) NULL"
                        )
                    await cursor.execute("SHOW COLUMNS FROM staff_profiles LIKE 'source'")
                    if await cursor.fetchone() is None:
                        await cursor.execute(
                            "ALTER TABLE staff_profiles ADD COLUMN source VARCHAR(32) "
                            "NOT NULL DEFAULT 'identity'"
                        )
                await connection.commit()
            except Exception:
                await connection.rollback()
                raise
    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(migrate())
