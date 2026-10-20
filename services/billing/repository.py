"""Billing persistence. Invoice prices are immutable snapshots of Registry prices."""

from datetime import datetime
from uuid import uuid4

import aiomysql

from common.database import MySQLDatabase


COLUMNS = (
    "id, appointment_id, patient_account_id, patient_id, service_code, "
    "list_price, insurance_discount, amount_due, status, payment_method, "
    "payment_token, paid_at, created_at, updated_at"
)


class InvoiceConflict(Exception):
    pass


class InvoiceRepository:
    def __init__(self, database: MySQLDatabase) -> None:
        self.database = database

    async def get(self, invoice_id: str) -> dict | None:
        return await self._one("id", invoice_id)

    async def by_appointment(self, appointment_id: str) -> dict | None:
        return await self._one("appointment_id", appointment_id)

    async def _one(self, column: str, value: str) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(f"SELECT {COLUMNS} FROM invoices WHERE {column} = %s", (value,))
                row = await cursor.fetchone()
                await connection.rollback()
                return row

    async def create(self, appointment: dict, account: dict, list_price: int) -> dict:
        existing = await self.by_appointment(appointment["id"])
        if existing:
            if existing["patient_account_id"] != account["id"]:
                raise InvoiceConflict("Invoice belongs to another patient")
            return existing
        invoice_id = str(uuid4())
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "INSERT INTO invoices (id, appointment_id, patient_account_id, patient_id, "
                        "service_code, list_price, insurance_discount, amount_due) "
                        "VALUES (%s, %s, %s, %s, %s, %s, 0, %s)",
                        (invoice_id, appointment["id"], account["id"], appointment["patient_id"],
                         appointment["service_code"], list_price, list_price),
                    )
                    await cursor.execute(f"SELECT {COLUMNS} FROM invoices WHERE id = %s", (invoice_id,))
                    row = await cursor.fetchone()
                await connection.commit()
                return row
            except aiomysql.IntegrityError:
                await connection.rollback()
            except Exception:
                await connection.rollback()
                raise
        existing = await self.by_appointment(appointment["id"])
        if existing and existing["patient_account_id"] == account["id"]:
            return existing
        raise InvoiceConflict("Invoice already exists")

    async def list_patient(self, account_id: str) -> list[dict]:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    f"SELECT {COLUMNS} FROM invoices WHERE patient_account_id = %s "
                    "ORDER BY created_at DESC LIMIT 500", (account_id,),
                )
                rows = await cursor.fetchall()
                await connection.rollback()
                return rows

    async def simulate_payment(self, invoice_id: str, account_id: str) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        f"SELECT {COLUMNS} FROM invoices WHERE id = %s FOR UPDATE", (invoice_id,),
                    )
                    row = await cursor.fetchone()
                    if row is None or row["patient_account_id"] != account_id:
                        await connection.rollback()
                        return None
                    if row["status"] == "paid":
                        await connection.rollback()
                        return row
                    if row["status"] != "pending":
                        raise InvoiceConflict("Invoice cannot be paid")
                    await cursor.execute(
                        "UPDATE invoices SET status = 'paid', payment_method = 'simulated', "
                        "payment_token = %s, paid_at = UTC_TIMESTAMP(6) WHERE id = %s",
                        (f"SIM_{uuid4().hex.upper()}", invoice_id),
                    )
                    await cursor.execute(f"SELECT {COLUMNS} FROM invoices WHERE id = %s", (invoice_id,))
                    updated = await cursor.fetchone()
                await connection.commit()
                return updated
            except Exception:
                await connection.rollback()
                raise

    async def monthly_report(self, year: int, month: int) -> dict:
        start = datetime(year, month, 1)
        end = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    "SELECT COUNT(*) AS paid_count, COALESCE(SUM(amount_due), 0) AS revenue "
                    "FROM invoices WHERE status = 'paid' AND paid_at >= %s AND paid_at < %s",
                    (start, end),
                )
                paid = await cursor.fetchone()
                await cursor.execute(
                    "SELECT COUNT(*) AS pending_count FROM invoices "
                    "WHERE status = 'pending' AND created_at >= %s AND created_at < %s",
                    (start, end),
                )
                pending = await cursor.fetchone()
                await connection.rollback()
                return {"month": f"{year:04d}-{month:02d}", "paid_count": paid["paid_count"],
                        "pending_count": pending["pending_count"], "revenue": int(paid["revenue"])}
