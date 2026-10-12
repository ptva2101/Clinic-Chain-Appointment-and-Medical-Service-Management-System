"""Explicit, local-only reset of Identity accounts and sessions.

Other databases and their volumes are never touched. Run while the Identity API is stopped.
"""

import argparse
import asyncio
import os
from uuid import uuid4

from common.database import MySQLDatabase
from identity.security import hash_password, signing_secret


async def reset_identity() -> None:
    if os.environ.get("DB_NAME") != "identity_db":
        raise RuntimeError("Reset is restricted to identity_db")
    signing_secret()
    username = os.environ["IDENTITY_ADMIN_USERNAME"]
    password = os.environ["IDENTITY_ADMIN_PASSWORD"]
    if len(password) < 12:
        raise RuntimeError("IDENTITY_ADMIN_PASSWORD must have at least 12 characters")

    database = MySQLDatabase()
    try:
        pool = await database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute("DELETE FROM refresh_tokens")
                    await cursor.execute("DELETE FROM accounts")
                    await cursor.execute(
                        "INSERT INTO accounts (id, role, username, password_hash) "
                        "VALUES (%s, 'admin', %s, %s)",
                        (str(uuid4()), username, hash_password(password)),
                    )
                await connection.commit()
            except Exception:
                await connection.rollback()
                raise
    finally:
        await database.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Delete Identity accounts/sessions and recreate local admin")
    parser.add_argument("--confirm", required=True, choices=["identity_db"])
    args = parser.parse_args()
    if args.confirm != os.environ.get("DB_NAME"):
        parser.error("Confirmation does not match DB_NAME")
    asyncio.run(reset_identity())
    print("Identity accounts and sessions reset; local admin recreated")


if __name__ == "__main__":
    main()
