"""Create Billing-owned tables without touching another service's database."""

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
                    for column in (
                        "branch_code VARCHAR(32) NULL", "doctor_code VARCHAR(128) NULL",
                        "insurance_card_number VARCHAR(20) NULL",
                        "insurance_category_code VARCHAR(10) NULL",
                        "insurance_verified BOOLEAN NOT NULL DEFAULT FALSE",
                        "coverage_bps INT UNSIGNED NOT NULL DEFAULT 0",
                        "refunded_at DATETIME(6) NULL",
                        "source VARCHAR(32) NOT NULL DEFAULT 'live'",
                        "legacy_date DATE NULL",
                    ):
                        name = column.split()[0]
                        await cursor.execute(f"SHOW COLUMNS FROM invoices LIKE '{name}'")
                        if await cursor.fetchone() is None:
                            await cursor.execute(f"ALTER TABLE invoices ADD COLUMN {column}")
                await connection.commit()
            except Exception:
                await connection.rollback()
                raise
    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(migrate())
