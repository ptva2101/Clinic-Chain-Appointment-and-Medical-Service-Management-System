"""Billing persistence. Invoice prices are immutable snapshots of Registry prices."""

from datetime import datetime
from uuid import uuid4

import aiomysql

from common.database import MySQLDatabase


COLUMNS = (
    "id, appointment_id, patient_account_id, patient_id, service_code, "
    "list_price, insurance_discount, amount_due, status, payment_method, "
    "payment_token, paid_at, created_at, updated_at, branch_code, doctor_code, "
    "insurance_card_number, insurance_category_code, insurance_verified, coverage_bps, "
    "refunded_at, source, legacy_date"
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

    async def create(self, appointment: dict, account: dict, list_price: int,
                     insurance: dict) -> dict:
        existing = await self.by_appointment(appointment["id"])
        if existing:
            if existing["patient_account_id"] != account["id"]:
                raise InvoiceConflict("Invoice belongs to another patient")
            return existing
        invoice_id = str(uuid4())
        coverage_bps = insurance.get("coverage_bps") or 0
        discount = list_price * coverage_bps // 10000
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "INSERT INTO invoices (id, appointment_id, patient_account_id, patient_id, "
                        "service_code, branch_code, doctor_code, list_price, insurance_card_number, "
                        "insurance_category_code, insurance_verified, coverage_bps, "
                        "insurance_discount, amount_due) "
                        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                        (invoice_id, appointment["id"], account["id"], appointment["patient_id"],
                         appointment["service_code"], appointment["branch_code"],
                         appointment["doctor_code"], list_price,
                         insurance.get("insurance_card_number"),
                         insurance.get("insurance_category_code"),
                         bool(insurance.get("insurance_verified")), coverage_bps,
                         discount, list_price - discount),
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

    async def list_admin(self, limit: int, offset: int) -> tuple[list[dict], int]:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute("SELECT COUNT(*) AS total FROM invoices")
                total = (await cursor.fetchone())["total"]
                await cursor.execute(
                    f"SELECT {COLUMNS} FROM invoices ORDER BY created_at DESC, id DESC "
                    "LIMIT %s OFFSET %s", (limit, offset),
                )
                rows = await cursor.fetchall()
                await connection.rollback()
                return rows, total

    async def list_legacy_lab_charges(self, limit: int, offset: int) -> list[dict]:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    "SELECT id, lab_order_id, appointment_id, patient_id, branch_code, "
                    "doctor_code, service_code, list_price, insurance_discount, amount_due, "
                    "legacy_date, source FROM legacy_lab_charges "
                    "ORDER BY legacy_date DESC, id LIMIT %s OFFSET %s", (limit, offset),
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

    async def simulate_refund(self, invoice_id: str) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(f"SELECT {COLUMNS} FROM invoices WHERE id = %s FOR UPDATE",
                                         (invoice_id,))
                    row = await cursor.fetchone()
                    if row is None:
                        await connection.rollback()
                        return None
                    if row["status"] == "refunded":
                        await connection.rollback()
                        return row
                    if row["status"] != "paid" or row["payment_method"] != "simulated" or row["source"] != "live":
                        raise InvoiceConflict("Only paid current invoices recorded in this system can be refunded")
                    await cursor.execute(
                        "UPDATE invoices SET status = 'refunded', refunded_at = UTC_TIMESTAMP(6) WHERE id = %s",
                        (invoice_id,),
                    )
                    await cursor.execute(f"SELECT {COLUMNS} FROM invoices WHERE id = %s", (invoice_id,))
                    result = await cursor.fetchone()
                await connection.commit()
                return result
            except Exception:
                await connection.rollback()
                raise

    async def grouped_report(self, year: int, month: int, group_by: str) -> list[dict]:
        column = {"branch": "branch_code", "doctor": "doctor_code",
                  "service": "service_code"}[group_by]
        start = datetime(year, month, 1)
        end = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    f"SELECT {column} AS code, COUNT(*) AS paid_count, "
                    "COALESCE(SUM(amount_due), 0) AS revenue, "
                    "COALESCE(SUM(insurance_discount), 0) AS insurance_discount, "
                    "SUM(CASE WHEN source = 'legacy_mysql' THEN 1 ELSE 0 END) AS legacy_estimated_count "
                    "FROM invoices WHERE status = 'paid' AND "
                    "((paid_at >= %s AND paid_at < %s) OR "
                    "(source = 'legacy_mysql' AND legacy_date >= %s AND legacy_date < %s)) "
                    f"GROUP BY {column} ORDER BY revenue DESC, code", (start, end, start, end),
                )
                rows = await cursor.fetchall()
                await cursor.execute(
                    f"SELECT {column} AS code, COUNT(*) AS paid_count, "
                    "COALESCE(SUM(amount_due), 0) AS revenue, "
                    "COALESCE(SUM(insurance_discount), 0) AS insurance_discount "
                    "FROM legacy_lab_charges WHERE legacy_date >= %s AND legacy_date < %s "
                    f"GROUP BY {column}", (start, end),
                )
                lab_rows = await cursor.fetchall()
                await connection.rollback()
                combined = {row["code"]: {**row, "legacy_lab_count": 0} for row in rows}
                for row in lab_rows:
                    item = combined.setdefault(row["code"], {"code": row["code"],
                        "paid_count": 0, "revenue": 0, "insurance_discount": 0,
                        "legacy_estimated_count": 0,
                        "legacy_lab_count": 0})
                    item["paid_count"] += row["paid_count"]
                    item["revenue"] += int(row["revenue"])
                    item["insurance_discount"] += int(row["insurance_discount"])
                    item["legacy_estimated_count"] += row["paid_count"]
                    item["legacy_lab_count"] += row["paid_count"]
                return sorted(combined.values(), key=lambda item: (-item["revenue"], item["code"] or ""))

    async def monthly_report(self, year: int, month: int) -> dict:
        start = datetime(year, month, 1)
        end = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    "SELECT COUNT(*) AS paid_count, COALESCE(SUM(amount_due), 0) AS revenue, "
                    "COALESCE(SUM(insurance_discount), 0) AS insurance_discount, "
                    "SUM(CASE WHEN source = 'legacy_mysql' THEN 1 ELSE 0 END) AS legacy_estimated_count "
                    "FROM invoices WHERE status = 'paid' AND "
                    "((paid_at >= %s AND paid_at < %s) OR "
                    "(source = 'legacy_mysql' AND legacy_date >= %s AND legacy_date < %s))",
                    (start, end, start, end),
                )
                paid = await cursor.fetchone()
                await cursor.execute(
                    "SELECT COUNT(*) AS pending_count FROM invoices "
                    "WHERE status = 'pending' AND created_at >= %s AND created_at < %s",
                    (start, end),
                )
                pending = await cursor.fetchone()
                await cursor.execute(
                    "SELECT COUNT(*) AS refunded_count, COALESCE(SUM(amount_due), 0) AS refunded_amount "
                    "FROM invoices WHERE status = 'refunded' AND refunded_at >= %s AND refunded_at < %s",
                    (start, end),
                )
                refunds = await cursor.fetchone()
                await cursor.execute(
                    "SELECT COUNT(*) AS lab_count, COALESCE(SUM(amount_due), 0) AS lab_revenue, "
                    "COALESCE(SUM(insurance_discount), 0) AS lab_insurance_discount "
                    "FROM legacy_lab_charges WHERE legacy_date >= %s AND legacy_date < %s",
                    (start, end),
                )
                lab = await cursor.fetchone()
                await connection.rollback()
                return {"month": f"{year:04d}-{month:02d}",
                        "paid_count": paid["paid_count"] + lab["lab_count"],
                        "pending_count": pending["pending_count"],
                        "revenue": int(paid["revenue"]) + int(lab["lab_revenue"]),
                        "insurance_discount": int(paid["insurance_discount"]) +
                                              int(lab["lab_insurance_discount"]),
                        "legacy_estimated_count": (paid["legacy_estimated_count"] or 0) + lab["lab_count"],
                        "legacy_lab_count": lab["lab_count"],
                        "refunded_count": refunds["refunded_count"],
                        "refunded_amount": int(refunds["refunded_amount"])}
