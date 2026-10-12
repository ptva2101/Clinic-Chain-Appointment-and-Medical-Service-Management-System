"""Patient records are owned by Registry; Identity never opens registry_db."""

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
