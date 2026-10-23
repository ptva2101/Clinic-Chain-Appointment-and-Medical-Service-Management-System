"""Create Clinical-owned tables without modifying other services' data."""

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
                    for name, definition in (
                        ("config_code", "VARCHAR(96) NULL"),
                        ("duty_date", "DATE NULL"),
                        ("shift", "TINYINT UNSIGNED NULL"),
                    ):
                        await cursor.execute(f"SHOW COLUMNS FROM treatment_sessions LIKE '{name}'")
                        column = await cursor.fetchone()
                        if column["Null"] == "NO":
                            await cursor.execute(
                                f"ALTER TABLE treatment_sessions MODIFY COLUMN {name} {definition}"
                            )
                    await cursor.execute("SHOW COLUMNS FROM treatment_sessions LIKE 'source'")
                    if await cursor.fetchone() is None:
                        await cursor.execute(
                            "ALTER TABLE treatment_sessions ADD COLUMN source VARCHAR(32) "
                            "NOT NULL DEFAULT 'live'"
                        )
                    await cursor.execute(
                        "SELECT CHECK_CLAUSE AS clause FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS "
                        "WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'ck_session_status'"
                    )
                    check = await cursor.fetchone()
                    if check is None or "historical_unbooked" not in check["clause"]:
                        if check is not None:
                            await cursor.execute(
                                "ALTER TABLE treatment_sessions DROP CHECK ck_session_status"
                            )
                        await cursor.execute(
                            "ALTER TABLE treatment_sessions ADD CONSTRAINT ck_session_status "
                            "CHECK (status IN ('pending', 'booked', 'completed', 'historical_unbooked'))"
                        )
                    await cursor.execute(
                        "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() "
                        "AND table_name = 'historical_records'"
                    )
                    if await cursor.fetchone() is not None:
                        await cursor.execute(
                            "INSERT IGNORE INTO disease_catalog (code, name) "
                            "SELECT JSON_UNQUOTE(JSON_EXTRACT(payload, '$.MaBenh')), "
                            "JSON_UNQUOTE(JSON_EXTRACT(payload, '$.TenBenh')) "
                            "FROM historical_records WHERE entity = 'BENH' "
                            "AND JSON_EXTRACT(payload, '$.MaBenh') IS NOT NULL "
                            "AND JSON_EXTRACT(payload, '$.TenBenh') IS NOT NULL"
                        )
                        await cursor.execute(
                            "INSERT IGNORE INTO medicine_catalog (code, name, unit) "
                            "SELECT JSON_UNQUOTE(JSON_EXTRACT(payload, '$.MaThuoc')), "
                            "JSON_UNQUOTE(JSON_EXTRACT(payload, '$.TenThuoc')), "
                            "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.DonViTinh')), '') "
                            "FROM historical_records WHERE entity = 'THUOC' "
                            "AND JSON_EXTRACT(payload, '$.MaThuoc') IS NOT NULL "
                            "AND JSON_EXTRACT(payload, '$.TenThuoc') IS NOT NULL"
                        )
                await connection.commit()
            except Exception:
                await connection.rollback()
                raise
    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(migrate())
