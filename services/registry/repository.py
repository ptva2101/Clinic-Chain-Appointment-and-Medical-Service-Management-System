"""Patient and staff profiles are owned by Registry; Identity never opens registry_db."""

import aiomysql

from common.database import MySQLDatabase


class ProfileConflict(Exception):
    pass


class RegistryRepository:
    PATIENT_FIELDS = ("id, identity_account_id, cccd, full_name, date_of_birth, phone, "
                      "insurance_card_number, insurance_category_code, insurance_verified, source")

    def __init__(self, database: MySQLDatabase) -> None:
        self.database = database

    async def insurance_categories(self) -> list[dict]:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute("SELECT code, name, coverage_bps FROM insurance_categories ORDER BY code")
                rows = await cursor.fetchall()
                await connection.rollback()
                return rows

    async def create_insurance_category(self, category: dict) -> None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "INSERT INTO insurance_categories (code, name, coverage_bps) "
                        "VALUES (%s, %s, %s)",
                        (category["code"], category["name"], category["coverage_bps"]),
                    )
                await connection.commit()
            except aiomysql.IntegrityError as exc:
                await connection.rollback()
                raise ProfileConflict("Insurance category already exists") from exc
            except Exception:
                await connection.rollback()
                raise

    async def patient_insurance(self, patient_id: str) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    "SELECT p.id AS patient_id, p.insurance_card_number, p.insurance_category_code, "
                    "p.insurance_verified, CASE WHEN p.insurance_verified THEN c.coverage_bps "
                    "ELSE 0 END AS coverage_bps FROM patients p LEFT JOIN insurance_categories c "
                    "ON c.code = p.insurance_category_code WHERE p.id = %s", (patient_id,))
                row = await cursor.fetchone()
                await connection.rollback()
                return row

    async def verify_patient_insurance(self, patient_id: str, verified: bool) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "SELECT insurance_card_number, insurance_category_code FROM patients "
                        "WHERE id = %s FOR UPDATE", (patient_id,))
                    row = await cursor.fetchone()
                    if row is None:
                        await connection.rollback()
                        return None
                    if verified and (not row["insurance_card_number"] or not row["insurance_category_code"]):
                        raise ProfileConflict("Patient has no insurance card and category")
                    await cursor.execute("UPDATE patients SET insurance_verified = %s WHERE id = %s",
                                         (verified, patient_id))
                    await cursor.execute(
                        f"SELECT {self.PATIENT_FIELDS} FROM patients WHERE id = %s", (patient_id,))
                    result = await cursor.fetchone()
                await connection.commit()
                return result
            except Exception:
                await connection.rollback()
                raise

    async def patients_by_ids(self, profile_ids: list[str]) -> list[dict]:
        if not profile_ids:
            return []
        placeholders = ", ".join(["%s"] * len(profile_ids))
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    f"SELECT {self.PATIENT_FIELDS} "
                    f"FROM patients WHERE id IN ({placeholders})", tuple(profile_ids),
                )
                rows = await cursor.fetchall()
                await connection.rollback()
                return rows

    async def ensure_patient(self, account_id: str, cccd: str) -> dict:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        f"SELECT {self.PATIENT_FIELDS} "
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
                                f"SELECT {self.PATIENT_FIELDS} "
                                "FROM patients WHERE identity_account_id = %s",
                                (account_id,),
                            )
                            patient = await cursor.fetchone()
                        except aiomysql.IntegrityError:
                            await connection.rollback()
                            await cursor.execute(
                                f"SELECT {self.PATIENT_FIELDS} "
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
                    f"SELECT {self.PATIENT_FIELDS} "
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
                    f"SELECT {self.PATIENT_FIELDS} "
                    f"FROM patients{where} ORDER BY created_at DESC, id DESC LIMIT %s OFFSET %s",
                    (*params, limit, offset),
                )
                patients = await cursor.fetchall()
                await connection.rollback()
                return patients, total

    async def update_patient(self, account_id: str, profile_id: str, changes: dict) -> dict | None:
        if not changes:
            raise ValueError("At least one profile field is required")
        allowed = {"full_name", "date_of_birth", "phone", "insurance_card_number", "insurance_category_code"}
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
                    if changes.get("insurance_category_code") is not None:
                        await cursor.execute("SELECT code FROM insurance_categories WHERE code = %s",
                                             (changes["insurance_category_code"],))
                        if await cursor.fetchone() is None:
                            raise ProfileConflict("Unknown insurance category")
                    assignments = ", ".join(f"{field} = %s" for field in changes)
                    if "insurance_card_number" in changes:
                        assignments += ", insurance_verified = FALSE"
                    await cursor.execute(
                        f"UPDATE patients SET {assignments} WHERE identity_account_id = %s AND id = %s",
                        (*changes.values(), account_id, profile_id),
                    )
                    await connection.commit()
                    await cursor.execute(
                        f"SELECT {self.PATIENT_FIELDS} "
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
