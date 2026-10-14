"""Idempotent schema setup and first local administrator account."""

import asyncio
import os
import re
from pathlib import Path
from uuid import uuid4

from common.database import MySQLDatabase
from identity.security import hash_password, signing_secret


async def migrate() -> None:
    signing_secret()
    database = MySQLDatabase()
    try:
        pool = await database.pool()
        statements = Path(__file__).with_name("schema.sql").read_text(encoding="utf-8").split(";")
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                for statement in statements:
                    if statement.strip():
                        table = re.match(r"\s*CREATE TABLE IF NOT EXISTS\s+([a-z_]+)", statement, re.IGNORECASE)
                        if table:
                            await cursor.execute(
                                "SELECT 1 FROM information_schema.tables "
                                "WHERE table_schema = DATABASE() AND table_name = %s",
                                (table.group(1),),
                            )
                            if await cursor.fetchone() is not None:
                                continue
                        await cursor.execute(statement)
                # Existing Docker volumes may have been created by the first Identity version.
                for column, definition in {
                    "token_version": "INT NOT NULL DEFAULT 0",
                    "failed_attempts": "INT NOT NULL DEFAULT 0",
                    "locked_until": "DATETIME(6) NULL",
                    "registration_pending": "BOOLEAN NOT NULL DEFAULT FALSE",
                }.items():
                    await cursor.execute(
                        "SELECT 1 FROM information_schema.columns "
                        "WHERE table_schema = DATABASE() AND table_name = 'accounts' AND column_name = %s",
                        (column,),
                    )
                    if await cursor.fetchone() is None:
                        await cursor.execute(f"ALTER TABLE accounts ADD COLUMN {column} {definition}")
                username = os.environ["IDENTITY_ADMIN_USERNAME"]
                password = os.environ["IDENTITY_ADMIN_PASSWORD"]
                if len(password) < 6:
                    raise RuntimeError("IDENTITY_ADMIN_PASSWORD must have at least 6 characters")
                await cursor.execute("SELECT id FROM accounts WHERE role = 'admin' LIMIT 1")
                if await cursor.fetchone() is None:
                    await cursor.execute(
                        "INSERT INTO accounts (id, role, username, password_hash) VALUES (%s, 'admin', %s, %s)",
                        (str(uuid4()), username, hash_password(password)),
                    )
            await connection.commit()
    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(migrate())
