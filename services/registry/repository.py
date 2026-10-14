"""Patient and staff profiles are owned by Registry; Identity never opens registry_db."""

import aiomysql

from common.database import MySQLDatabase


class ProfileConflict(Exception):
    pass


class RegistryRepository:
    def __init__(self, database: MySQLDatabase) -> None:
        self.database = database

    async def ensure_patient(self, account_id: str, cccd: str) -> dict:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "SELECT id, identity_account_id, cccd, full_name, date_of_birth, phone "
                        "FROM patients WHERE identity_account_id = %s",
                        (account_id,),
                    )
                    patient = await cursor.fetchone()
                    if patient is None:
                        try:
                            await cursor.execute(
                                "INSERT INTO patients (id, identity_account_id, cccd) VALUES (%s, %s, %s)",
                                (account_id, account_id, cccd),
                            )
                            await connection.commit()
                            await cursor.execute(
                                "SELECT id, identity_account_id, cccd, full_name, date_of_birth, phone "
                                "FROM patients WHERE identity_account_id = %s",
                                (account_id,),
                            )
                            patient = await cursor.fetchone()
                        except aiomysql.IntegrityError:
                            await connection.rollback()
                            await cursor.execute(
                                "SELECT id, identity_account_id, cccd, full_name, date_of_birth, phone "
                                "FROM patients WHERE identity_account_id = %s OR cccd = %s LIMIT 1",
                                (account_id, cccd),
                            )
                            patient = await cursor.fetchone()
                    if not patient or patient["identity_account_id"] != account_id or patient["cccd"] != cccd:
                        raise ProfileConflict("CCCD is linked to another account")
                    await connection.rollback()
                    return patient
            except Exception:
                await connection.rollback()
                raise

    async def get_patient(self, account_id: str, profile_id: str) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    "SELECT id, identity_account_id, cccd, full_name, date_of_birth, phone "
                    "FROM patients WHERE identity_account_id = %s AND id = %s",
                    (account_id, profile_id),
                )
                patient = await cursor.fetchone()
                await connection.rollback()
                return patient

    async def list_patients(self, query: str, limit: int, offset: int) -> tuple[list[dict], int]:
        pool = await self.database.pool()
        where = ""
        params: tuple[str, ...] = ()
        if query:
            where = " WHERE cccd LIKE %s OR full_name LIKE %s OR phone LIKE %s"
            keyword = f"%{query}%"
            params = (keyword, keyword, keyword)
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(f"SELECT COUNT(*) AS total FROM patients{where}", params)
                total = (await cursor.fetchone())["total"]
                await cursor.execute(
                    "SELECT id, identity_account_id, cccd, full_name, date_of_birth, phone "
                    f"FROM patients{where} ORDER BY created_at DESC, id DESC LIMIT %s OFFSET %s",
                    (*params, limit, offset),
                )
                patients = await cursor.fetchall()
                await connection.rollback()
                return patients, total

    async def update_patient(self, account_id: str, profile_id: str, changes: dict) -> dict | None:
        if not changes:
            raise ValueError("At least one profile field is required")
        allowed = {"full_name", "date_of_birth", "phone"}
        if not changes.keys() <= allowed:
            raise ValueError("Unsupported profile field")
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "SELECT id FROM patients WHERE identity_account_id = %s AND id = %s",
                        (account_id, profile_id),
                    )
                    if await cursor.fetchone() is None:
                        await connection.rollback()
                        return None
                    assignments = ", ".join(f"{field} = %s" for field in changes)
                    await cursor.execute(
                        f"UPDATE patients SET {assignments} WHERE identity_account_id = %s AND id = %s",
                        (*changes.values(), account_id, profile_id),
                    )
                    await connection.commit()
                    await cursor.execute(
                        "SELECT id, identity_account_id, cccd, full_name, date_of_birth, phone "
                        "FROM patients WHERE identity_account_id = %s AND id = %s",
                        (account_id, profile_id),
                    )
                    patient = await cursor.fetchone()
                    await connection.rollback()
                    return patient
            except Exception:
                await connection.rollback()
                raise

    async def ensure_staff(self, account_id: str, details: dict) -> dict:
        fields = ("staff_code", "role", "full_name", "phone", "specialty", "branch_code")
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "SELECT staff_code, identity_account_id, role, full_name, phone, specialty, branch_code, source "
                        "FROM staff_profiles WHERE identity_account_id = %s",
                        (account_id,),
                    )
                    profile = await cursor.fetchone()
                    if profile is None:
                        try:
                            await cursor.execute(
                                "INSERT INTO staff_profiles "
                                "(staff_code, identity_account_id, role, full_name, phone, specialty, branch_code) "
                                "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                                (details["staff_code"], account_id, *(details[field] for field in fields[1:])),
                            )
                            await connection.commit()
                            await cursor.execute(
                                "SELECT staff_code, identity_account_id, role, full_name, phone, specialty, branch_code, source "
                                "FROM staff_profiles WHERE identity_account_id = %s",
                                (account_id,),
                            )
                            profile = await cursor.fetchone()
                        except aiomysql.IntegrityError:
                            await connection.rollback()
                            await cursor.execute(
                                "SELECT staff_code, identity_account_id, role, full_name, phone, specialty, branch_code, source "
                                "FROM staff_profiles WHERE identity_account_id = %s OR staff_code = %s LIMIT 1",
                                (account_id, details["staff_code"]),
                            )
                            profile = await cursor.fetchone()
                    if (not profile or profile["identity_account_id"] != account_id
                            or profile["staff_code"] != details["staff_code"]
                            or profile["role"] != details["role"]):
                        raise ProfileConflict("Staff code is linked to another account")
                    await connection.rollback()
                    return profile
            except Exception:
                await connection.rollback()
                raise

    async def get_staff(self, account_id: str, staff_code: str) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    "SELECT staff_code, identity_account_id, role, full_name, phone, specialty, branch_code, source "
                    "FROM staff_profiles WHERE identity_account_id = %s AND staff_code = %s",
                    (account_id, staff_code),
                )
                profile = await cursor.fetchone()
                await connection.rollback()
                return profile

    async def get_staff_by_code(self, staff_code: str) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    "SELECT staff_code, identity_account_id, role, full_name, phone, specialty, branch_code, source "
                    "FROM staff_profiles WHERE staff_code = %s",
                    (staff_code,),
                )
                profile = await cursor.fetchone()
                await connection.rollback()
                return profile

    async def list_staff(self, query: str, limit: int, offset: int) -> tuple[list[dict], int]:
        pool = await self.database.pool()
        where = ""
        params: tuple[str, ...] = ()
        if query:
            where = " WHERE staff_code LIKE %s OR full_name LIKE %s OR phone LIKE %s"
            keyword = f"%{query}%"
            params = (keyword, keyword, keyword)
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(f"SELECT COUNT(*) AS total FROM staff_profiles{where}", params)
                total = (await cursor.fetchone())["total"]
                await cursor.execute(
                    "SELECT staff_code, identity_account_id, role, full_name, phone, specialty, branch_code, source "
                    f"FROM staff_profiles{where} ORDER BY created_at DESC, staff_code DESC LIMIT %s OFFSET %s",
                    (*params, limit, offset),
                )
                profiles = await cursor.fetchall()
                await connection.rollback()
                return profiles, total
