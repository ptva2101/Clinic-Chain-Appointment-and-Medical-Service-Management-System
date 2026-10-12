"""One-time import from the old monolith. Never used by the running API."""

import argparse
import asyncio
import os
from uuid import uuid4

import aiomysql

from common.database import MySQLDatabase
from identity.repository import IdentityRepository
from identity.security import hash_password


LEGACY_QUERIES = {
    "patient": "SELECT CCCD AS username, MaBenhAn AS subject_id, MatKhau AS password FROM BENH_NHAN",
    "doctor": "SELECT MaBacSi AS username, MaBacSi AS subject_id, MatKhau AS password FROM BAC_SI",
    "letan": "SELECT MaLeTan AS username, MaLeTan AS subject_id, MatKhau AS password FROM LE_TAN",
    "xnv": "SELECT MaXNV AS username, MaXNV AS subject_id, MatKhau AS password FROM XET_NGHIEM_VIEN",
}


async def read_legacy_accounts() -> list[dict]:
    pool = await aiomysql.create_pool(
        host=os.environ["LEGACY_DB_HOST"],
        port=int(os.getenv("LEGACY_DB_PORT", "3306")),
        db=os.environ["LEGACY_DB_NAME"],
        user=os.environ["LEGACY_DB_USER"],
        password=os.environ["LEGACY_DB_PASSWORD"],
        charset="utf8mb4",
        autocommit=True,
        connect_timeout=5,
        cursorclass=aiomysql.DictCursor,
    )
    try:
        records = []
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                for role, query in LEGACY_QUERIES.items():
                    await cursor.execute(query)
                    for row in await cursor.fetchall():
                        records.append({"role": role, **row})
        return records
    finally:
        pool.close()
        await pool.wait_closed()


async def import_accounts(records: list[dict], repository: IdentityRepository, apply: bool) -> dict[str, int]:
    result = {"total": len(records), "ready": 0, "created": 0, "existing": 0, "conflicts": 0, "invalid": 0}
    seen = set()
    for record in records:
        role = record["role"]
        username = str(record["username"] or "").strip()
        subject_id = str(record["subject_id"] or "").strip()
        password = str(record["password"] or "")
        if not username or not subject_id or not password or len(username) > 128 or len(subject_id) > 128 or len(password) > 256:
            result["invalid"] += 1
            continue
        key = (role, username)
        if key in seen:
            result["conflicts"] += 1
            continue
        seen.add(key)
        existing = await repository.find_by_login(role, username)
        if existing:
            result["existing" if existing["subject_id"] == subject_id else "conflicts"] += 1
            continue
        if apply:
            await repository.create_account(str(uuid4()), role, username, subject_id, hash_password(password))
            result["created"] += 1
        else:
            result["ready"] += 1
    return result


async def run(apply: bool) -> dict[str, int]:
    records = await read_legacy_accounts()
    database = MySQLDatabase()
    try:
        return await import_accounts(records, IdentityRepository(database), apply)
    finally:
        await database.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Import legacy monolith credentials into Identity")
    parser.add_argument("--apply", action="store_true", help="Write new accounts; otherwise only show counts")
    args = parser.parse_args()
    result = asyncio.run(run(args.apply))
    print(f"mode={'apply' if args.apply else 'dry-run'} counts={result}")


if __name__ == "__main__":
    main()
