"""All Identity-owned persistence; no reads from other services' databases."""

from datetime import datetime, timedelta, timezone

from common.database import MySQLDatabase


def utc_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class IdentityRepository:
    def __init__(self, database: MySQLDatabase) -> None:
        self.database = database

    async def find_by_login(self, role: str, username: str) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    "SELECT * FROM accounts WHERE role = %s AND username = %s",
                    (role, username),
                )
                account = await cursor.fetchone()
            await connection.rollback()
            return account

    async def find_by_id(self, account_id: str) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute("SELECT * FROM accounts WHERE id = %s", (account_id,))
                account = await cursor.fetchone()
            await connection.rollback()
            return account

    async def record_login_failure(self, account_id: str) -> None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "UPDATE accounts SET failed_attempts = failed_attempts + 1, "
                        "locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN %s ELSE locked_until END "
                        "WHERE id = %s",
                        (utc_naive() + timedelta(minutes=15), account_id),
                    )
                await connection.commit()
            except Exception:
                await connection.rollback()
                raise

    async def clear_login_failures(self, account_id: str) -> None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "UPDATE accounts SET failed_attempts = 0, locked_until = NULL WHERE id = %s",
                        (account_id,),
                    )
                await connection.commit()
            except Exception:
                await connection.rollback()
                raise

    async def set_password(self, account_id: str, password_hash: str) -> bool:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "UPDATE accounts SET password_hash = %s, token_version = token_version + 1, "
                        "failed_attempts = 0, locked_until = NULL WHERE id = %s",
                        (password_hash, account_id),
                    )
                    found = cursor.rowcount > 0
                    if found:
                        await cursor.execute(
                            "UPDATE refresh_tokens SET revoked_at = %s WHERE account_id = %s AND revoked_at IS NULL",
                            (utc_naive(), account_id),
                        )
                await connection.commit()
                return found
            except Exception:
                await connection.rollback()
                raise

    async def revoke_all(self, account_id: str) -> None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "UPDATE accounts SET token_version = token_version + 1 WHERE id = %s",
                        (account_id,),
                    )
                    await cursor.execute(
                        "UPDATE refresh_tokens SET revoked_at = %s WHERE account_id = %s AND revoked_at IS NULL",
                        (utc_naive(), account_id),
                    )
                await connection.commit()
            except Exception:
                await connection.rollback()
                raise

    async def enable_account(self, account_id: str) -> bool:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute("SELECT id FROM accounts WHERE id = %s", (account_id,))
                    if await cursor.fetchone() is None:
                        await connection.rollback()
                        return False
                    await cursor.execute(
                        "UPDATE accounts SET is_active = TRUE, failed_attempts = 0, locked_until = NULL WHERE id = %s",
                        (account_id,),
                    )
                await connection.commit()
                return True
            except Exception:
                await connection.rollback()
                raise

    async def list_accounts(self, limit: int, offset: int, role: str | None) -> list[dict]:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                if role is None:
                    await cursor.execute(
                        "SELECT id, role, username, subject_id, is_active, registration_pending "
                        "FROM accounts ORDER BY created_at, id LIMIT %s OFFSET %s",
                        (limit, offset),
                    )
                else:
                    await cursor.execute(
                        "SELECT id, role, username, subject_id, is_active, registration_pending "
                        "FROM accounts WHERE role = %s "
                        "ORDER BY created_at, id LIMIT %s OFFSET %s",
                        (role, limit, offset),
                    )
                accounts = await cursor.fetchall()
            await connection.rollback()
            return accounts

    async def create_account(self, account_id: str, role: str, username: str, subject_id: str | None, password_hash: str) -> dict:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "INSERT INTO accounts (id, role, username, subject_id, password_hash) VALUES (%s, %s, %s, %s, %s)",
                        (account_id, role, username, subject_id, password_hash),
                    )
                await connection.commit()
            except Exception:
                await connection.rollback()
                raise
        return (await self.find_by_id(account_id))

    async def create_pending_patient(self, account_id: str, cccd: str, password_hash: str) -> dict:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "INSERT INTO accounts (id, role, username, password_hash, is_active, registration_pending) "
                        "VALUES (%s, 'patient', %s, %s, FALSE, TRUE)",
                        (account_id, cccd, password_hash),
                    )
                await connection.commit()
            except Exception:
                await connection.rollback()
                raise
        return await self.find_by_id(account_id)

    async def create_pending_staff(
        self, account_id: str, role: str, username: str, staff_code: str, password_hash: str
    ) -> dict:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "INSERT INTO accounts "
                        "(id, role, username, subject_id, password_hash, is_active, registration_pending) "
                        "VALUES (%s, %s, %s, %s, %s, FALSE, TRUE)",
                        (account_id, role, username, staff_code, password_hash),
                    )
                await connection.commit()
            except Exception:
                await connection.rollback()
                raise
        return await self.find_by_id(account_id)

    async def activate_staff_profile(self, account_id: str, role: str, staff_code: str) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "UPDATE accounts SET is_active = TRUE, registration_pending = FALSE "
                        "WHERE id = %s AND role = %s AND subject_id = %s "
                        "AND registration_pending = TRUE AND is_active = FALSE",
                        (account_id, role, staff_code),
                    )
                await connection.commit()
            except Exception:
                await connection.rollback()
                raise
        account = await self.find_by_id(account_id)
        if (account and account["role"] == role and account["subject_id"] == staff_code
                and account["is_active"] and not account["registration_pending"]):
            return account
        return None

    async def link_patient_profile(self, account_id: str, profile_id: str) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "UPDATE accounts SET subject_id = %s, is_active = TRUE, registration_pending = FALSE "
                        "WHERE id = %s AND role = 'patient' AND (subject_id IS NULL OR subject_id = %s) "
                        "AND (registration_pending = TRUE OR is_active = TRUE)",
                        (profile_id, account_id, profile_id),
                    )
                await connection.commit()
            except Exception:
                await connection.rollback()
                raise
        account = await self.find_by_id(account_id)
        if account and account["subject_id"] == profile_id and account["is_active"] and not account["registration_pending"]:
            return account
        return None

    async def disable_account(self, account_id: str) -> bool:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "UPDATE accounts SET is_active = FALSE, token_version = token_version + 1 WHERE id = %s",
                        (account_id,),
                    )
                    found = cursor.rowcount > 0
                    if found:
                        await cursor.execute(
                            "UPDATE refresh_tokens SET revoked_at = %s WHERE account_id = %s AND revoked_at IS NULL",
                            (utc_naive(), account_id),
                        )
                await connection.commit()
                return found
            except Exception:
                await connection.rollback()
                raise

    async def save_refresh(self, digest: str, account_id: str, expires_at: datetime) -> None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "INSERT INTO refresh_tokens (token_hash, account_id, expires_at) VALUES (%s, %s, %s)",
                        (digest, account_id, expires_at),
                    )
                await connection.commit()
            except Exception:
                await connection.rollback()
                raise

    async def rotate_refresh(self, old_digest: str, new_digest: str, expires_at: datetime) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "SELECT account_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = %s FOR UPDATE",
                        (old_digest,),
                    )
                    token = await cursor.fetchone()
                    if not token or token["revoked_at"] is not None or token["expires_at"] <= utc_naive():
                        await connection.rollback()
                        return None
                    await cursor.execute("SELECT * FROM accounts WHERE id = %s", (token["account_id"],))
                    account = await cursor.fetchone()
                    if not account or not account["is_active"]:
                        await connection.rollback()
                        return None
                    await cursor.execute(
                        "UPDATE refresh_tokens SET revoked_at = %s WHERE token_hash = %s",
                        (utc_naive(), old_digest),
                    )
                    await cursor.execute(
                        "INSERT INTO refresh_tokens (token_hash, account_id, expires_at) VALUES (%s, %s, %s)",
                        (new_digest, account["id"], expires_at),
                    )
                await connection.commit()
                return account
            except Exception:
                await connection.rollback()
                raise

    async def revoke_refresh(self, digest: str) -> None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "UPDATE refresh_tokens SET revoked_at = %s WHERE token_hash = %s AND revoked_at IS NULL",
                        (utc_naive(), digest),
                    )
                await connection.commit()
            except Exception:
                await connection.rollback()
                raise
